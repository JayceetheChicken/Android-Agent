import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, spacing } from '../components/theme';
import * as sandboxFs from '../services/storage/sandboxFs';
import { joinSandboxPath } from '../utils/paths';

/**
 * File sandbox browser. Everything shown here lives inside
 * <documentDirectory>/sandbox/ – the same directory the agent's file tools use.
 */
export function FilesScreen(): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<sandboxFs.SandboxEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (path: string) => {
    try {
      setError(null);
      setEntries(await sandboxFs.listEntries(path));
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
      await sandboxFs.createFolder(joinSandboxPath(currentPath, name));
      setNewName('');
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
    try {
      await sandboxFs.writeTextFile(joinSandboxPath(currentPath, name), '');
      setNewName('');
      await refresh(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [newName, currentPath, refresh]);

  const remove = useCallback(
    (entry: sandboxFs.SandboxEntry) => {
      Alert.alert('Löschen bestätigen', `"${entry.path}" wirklich löschen?`, [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await sandboxFs.deleteEntry(entry.path);
              setPreview((p) => (p?.path === entry.path ? null : p));
              await refresh(currentPath);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
    },
    [currentPath, refresh],
  );

  const open = useCallback(async (entry: sandboxFs.SandboxEntry) => {
    if (entry.isDirectory) {
      setPreview(null);
      setCurrentPath(entry.path);
      return;
    }
    try {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Datei-Sandbox</Text>
      <Text style={styles.path}>/{currentPath}</Text>
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
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={currentPath.length > 0 ? [null, ...entries] : entries}
        keyExtractor={(item) => (item ? item.path : '..')}
        renderItem={({ item }) =>
          item === null ? (
            <Pressable style={styles.entry} onPress={goUp}>
              <Text style={styles.entryName}>⬆️ ..</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.entry} onPress={() => open(item)}>
              <Text style={styles.entryName}>
                {item.isDirectory ? '📁' : '📄'} {item.name}
              </Text>
              <Pressable hitSlop={8} onPress={() => remove(item)}>
                <Text style={styles.delete}>🗑️</Text>
              </Pressable>
            </Pressable>
          )
        }
        ListEmptyComponent={<Text style={styles.empty}>Dieser Ordner ist leer.</Text>}
      />
      {preview && (
        <View style={styles.preview}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{preview.path}</Text>
            <Pressable onPress={() => setPreview(null)}>
              <Text style={styles.previewClose}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.previewContent} numberOfLines={12}>
            {preview.content.length > 0 ? preview.content : '(leere Datei)'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.l },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', paddingHorizontal: spacing.l },
  path: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    paddingHorizontal: spacing.l,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
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
  error: { color: colors.danger, paddingHorizontal: spacing.l, marginBottom: spacing.s },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryName: { color: colors.text, fontSize: 15 },
  delete: { fontSize: 16 },
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
  previewClose: { color: colors.textMuted, fontSize: 16, paddingLeft: spacing.m },
  previewContent: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: spacing.s,
  },
});
