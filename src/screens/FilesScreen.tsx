import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, spacing } from '../components/theme';
import * as importService from '../services/storage/importService';
import * as sandboxFs from '../services/storage/sandboxFs';
import { joinSandboxPath } from '../utils/paths';

type EntryItem = sandboxFs.SandboxEntry | null;
type EditDialog = {
  mode: 'rename' | 'move';
  entry: sandboxFs.SandboxEntry;
  value: string;
} | null;

function formatSize(size: number | null): string {
  if (size === null) {
    return 'Ordner';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

function sortEntries(entries: sandboxFs.SandboxEntry[]): sandboxFs.SandboxEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * File sandbox browser. Everything shown here lives inside
 * <documentDirectory>/sandbox/ - the same directory the agent's file tools use.
 */
export function FilesScreen(): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<sandboxFs.SandboxEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dialog, setDialog] = useState<EditDialog>(null);

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter((part) => part.length > 0);
    let path = '';
    return [
      { label: '/', path: '' },
      ...parts.map((part) => {
        path = joinSandboxPath(path, part);
        return { label: part, path };
      }),
    ];
  }, [currentPath]);

  const listData: EntryItem[] = currentPath.length > 0 ? [null, ...entries] : entries;

  const refresh = useCallback(async (path: string) => {
    try {
      setError(null);
      setEntries(sortEntries(await sandboxFs.listEntries(path)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh(currentPath);
  }, [currentPath, refresh]);

  const createFolder = useCallback(async () => {
    const name = newName.trim();
    if (name.length === 0) {
      return;
    }
    try {
      setError(null);
      await sandboxFs.createFolder(joinSandboxPath(currentPath, name));
      setNewName('');
      setStatus(`Ordner "${name}" erstellt.`);
      await refresh(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [newName, currentPath, refresh]);

  const createFile = useCallback(async () => {
    const name = newName.trim();
    if (name.length === 0) {
      return;
    }
    const targetPath = joinSandboxPath(currentPath, name);
    try {
      setError(null);
      if (await sandboxFs.existsInSandbox(targetPath)) {
        setError(`"${targetPath}" existiert bereits.`);
        return;
      }
      await sandboxFs.writeTextFile(targetPath, '');
      setNewName('');
      setStatus(`Textdatei "${name}" erstellt.`);
      await refresh(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [newName, currentPath, refresh]);

  const clearPreviewForEntry = useCallback((entry: sandboxFs.SandboxEntry) => {
    setPreview((p) =>
      p && (p.path === entry.path || p.path.startsWith(`${entry.path}/`)) ? null : p,
    );
  }, []);

  const remove = useCallback(
    (entry: sandboxFs.SandboxEntry) => {
      Alert.alert('Löschen bestätigen', `"${entry.path}" wirklich löschen?`, [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              setError(null);
              await sandboxFs.deleteEntry(entry.path);
              clearPreviewForEntry(entry);
              setStatus(`"${entry.path}" gelöscht.`);
              await refresh(currentPath);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
    },
    [clearPreviewForEntry, currentPath, refresh],
  );

  const open = useCallback(async (entry: sandboxFs.SandboxEntry) => {
    if (entry.isDirectory) {
      setPreview(null);
      setCurrentPath(entry.path);
      return;
    }
    try {
      setError(null);
      const content = await sandboxFs.readTextFile(entry.path);
      setPreview({ path: entry.path, content });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const goUp = useCallback(() => {
    setPreview(null);
    setCurrentPath((p) => p.split('/').slice(0, -1).join('/'));
  }, []);

  const importFiles = useCallback(async () => {
    if (importing) {
      return;
    }
    try {
      setError(null);
      setStatus(null);
      setImporting(true);
      const imported = await importService.importDeviceFiles(currentPath);
      if (imported.length === 0) {
        setStatus('Import abgebrochen.');
        return;
      }
      const renamed = imported.filter((file) => file.renamed).length;
      setStatus(
        `${imported.length} Datei${imported.length === 1 ? '' : 'en'} importiert.${renamed > 0 ? ` ${renamed} Name${renamed === 1 ? '' : 'n'} angepasst.` : ''}`,
      );
      await refresh(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }, [currentPath, importing, refresh]);

  const openDialog = useCallback((mode: 'rename' | 'move', entry: sandboxFs.SandboxEntry) => {
    setDialog({ mode, entry, value: mode === 'rename' ? entry.name : entry.path });
  }, []);

  const submitDialog = useCallback(async () => {
    if (!dialog) {
      return;
    }
    const value = dialog.value.trim();
    if (value.length === 0) {
      setError('Bitte einen Wert eingeben.');
      return;
    }
    try {
      setError(null);
      if (dialog.mode === 'rename') {
        await sandboxFs.renameEntry(dialog.entry.path, value);
        setStatus(`"${dialog.entry.path}" umbenannt.`);
      } else {
        await sandboxFs.moveEntry(dialog.entry.path, value);
        setStatus(`"${dialog.entry.path}" verschoben nach "${value}".`);
      }
      clearPreviewForEntry(dialog.entry);
      setDialog(null);
      await refresh(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [clearPreviewForEntry, currentPath, dialog, refresh]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Datei-Sandbox</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.breadcrumbs}
      >
        {breadcrumbs.map((crumb, index) => (
          <Pressable
            key={crumb.path || 'root'}
            style={[styles.crumb, crumb.path === currentPath && styles.crumbActive]}
            onPress={() => {
              setPreview(null);
              setCurrentPath(crumb.path);
            }}
          >
            <Text style={styles.crumbText}>
              {index > 0 ? ' / ' : ''}
              {crumb.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Name für neue Datei / Ordner"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.smallButton} onPress={createFolder}>
          <Text style={styles.smallButtonText}>+ Ordner</Text>
        </Pressable>
        <Pressable style={styles.smallButton} onPress={createFile}>
          <Text style={styles.smallButtonText}>+ Datei</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.importButton, importing && styles.disabledButton]}
        onPress={importFiles}
        disabled={importing}
      >
        {importing ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.importText}>Datei vom Gerät importieren</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {status && !error && <Text style={styles.status}>{status}</Text>}

      <FlatList
        data={listData}
        keyExtractor={(item) => (item ? item.path : '..')}
        renderItem={({ item }) =>
          item === null ? (
            <Pressable style={styles.upEntry} onPress={goUp}>
              <Text style={styles.entryName}>↑ ..</Text>
            </Pressable>
          ) : (
            <View style={styles.entry}>
              <Pressable style={styles.entryMain} onPress={() => open(item)}>
                <Text style={styles.entryName} numberOfLines={1}>
                  {item.isDirectory ? '📁' : '📄'} {item.name}
                </Text>
                <Text style={styles.entryMeta}>{formatSize(item.size)}</Text>
              </Pressable>
              <View style={styles.entryActions}>
                <Pressable style={styles.actionButton} onPress={() => openDialog('rename', item)}>
                  <Text style={styles.actionText}>Umben.</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => openDialog('move', item)}>
                  <Text style={styles.actionText}>Versch.</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => remove(item)}>
                  <Text style={styles.actionText}>Löschen</Text>
                </Pressable>
              </View>
            </View>
          )
        }
        ListEmptyComponent={<Text style={styles.empty}>Dieser Ordner ist leer.</Text>}
      />

      {preview && (
        <View style={styles.preview}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {preview.path}
            </Text>
            <Pressable onPress={() => setPreview(null)}>
              <Text style={styles.previewClose}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.previewContent} numberOfLines={12}>
            {preview.content.length > 0 ? preview.content : '(leere Datei)'}
          </Text>
        </View>
      )}

      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {dialog?.mode === 'rename' ? 'Umbenennen' : 'Verschieben'}
            </Text>
            {dialog && <Text style={styles.dialogPath}>{dialog.entry.path}</Text>}
            <Text style={styles.dialogLabel}>
              {dialog?.mode === 'rename'
                ? 'Neuer Name'
                : 'Neuer Pfad relativ zur Sandbox'}
            </Text>
            <TextInput
              style={styles.dialogInput}
              value={dialog?.value ?? ''}
              onChangeText={(value) =>
                setDialog((current) => (current ? { ...current, value } : current))
              }
              placeholder={dialog?.mode === 'rename' ? 'datei.txt' : 'ordner/datei.txt'}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.dialogButtons}>
              <Pressable style={[styles.dialogButton, styles.cancelButton]} onPress={() => setDialog(null)}>
                <Text style={styles.dialogButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[styles.dialogButton, styles.confirmButton]} onPress={submitDialog}>
                <Text style={styles.dialogButtonText}>
                  {dialog?.mode === 'rename' ? 'Umbenennen' : 'Verschieben'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.l },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', paddingHorizontal: spacing.l },
  breadcrumbs: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
    paddingBottom: spacing.m,
    alignItems: 'center',
  },
  crumb: {
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  crumbActive: { backgroundColor: colors.surface },
  crumbText: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.s,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    fontSize: 14,
  },
  smallButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  smallButtonText: { color: colors.text, fontSize: 13 },
  importButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginHorizontal: spacing.l,
    marginBottom: spacing.s,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.6 },
  importText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  error: { color: colors.danger, paddingHorizontal: spacing.l, marginBottom: spacing.s },
  status: { color: colors.success, paddingHorizontal: spacing.l, marginBottom: spacing.s },
  upEntry: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.s,
  },
  entryMain: { flex: 1, minWidth: 0 },
  entryName: { color: colors.text, fontSize: 15 },
  entryMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  entryActions: { flexDirection: 'row', gap: spacing.xs },
  actionButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  deleteButton: { backgroundColor: colors.danger },
  actionText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  preview: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.m,
    maxHeight: 260,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: colors.text, fontWeight: '600', fontSize: 13, flex: 1 },
  previewClose: { color: colors.textMuted, fontSize: 18, paddingLeft: spacing.m },
  previewContent: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: spacing.s,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
  },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dialogPath: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: spacing.s,
  },
  dialogLabel: { color: colors.text, fontSize: 13, marginTop: spacing.m },
  dialogInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginTop: spacing.s,
    fontSize: 14,
  },
  dialogButtons: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.l },
  dialogButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: colors.surfaceLight },
  confirmButton: { backgroundColor: colors.primary },
  dialogButtonText: { color: colors.text, fontWeight: '700' },
});
