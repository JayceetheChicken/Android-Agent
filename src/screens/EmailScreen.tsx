import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../components/theme';
import * as emailService from '../services/email/emailService';
import type { EmailAccount, EmailMessage } from '../types/email';

/**
 * Mock email screen. Shows the same mock mailbox the agent's email tools use,
 * so agent actions (archive, label, drafts, "send") are visible here.
 */
export function EmailScreen(): React.JSX.Element {
  const [account, setAccount] = useState<EmailAccount | null>(emailService.getAccount());
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessage | null>(null);

  const refresh = useCallback(async () => {
    setAccount(emailService.getAccount());
    setEmails(await emailService.searchEmails(''));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(() => {
    Alert.alert(
      'Konto verbinden (Mock)',
      'Es wird KEIN echtes Konto verbunden – nur der Mock-Account "me@sandbox.local".',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Verbinden',
          onPress: async () => {
            await emailService.connectMockAccount('me@sandbox.local');
            await refresh();
          },
        },
      ],
    );
  }, [refresh]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>E-Mail (Mock)</Text>
      <View style={styles.accountRow}>
        <Text style={styles.accountText}>
          {account ? `Verbunden: ${account.address} (${account.provider})` : 'Kein Konto verbunden'}
        </Text>
        {!account && (
          <Pressable style={styles.connectButton} onPress={connect}>
            <Text style={styles.connectText}>Mock verbinden</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={emails}
        keyExtractor={(m) => m.id}
        refreshing={false}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <Pressable
            style={styles.mail}
            onPress={() => {
              setSelected((prev) => (prev?.id === item.id ? null : item));
              void emailService.readEmail(item.id).then(refresh);
            }}
          >
            <View style={styles.mailHeader}>
              <Text style={[styles.mailFrom, !item.read && styles.unread]} numberOfLines={1}>
                {item.from}
              </Text>
              <Text style={styles.mailDate}>{item.date.slice(0, 10)}</Text>
            </View>
            <Text style={[styles.mailSubject, !item.read && styles.unread]} numberOfLines={1}>
              {item.subject}
            </Text>
            <View style={styles.labelRow}>
              {item.labels.map((label) => (
                <Text key={label} style={styles.label}>
                  {label}
                </Text>
              ))}
            </View>
            {selected?.id === item.id && <Text style={styles.body}>{item.body}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Posteingang ist leer.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.l },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', paddingHorizontal: spacing.l },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  accountText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  connectButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  connectText: { color: colors.text, fontSize: 13, fontWeight: '600' },
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
  labelRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
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
