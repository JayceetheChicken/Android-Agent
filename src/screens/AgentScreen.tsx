import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { setConfirmationHandler } from '../agent/executor/confirmation';
import { executeStep } from '../agent/executor/toolExecutor';
import { createPlan } from '../agent/planner';
import { ConfirmActionModal } from '../components/ConfirmActionModal';
import { PlanStepCard } from '../components/PlanStepCard';
import { colors, spacing } from '../components/theme';
import { loadSettings } from '../services/storage/settingsStorage';
import type { ConfirmationRequest, StepExecution } from '../types/agent';

interface PendingConfirmation {
  request: ConfirmationRequest;
  resolve: (approved: boolean) => void;
}

/**
 * Agentic Mode: task in → JSON plan → user reviews → step-by-step execution.
 * Risky steps pause on the ConfirmActionModal until the user decides.
 */
export function AgentScreen(): React.JSX.Element {
  const [task, setTask] = useState('');
  const [goal, setGoal] = useState<string | null>(null);
  const [executions, setExecutions] = useState<StepExecution[]>([]);
  const [phase, setPhase] = useState<'idle' | 'planning' | 'review' | 'executing' | 'finished'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  // Bridge executor -> modal. Registered only while this screen is mounted.
  useEffect(() => {
    setConfirmationHandler(
      (request) =>
        new Promise<boolean>((resolve) => {
          setConfirmation({ request, resolve });
        }),
    );
    return () => setConfirmationHandler(null);
  }, []);

  const plan = useCallback(async () => {
    const text = task.trim();
    if (text.length === 0 || phase === 'planning' || phase === 'executing') {
      return;
    }
    setError(null);
    setGoal(null);
    setExecutions([]);
    setPhase('planning');
    try {
      const settings = await loadSettings();
      const agentPlan = await createPlan(settings, text);
      setGoal(agentPlan.goal);
      setExecutions(agentPlan.steps.map((step) => ({ step, status: 'pending' })));
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  }, [task, phase]);

  const run = useCallback(async () => {
    if (phase !== 'review') {
      return;
    }
    setPhase('executing');
    // Work on a local copy; state updates per step keep the UI in sync.
    const current = [...executions];
    for (let i = 0; i < current.length; i += 1) {
      const update = (execution: StepExecution): void => {
        current[i] = execution;
        setExecutions([...current]);
      };
      update({ ...current[i], status: 'running' });
      const result = await executeStep(current[i].step);
      update({
        ...current[i],
        status: result.ok ? 'done' : result.rejected ? 'rejected' : 'failed',
        result,
      });
    }
    setPhase('finished');
  }, [phase, executions]);

  const reset = useCallback(() => {
    setGoal(null);
    setExecutions([]);
    setError(null);
    setPhase('idle');
  }, []);

  const busy = phase === 'planning' || phase === 'executing';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Agentic Mode</Text>
        <Text style={styles.subtitle}>
          Beschreibe eine Aufgabe. Der Agent erstellt zuerst einen JSON-Plan – ausgeführt wird erst
          nach deinem Review, riskante Schritte nur mit Bestätigung.
        </Text>
        <TextInput
          style={styles.input}
          value={task}
          onChangeText={setTask}
          placeholder='z. B. "Lege einen Ordner notes an und schreibe eine todo.txt hinein"'
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!busy}
        />
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.primaryButton, busy && styles.disabled]}
            onPress={plan}
          >
            {phase === 'planning' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Plan erstellen</Text>
            )}
          </Pressable>
          {phase === 'review' && (
            <Pressable style={[styles.button, styles.runButton]} onPress={run}>
              <Text style={styles.buttonText}>Plan ausführen</Text>
            </Pressable>
          )}
          {(phase === 'review' || phase === 'finished') && (
            <Pressable style={[styles.button, styles.resetButton]} onPress={reset}>
              <Text style={styles.buttonText}>Zurücksetzen</Text>
            </Pressable>
          )}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {goal && (
          <View style={styles.goalBox}>
            <Text style={styles.goalLabel}>Ziel des Plans</Text>
            <Text style={styles.goalText}>{goal}</Text>
          </View>
        )}
        {executions.map((execution, index) => (
          <PlanStepCard key={`${execution.step.tool}-${index}`} execution={execution} index={index} />
        ))}
        {phase === 'finished' && <Text style={styles.finished}>Plan abgeschlossen.</Text>}
      </ScrollView>
      <ConfirmActionModal
        request={confirmation?.request ?? null}
        onDecision={(approved) => {
          confirmation?.resolve(approved);
          setConfirmation(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.l },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: spacing.l,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: spacing.l,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    color: colors.text,
    marginHorizontal: spacing.l,
    padding: spacing.m,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    marginTop: spacing.m,
    marginBottom: spacing.s,
  },
  button: {
    borderRadius: 8,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
  },
  primaryButton: { backgroundColor: colors.primary },
  runButton: { backgroundColor: colors.success },
  resetButton: { backgroundColor: colors.surfaceLight },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  error: { color: colors.danger, paddingHorizontal: spacing.l, marginTop: spacing.s },
  goalBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginHorizontal: spacing.m,
    marginVertical: spacing.s,
    padding: spacing.m,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  goalLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  goalText: { color: colors.text, fontSize: 14, marginTop: spacing.xs },
  finished: {
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.m,
    fontWeight: '600',
  },
});
