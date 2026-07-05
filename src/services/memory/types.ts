export const DEFAULT_USER_ID = 'local-user';

export type MemoryImportance = 1 | 2 | 3 | 4 | 5;

export interface UserMemory {
  id: string;
  userId: string;
  content: string;
  importance: MemoryImportance;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}
