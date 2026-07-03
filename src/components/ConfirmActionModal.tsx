import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ConfirmationRequest } from '../types/agent';
import { colors, spacing } from './theme';

interface Props {
  /** null = hidden */
  request: ConfirmationRequest | null;
  onDecision: (approved: boolean) => void;
}

/**
 * Security-critical dialog: every risky agent action passes through here.
 * It shows the exact tool, parameters and the agent's reason, and only the
 * user's explicit tap on "Erlauben" lets the Tool-Executor continue.
 */
export function ConfirmActionModal({ request, onDecision }: Props): React.JSX.Element {
  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      onRequestClose={() => onDecision(false)}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>⚠️ Riskante Aktion bestätigen</Text>
          {request && (
            <>
              <Text style={styles.tool}>{request.tool}</Text>
              <Text style={styles.description}>{request.description}</Text>
              {request.reason.length > 0 && (
                <Text style={styles.reason}>Begründung des Agenten: {request.reason}</Text>
              )}
              {Object.keys(request.params).length > 0 && (
                <Text style={styles.params}>{JSON.stringify(request.params, null, 2)}</Text>
              )}
            </>
          )}
          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.reject]} onPress={() => onDecision(false)}>
              <Text style={styles.buttonText}>Ablehnen</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.approve]} onPress={() => onDecision(true)}>
              <Text style={styles.buttonText}>Erlauben</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.l,
  },
  title: { color: colors.warning, fontSize: 16, fontWeight: '700', marginBottom: spacing.m },
  tool: { color: colors.text, fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  description: { color: colors.text, marginTop: spacing.s, fontSize: 14 },
  reason: { color: colors.textMuted, marginTop: spacing.s, fontSize: 13, fontStyle: 'italic' },
  params: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: spacing.m,
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.s,
  },
  buttons: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.l },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  reject: { backgroundColor: colors.surfaceLight },
  approve: { backgroundColor: colors.danger },
  buttonText: { color: colors.text, fontWeight: '600' },
});
