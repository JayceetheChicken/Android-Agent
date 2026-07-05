import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../config/constants';
import { generateId } from '../../utils/json';
import { DEFAULT_USER_ID, type MemoryImportance, type UserMemory } from './types';

const MAX_CONTEXT_MEMORIES = 10;
const MERGE_SIMILARITY_THRESHOLD = 0.85;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'ich',
  'das',
  'dass',
  'der',
  'die',
  'du',
  'ein',
  'eine',
  'einen',
  'fuer',
  'für',
  'im',
  'ist',
  'mag',
  'mit',
  'und',
]);
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

export interface AddMemoryInput {
  userId?: string;
  content: string;
  importance?: MemoryImportance;
  tags?: string[];
}

export interface AddMemoryResult {
  memory: UserMemory;
  merged: boolean;
}

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

function mergeTags(a: string[], b: string[]): string[] {
  return normalizeTags([...a, ...b]);
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

function normalizedTokens(input: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of tokenize(input)) {
    if (!STOP_WORDS.has(token) && !seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
  }
  return tokens;
}

export function similarity(a: string, b: string): number {
  const aTokens = normalizedTokens(a);
  const bTokens = normalizedTokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) {
    return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  }
  const bSet = new Set(bTokens);
  const intersection = aTokens.filter((token) => bSet.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function daysSince(date?: string): number | null {
  if (!date) {
    return null;
  }
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function recencyBoost(memory: UserMemory): number {
  const updatedDays = daysSince(memory.updatedAt);
  const usedDays = daysSince(memory.lastUsedAt);
  const updatedBoost = updatedDays === null ? 0 : Math.max(0, 2 - updatedDays / 30);
  const usedBoost = usedDays === null ? 0 : Math.max(0, 1.5 - usedDays / 14);
  return updatedBoost + usedBoost;
}

function scoreMemory(memory: UserMemory, query: string, terms: string[]): number {
  if (terms.length === 0) {
    return memory.importance >= 4 ? memory.importance * 2 + recencyBoost(memory) : 0;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const content = memory.content.toLowerCase();
  const tags = memory.tags.map((tag) => tag.toLowerCase());
  const memoryTermSet = new Set(normalizedTokens(memory.content));
  const matchingTerms = terms.filter((term) => memoryTermSet.has(term) || content.includes(term));
  const tokenOverlap = matchingTerms.length / Math.max(terms.length, 1);
  const tagHits = terms.filter((term) => tags.some((tag) => tag.includes(term))).length;
  const phraseMatch = normalizedQuery.length >= 4 && content.includes(normalizedQuery) ? 1 : 0;

  return (
    phraseMatch * 12 +
    tokenOverlap * 8 +
    tagHits * 4 +
    memory.importance * 1.5 +
    recencyBoost(memory) +
    (memory.importance >= 4 ? 2 : 0)
  );
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

export async function addMemoryWithMerge(input: AddMemoryInput): Promise<AddMemoryResult> {
  const content = input.content.trim();
  if (content.length === 0) {
    throw new Error('Memory content must not be empty.');
  }
  assertMemoryContentAllowed(content);

  const now = new Date().toISOString();
  const userId = normalizeUserId(input.userId);
  const importance = normalizeImportance(input.importance);
  const tags = normalizeTags(input.tags);
  const memories = await loadAll();
  const existingIndex = memories.findIndex(
    (memory) =>
      memory.userId === userId && similarity(memory.content, content) >= MERGE_SIMILARITY_THRESHOLD,
  );

  if (existingIndex !== -1) {
    const existing = memories[existingIndex];
    const updated: UserMemory = {
      ...existing,
      content: content.length > existing.content.length ? content : existing.content,
      importance: importance > existing.importance ? importance : existing.importance,
      tags: mergeTags(existing.tags, tags),
      updatedAt: now,
    };
    memories[existingIndex] = updated;
    await saveAll(memories);
    return { memory: updated, merged: true };
  }

  const memory: UserMemory = {
    id: generateId(),
    userId,
    content,
    importance,
    tags,
    createdAt: now,
    updatedAt: now,
  };

  await saveAll([memory, ...memories]);
  return { memory, merged: false };
}

export async function addMemory(input: AddMemoryInput): Promise<UserMemory> {
  return (await addMemoryWithMerge(input)).memory;
}

export async function listMemories(userId?: string): Promise<UserMemory[]> {
  const normalizedUserId = normalizeUserId(userId);
  return (await loadAll())
    .filter((memory) => memory.userId === normalizedUserId)
    .sort(compareMemories);
}

export async function searchMemories(query: string, userId?: string): Promise<UserMemory[]> {
  const normalizedUserId = normalizeUserId(userId);
  const terms = normalizedTokens(query);
  const scored = (await loadAll())
    .filter((memory) => memory.userId === normalizedUserId)
    .map((memory) => ({ memory, score: scoreMemory(memory, query, terms) }))
    .filter((item) => item.score >= 3);

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
