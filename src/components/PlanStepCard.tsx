import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getToolDefinition } from '../agent/tools';
import type { StepExecution, StepStatus } from '../types/agent';
import { colors, spacing } from './theme';

interface Props {
  execution: StepExecution;
  index: number;
}

const STATUS_LABELS: Record<StepStatus, string> = {
  pending: 'Wartet',
  awaiting_confirmation: 'Bestätigung nötig',
  running: 'Läuft…',
  done: 'Fertig',
  failed: 'Fehlgeschlagen',
  rejected: 'Abgelehnt',
};

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: colors.textMuted,
  awaiting_confirmation: colors.warning,
  running: colors.primary,
  done: colors.success,
  failed: colors.danger,
  rejected: colors.danger,
};

export function PlanStepCard({ execution, index }: Props): React.JSX.Element {
  const { step, status, result } = execution;
  const definition = getToolDefinition(step.tool);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tool}>
          {index + 1}. {step.tool}
          {definition?.risky ? '  ⚠️' : ''}
        </Text>
        <Text style={[styles.status, { color: STATUS_COLORS[status] }]}>
          {STATUS_LABELS[status]}
        </Text>
      </View>
      {step.reason.length > 0 && <Text style={styles.reason}>{step.reason}</Text>}
      {Object.keys(step.params).length > 0 && (
        <Text style={styles.params}>{JSON.stringify(step.params, null, 2)}</Text>
      )}
      {result && (
        <Text style={[styles.result, !result.ok && styles.resultError]} numberOfLines={6}>
          {result.output}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    marginHorizontal: spacing.m,
    marginVertical: spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tool: { color: colors.text, fontWeight: '600', fontSize: 14 },
  status: { fontSize: 12, fontWeight: '600' },
  reason: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 },
  params: {
    color: colors.textMuted,
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: spacing.s,
  },
  result: {
    color: colors.text,
    fontSize: 12,
    marginTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.s,
  },
  resultError: { color: colors.danger },
});
