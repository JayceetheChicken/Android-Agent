import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../config/constants';
import { generateId } from '../../utils/json';
import { DEFAULT_USER_ID, type MemoryImportance, type UserMemory } from './types';

const MAX_CONTEXT_MEMORIES = 10;
const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\bpasswort\b/i,
  /\bapi[-_ ]?key\b/i,
  /\boauth[-_ ]?token\b/i,
  /\baccess[-_ ]?token\b/i,
  /\brefresh[-_ ]?token\b/i,
  /\bcredit[-_ ]?card\b/i,
  /\bkreditkarte\b/i,
  /\bbankdaten\b/i,
];

function normalizeUserId(userId?: string): string {
  const trimmed = userId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_USER_ID;
}

function normalizeImportance(value?: MemoryImportance): MemoryImportance {
  return value ?? 3;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase();
    if (clean.length > 0 && !seen.has(clean)) {
      seen.add(clean);
      normalized.push(clean);
    }
  }
  return normalized;
}

function assertMemoryContentAllowed(content: string): void {
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new Error('Sensitive data must not be stored in user memory.');
  }
}

async function loadAll(): Promise<UserMemory[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.userMemory);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UserMemory[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(memories: UserMemory[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.userMemory, JSON.stringify(memories));
}

function compareMemories(a: UserMemory, b: UserMemory): number {
  if (b.importance !== a.importance) {
    return b.importance - a.importance;
  }
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function scoreMemory(memory: UserMemory, terms: string[]): number {
  if (terms.length === 0) {
    return memory.importance >= 4 ? memory.importance : 0;
  }
  const content = memory.content.toLowerCase();
  const tags = memory.tags.map((tag) => tag.toLowerCase());
  let score = memory.importance >= 4 ? 2 : 0;

  for (const term of terms) {
    if (content.includes(term)) {
      score += 2;
    }
    if (tags.some((tag) => tag.includes(term))) {
      score += 3;
    }
  }

  return score;
}

async function touchMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  const memories = await loadAll();
  await saveAll(
    memories.map((memory) => (idSet.has(memory.id) ? { ...memory, lastUsedAt: now } : memory)),
  );
}

export async function addMemory(input: {
  userId?: string;
  content: string;
  importance?: MemoryImportance;
  tags?: string[];
}): Promise<UserMemory> {
  const content = input.content.trim();
  if (content.length === 0) {
    throw new Error('Memory content must not be empty.');
  }
  assertMemoryContentAllowed(content);

  const now = new Date().toISOString();
  const memory: UserMemory = {
    id: generateId(),
    userId: normalizeUserId(input.userId),
    content,
    importance: normalizeImportance(input.importance),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  };

  const memories = await loadAll();
  await saveAll([memory, ...memories]);
  return memory;
}

export async function listMemories(userId?: string): Promise<UserMemory[]> {
  const normalizedUserId = normalizeUserId(userId);
  return (await loadAll())
    .filter((memory) => memory.userId === normalizedUserId)
    .sort(compareMemories);
}

export async function searchMemories(query: string, userId?: string): Promise<UserMemory[]> {
  const normalizedUserId = normalizeUserId(userId);
  const terms = tokenize(query);
  const scored = (await loadAll())
    .filter((memory) => memory.userId === normalizedUserId)
    .map((memory) => ({ memory, score: scoreMemory(memory, terms) }))
    .filter((item) => item.score > 0);

  return scored
    .sort((a, b) => b.score - a.score || compareMemories(a.memory, b.memory))
    .map((item) => item.memory);
}

export async function updateMemory(
  id: string,
  patch: Partial<Pick<UserMemory, 'content' | 'importance' | 'tags'>>,
): Promise<UserMemory> {
  const memories = await loadAll();
  const index = memories.findIndex((memory) => memory.id === id);
  if (index === -1) {
    throw new Error(`Memory not found: "${id}"`);
  }

  const existing = memories[index];
  const content = patch.content !== undefined ? patch.content.trim() : existing.content;
  if (content.length === 0) {
    throw new Error('Memory content must not be empty.');
  }
  assertMemoryContentAllowed(content);

  const updated: UserMemory = {
    ...existing,
    content,
    importance: patch.importance ?? existing.importance,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : existing.tags,
    updatedAt: new Date().toISOString(),
  };
  memories[index] = updated;
  await saveAll(memories);
  return updated;
}

export async function deleteMemory(id: string): Promise<void> {
  const memories = await loadAll();
  const next = memories.filter((memory) => memory.id !== id);
  if (next.length === memories.length) {
    throw new Error(`Memory not found: "${id}"`);
  }
  await saveAll(next);
}

export async function clearMemories(userId?: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  const memories = await loadAll();
  await saveAll(memories.filter((memory) => memory.userId !== normalizedUserId));
}

export async function getRelevantMemoryContext(
  userInput: string,
  userId?: string,
): Promise<string> {
  const memories = (await searchMemories(userInput, userId)).slice(0, MAX_CONTEXT_MEMORIES);
  if (memories.length === 0) {
    return '';
  }

  await touchMemories(memories.map((memory) => memory.id));
  return ['Local user memory:', ...memories.map((memory) => `- ${memory.content}`)].join('\n');
}

export { DEFAULT_USER_ID };
export type { MemoryImportance, UserMemory };
