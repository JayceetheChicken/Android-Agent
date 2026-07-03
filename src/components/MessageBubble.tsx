import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '../types/chat';
import { colors, spacing } from './theme';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props): React.JSX.Element {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={styles.text}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.m,
    flexDirection: 'row',
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  bubbleUser: { backgroundColor: colors.primary },
  bubbleAssistant: { backgroundColor: colors.surfaceLight },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
