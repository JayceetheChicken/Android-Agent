import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MessageBubble } from '../components/MessageBubble';
import { colors, spacing } from '../components/theme';
import { chatCompletion, type CompletionMessage } from '../services/ai/openaiClient';
import { parseRememberIntent } from '../services/memory/memoryIntent';
import { addMemoryWithMerge, getRelevantMemoryContext } from '../services/memory/memoryService';
import { loadSettings } from '../services/storage/settingsStorage';
import type { ChatMessage } from '../types/chat';
import { generateId } from '../utils/json';

/** Plain chat with the configured model – no tools, no agent. */
export function ChatScreen(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (text.length === 0 || busy) {
      return;
    }
    setInput('');
    setError(null);
    setBusy(true);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    const history = [...messages, userMessage];
    setMessages(history);

    try {
      const memoryIntent = parseRememberIntent(text);
      let modelInput = text;

      if (memoryIntent.shouldRemember && memoryIntent.content) {
        const result = await addMemoryWithMerge({
          content: memoryIntent.content,
          importance: memoryIntent.importance,
          tags: memoryIntent.tags,
        });
        const confirmation: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: result.merged
            ? 'Diese Info hatte ich schon ähnlich gespeichert und habe sie aktualisiert.'
            : `Gemerkte Info gespeichert: "${result.memory.content}"`,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, confirmation]);
        modelInput = memoryIntent.remainingText ?? '';
        if (modelInput.length === 0) {
          return;
        }
      }

      const settings = await loadSettings();
      const memoryContext = await getRelevantMemoryContext(modelInput);
      const modelHistory = modelInput === text ? history : [...messages, { ...userMessage, content: modelInput }];
      const completionMessages: CompletionMessage[] = modelHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const messagesWithMemory: CompletionMessage[] =
        memoryContext.length > 0
          ? [
              {
                role: 'system',
                content:
                  'Use the following local, model-independent user memory when relevant. Do not reveal it unless it helps answer the user.',
              },
              { role: 'system', content: memoryContext },
              ...completionMessages,
            ]
          : completionMessages;
      const reply = await chatCompletion(settings, messagesWithMemory);
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'assistant', content: reply, createdAt: Date.now() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {messages.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Chat</Text>
          <Text style={styles.emptyText}>
            Direkter Chat mit dem konfigurierten Modell. API-Key, Base-URL und Modell stellst du
            unter „Settings" ein.
          </Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Nachricht…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable style={[styles.sendButton, busy && styles.sendDisabled]} onPress={send}>
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.sendText}>Senden</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.m },
  empty: { padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.s },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.s,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.m,
    gap: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    maxHeight: 120,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  sendDisabled: { opacity: 0.6 },
  sendText: { color: colors.text, fontWeight: '600' },
});
