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
import * as emailService from '../services/email/emailService';
import type { EmailMessage } from '../types/email';

/**
 * Email tab: shows the active provider (Gmail or mock), lets the user
 * connect/disconnect Gmail (OAuth/PKCE via the system browser) and runs a
 * quick inbox test against the active provider – the same service layer the
 * agent tools use, so agent actions are visible here too.
 */
export function EmailScreen(): React.JSX.Element {
  const [status, setStatus] = useState<emailService.EmailStatus | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await emailService.getStatus());
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

  const connectGmail = useCallback(() => {
    void run('gmail-connect', async () => {
      const account = await emailService.connectGmail();
      setEmails([]);
      setSelected(null);
      Alert.alert('Gmail verbunden', `Angemeldet als ${account.address}.`);
    });
  }, [run]);

  const disconnectGmail = useCallback(() => {
    Alert.alert('Gmail trennen', 'Zugriff widerrufen und Tokens löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Trennen',
        style: 'destructive',
        onPress: () => {
          void run('gmail-disconnect', async () => {
            await emailService.disconnectGmail();
            setEmails([]);
            setSelected(null);
          });
        },
      },
    ]);
  }, [run]);

  const connectMock = useCallback(() => {
    void run('mock-connect', async () => {
      await emailService.connectMock();
      setEmails([]);
      setSelected(null);
    });
  }, [run]);

  const testInbox = useCallback(() => {
    void run('search', async () => {
      setEmails(await emailService.searchEmails(''));
    });
  }, [run]);

  const openEmail = useCallback(
    (mail: EmailMessage) => {
      if (selected?.id === mail.id) {
        setSelected(null);
        return;
      }
      void run('read', async () => {
        setSelected(await emailService.readEmail(mail.id));
      });
    },
    [run, selected],
  );

  const gmailConnected = status?.providerId === 'gmail' && status.account !== null;
  const statusText = !status
    ? 'Lade Status…'
    : gmailConnected
      ? `Gmail verbunden: ${status.account?.address ?? ''}`
      : status.account
        ? `Mock verbunden: ${status.account.address}`
        : 'Nicht verbunden (aktiver Provider: Mock)';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>E-Mail</Text>
      <View style={styles.statusBox}>
        <Text style={[styles.statusText, gmailConnected && styles.statusConnected]}>
          {statusText}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        {!gmailConnected && (
          <Pressable style={[styles.button, styles.primary]} onPress={connectGmail}>
            {busy === 'gmail-connect' ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.buttonText}>Gmail verbinden</Text>
            )}
          </Pressable>
        )}
        {gmailConnected && (
          <Pressable style={[styles.button, styles.dangerButton]} onPress={disconnectGmail}>
            <Text style={styles.buttonText}>Gmail trennen</Text>
          </Pressable>
        )}
        {!gmailConnected && (
          <Pressable style={[styles.button, styles.secondary]} onPress={connectMock}>
            <Text style={styles.buttonText}>Mock verbinden</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.secondary]} onPress={testInbox}>
          {busy === 'search' ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.buttonText}>Test: Inbox suchen</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={emails}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Pressable style={styles.mail} onPress={() => openEmail(item)}>
            <View style={styles.mailHeader}>
              <Text style={[styles.mailFrom, !item.read && styles.unread]} numberOfLines={1}>
                {item.from}
              </Text>
              <Text style={styles.mailDate}>{item.date.slice(0, 10)}</Text>
            </View>
            <Text style={[styles.mailSubject, !item.read && styles.unread]} numberOfLines={1}>
              {item.subject}
            </Text>
            {item.labels.length > 0 && (
              <View style={styles.labelRow}>
                {item.labels.slice(0, 4).map((label) => (
                  <Text key={label} style={styles.label}>
                    {label}
                  </Text>
                ))}
              </View>
            )}
            {selected?.id === item.id && (
              <Text style={styles.body} numberOfLines={20}>
                {selected.body.length > 0 ? selected.body : '(kein Textinhalt)'}
              </Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Noch keine E-Mails geladen. Tippe auf „Test: Inbox suchen".
          </Text>
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
    minWidth: 120,
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
  mail: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mailHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  mailFrom: { color: colors.textMuted, fontSize: 13, flex: 1 },
  mailDate: { color: colors.textMuted, fontSize: 12 },
  mailSubject: { color: colors.text, fontSize: 15, marginTop: 2 },
  unread: { fontWeight: '700', color: colors.text },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  label: {
    color: colors.primary,
    fontSize: 11,
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: spacing.s,
    paddingVertical: 1,
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.m,
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
