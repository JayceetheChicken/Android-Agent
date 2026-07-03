import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { colors, spacing } from '../components/theme';
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

  useEffect(() => {
    void loadSettings().then((settings) => {
      setApiKey(settings.apiKey);
      setBaseUrl(settings.baseUrl);
      setModel(settings.model);
    });
  }, []);

  const save = useCallback(async () => {
    try {
      await saveSettings({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() });
      setStatus('Gespeichert. ✔');
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [apiKey, baseUrl, model]);

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
});
