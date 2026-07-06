import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { runAgentLoop } from '../agent/loop/agentLoop';
import { setConfirmationHandler } from '../agent/executor/confirmation';
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
 * Agentic Mode (Loop V2): the agent works iteratively – plan → act → observe →
 * replan → … → final answer. Each step shows the chosen tool, the reason and
 * the result live. Risky steps still pause on the ConfirmActionModal.
 */
export function AgentScreen(): React.JSX.Element {
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<StepExecution[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'running' | 'finished'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  // Live step list is built via loop callbacks; a ref keeps it in sync.
  const stepsRef = useRef<StepExecution[]>([]);

  // Bridge executor -> modal. Registered while this screen is mounted (tabs stay
  // mounted, so confirmation works even when the Browser tab is in front).
  useEffect(() => {
    setConfirmationHandler(
      (request) =>
        new Promise<boolean>((resolve) => {
          setConfirmation({ request, resolve });
        }),
    );
    return () => setConfirmationHandler(null);
  }, []);

  const run = useCallback(async () => {
    const text = task.trim();
    if (text.length === 0 || phase === 'running') {
      return;
    }
    setError(null);
    setFinalAnswer(null);
    stepsRef.current = [];
    setSteps([]);
    setPhase('running');

    try {
      const settings = await loadSettings();
      await runAgentLoop(settings, text, {
        onToolStart: ({ tool, params, reason }) => {
          stepsRef.current = [
            ...stepsRef.current,
            { step: { tool, params, reason }, status: 'running' },
          ];
          setSteps(stepsRef.current);
        },
        onToolResult: ({ index, result }) => {
          const next = [...stepsRef.current];
          if (next[index]) {
            next[index] = {
              ...next[index],
              status: result.ok ? 'done' : result.rejected ? 'rejected' : 'failed',
              result,
            };
            stepsRef.current = next;
            setSteps(next);
          }
        },
        onFinal: (answer) => setFinalAnswer(answer),
      });
      setPhase('finished');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('finished');
    }
  }, [task, phase]);

  const reset = useCallback(() => {
    stepsRef.current = [];
    setSteps([]);
    setFinalAnswer(null);
    setError(null);
    setPhase('idle');
  }, []);

  const running = phase === 'running';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Agentic Mode</Text>
        <Text style={styles.subtitle}>
          Beschreibe eine Aufgabe. Der Agent arbeitet iterativ: Er plant einen Schritt, führt ein
          Tool aus, liest das Ergebnis und plant den nächsten Schritt – bis zur finalen Antwort.
          Riskante Schritte (z. B. Formular abschicken, E-Mail senden) brauchen deine Bestätigung.
        </Text>
        <TextInput
          style={styles.input}
          value={task}
          onChangeText={setTask}
          placeholder='z. B. "Suche auf example.com nach News zu React Native und fasse die Titel zusammen"'
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!running}
        />
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.primaryButton, running && styles.disabled]}
            onPress={run}
            disabled={running}
          >
            {running ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Aufgabe starten</Text>
            )}
          </Pressable>
          {phase === 'finished' && (
            <Pressable style={[styles.button, styles.resetButton]} onPress={reset}>
              <Text style={styles.buttonText}>Zurücksetzen</Text>
            </Pressable>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {steps.map((execution, index) => (
          <PlanStepCard key={`${execution.step.tool}-${index}`} execution={execution} index={index} />
        ))}

        {running && steps.length === 0 && (
          <Text style={styles.thinking}>Agent plant den ersten Schritt…</Text>
        )}

        {finalAnswer && (
          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>Antwort</Text>
            <Text style={styles.answerText}>{finalAnswer}</Text>
          </View>
        )}
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
  resetButton: { backgroundColor: colors.surfaceLight },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  error: { color: colors.danger, paddingHorizontal: spacing.l, marginTop: spacing.s },
  thinking: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.l,
    fontStyle: 'italic',
  },
  answerBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginHorizontal: spacing.m,
    marginTop: spacing.m,
    padding: spacing.m,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  answerLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  answerText: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: spacing.xs },
});
