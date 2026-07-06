import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '../components/theme';
import * as driveService from '../services/drive/driveService';
import type { DriveFile, DriveStatus } from '../services/drive/types';

function formatSize(size: string | null): string {
  if (!size) {
    return '-';
  }
  const parsed = Number(size);
  if (!Number.isFinite(parsed)) {
    return size;
  }
  if (parsed < 1024) {
    return `${parsed} B`;
  }
  return `${(parsed / 1024).toFixed(1)} KB`;
}

export function DriveScreen(): React.JSX.Element {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await driveService.getStatus());
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const run = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
        await refreshStatus();
      }
    },
    [refreshStatus],
  );

  const connectDrive = useCallback(() => {
    void run('connect', async () => {
      const account = await driveService.connectDrive();
      Alert.alert('Drive verbunden', `Angemeldet als ${account.address}.`);
    });
  }, [run]);

  const disconnectDrive = useCallback(() => {
    Alert.alert('Drive trennen', 'Zugriff widerrufen und Tokens löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Trennen',
        style: 'destructive',
        onPress: () => {
          void run('disconnect', async () => {
            await driveService.disconnectDrive();
            setFiles([]);
          });
        },
      },
    ]);
  }, [run]);

  const listRoot = useCallback(() => {
    void run('list', async () => {
      const result = await driveService.listFiles('root', 25);
      setFiles(result.files);
    });
  }, [run]);

  const connected = status?.connected === true;
  const statusText = !status
    ? 'Lade Status...'
    : connected
      ? `Drive verbunden: ${status.account?.address ?? 'Google Drive'}`
      : 'Drive nicht verbunden';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Drive</Text>
      <View style={styles.statusBox}>
        <Text style={[styles.statusText, connected && styles.statusConnected]}>{statusText}</Text>
      </View>

      <View style={styles.buttonRow}>
        {!connected && (
          <Pressable style={[styles.button, styles.primary]} onPress={connectDrive}>
            {busy === 'connect' ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.buttonText}>Drive verbinden</Text>
            )}
          </Pressable>
        )}
        {connected && (
          <Pressable style={[styles.button, styles.dangerButton]} onPress={disconnectDrive}>
            <Text style={styles.buttonText}>Drive trennen</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.secondary]} onPress={listRoot}>
          {busy === 'list' ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.buttonText}>Root-Dateien laden</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.file}>
            <View style={styles.fileHeader}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.fileSize}>{formatSize(item.size)}</Text>
            </View>
            <Text style={styles.fileMeta} numberOfLines={1}>
              {item.mimeType}
            </Text>
            <Text style={styles.fileMeta} numberOfLines={1}>
              ID: {item.id}
            </Text>
            <Text style={styles.fileMeta}>
              {item.modifiedTime ? item.modifiedTime.slice(0, 10) : '-'}
              {item.trashed ? ' | Papierkorb' : ''}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Noch keine Drive-Dateien geladen.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.l },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', paddingHorizontal: spacing.l },
  statusBox: {
    marginHorizontal: spacing.l,
    marginTop: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.m,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  statusText: { color: colors.textMuted, fontSize: 13 },
  statusConnected: { color: colors.success },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    marginVertical: spacing.m,
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    minWidth: 130,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceLight },
  dangerButton: { backgroundColor: colors.danger },
  buttonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.s,
    fontSize: 13,
  },
  file: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.m },
  fileName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  fileSize: { color: colors.textMuted, fontSize: 12 },
  fileMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
