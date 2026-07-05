import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, spacing } from '../components/theme';
import {
  clearMemories,
  deleteMemory,
  listMemories,
  type UserMemory,
} from '../services/memory/memoryService';
import { loadSettings, saveSettings } from '../services/storage/settingsStorage';

/**
 * Settings for the OpenAI-compatible API.
 * The API key is stored encrypted via expo-secure-store and never leaves the
 * device except as the Authorization header of API requests.
 */
export function SettingsScreen(): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);

  const refreshMemories = useCallback(async () => {
    try {
      setMemories(await listMemories());
    } catch (e) {
      setMemoryStatus(`Memory-Fehler: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    void loadSettings().then((settings) => {
      setApiKey(settings.apiKey);
      setBaseUrl(settings.baseUrl);
      setModel(settings.model);
    });
    void refreshMemories();
  }, [refreshMemories]);

  const save = useCallback(async () => {
    try {
      await saveSettings({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() });
      setStatus('Gespeichert. ✔');
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [apiKey, baseUrl, model]);

  const removeMemory = useCallback(
    (memory: UserMemory) => {
      Alert.alert('Memory löschen', 'Diese Erinnerung wirklich löschen?', [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMemory(memory.id);
              setMemoryStatus('Memory gelöscht.');
              await refreshMemories();
            } catch (e) {
              setMemoryStatus(`Memory-Fehler: ${e instanceof Error ? e.message : String(e)}`);
            }
          },
        },
      ]);
    },
    [refreshMemories],
  );

  const removeAllMemories = useCallback(() => {
    Alert.alert('Alle Memories löschen', 'Alle lokalen User Memories wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Alle löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearMemories();
            setMemoryStatus('Alle Memories gelöscht.');
            await refreshMemories();
          } catch (e) {
            setMemoryStatus(`Memory-Fehler: ${e instanceof Error ? e.message : String(e)}`);
          }
        },
      },
    ]);
  }, [refreshMemories]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Beliebige OpenAI-kompatible API (POST /chat/completions): OpenAI, OpenRouter, lokale
          Server usw.
        </Text>

        <Text style={styles.label}>API-Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-…"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>Wird verschlüsselt gespeichert (expo-secure-store).</Text>

        <Text style={styles.label}>Base-URL</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://api.openai.com/v1"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.label}>Modellname</Text>
        <TextInput
          style={styles.input}
          value={model}
          onChangeText={setModel}
          placeholder="gpt-4o-mini"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable style={styles.saveButton} onPress={save}>
          <Text style={styles.saveText}>Speichern</Text>
        </Pressable>
        {status && <Text style={styles.status}>{status}</Text>}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>User Memory</Text>
            {memories.length > 0 && (
              <Pressable style={styles.clearButton} onPress={removeAllMemories}>
                <Text style={styles.clearText}>Alle löschen</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.hint}>
            Lokal gespeichert und modellunabhängig. Keine Passwörter, API-Keys oder Tokens
            speichern.
          </Text>
          {memoryStatus && <Text style={styles.memoryStatus}>{memoryStatus}</Text>}
          {memories.length === 0 ? (
            <Text style={styles.emptyMemory}>Noch keine Memories gespeichert.</Text>
          ) : (
            memories.map((memory) => (
              <View key={memory.id} style={styles.memoryCard}>
                <Text style={styles.memoryContent}>{memory.content}</Text>
                <Text style={styles.memoryMeta}>
                  Wichtigkeit {memory.importance} · {memory.tags.length > 0 ? memory.tags.join(', ') : 'keine Tags'}
                </Text>
                <Text style={styles.memoryId}>{memory.id}</Text>
                <Pressable style={styles.deleteButton} onPress={() => removeMemory(memory)}>
                  <Text style={styles.deleteText}>Löschen</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.l },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.l,
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.m },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    marginTop: spacing.s,
    fontSize: 14,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.m,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  status: { color: colors.success, textAlign: 'center', marginTop: spacing.m },
  section: { marginTop: spacing.xl, paddingTop: spacing.l, borderTopWidth: 1, borderTopColor: colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  clearButton: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  clearText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  memoryStatus: { color: colors.success, marginTop: spacing.s, fontSize: 13 },
  emptyMemory: { color: colors.textMuted, marginTop: spacing.m, fontSize: 13 },
  memoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    marginTop: spacing.m,
  },
  memoryContent: { color: colors.text, fontSize: 14, lineHeight: 20 },
  memoryMeta: { color: colors.textMuted, fontSize: 12, marginTop: spacing.s },
  memoryId: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 11, marginTop: spacing.xs },
  deleteButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginTop: spacing.m,
  },
  deleteText: { color: colors.text, fontSize: 12, fontWeight: '700' },
});
