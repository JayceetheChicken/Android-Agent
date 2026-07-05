import * as memoryService from '../../services/memory/memoryService';
import type { MemoryImportance } from '../../services/memory/types';
import type { MemoryToolName, ToolHandler, ToolParams } from '../../types/tools';
import { optionalNumber, requireString } from './paramHelpers';

function optionalImportance(params: ToolParams): MemoryImportance | undefined {
  const value = optionalNumber(params, 'importance');
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('Invalid parameter "importance" (expected integer 1-5).');
  }
  return value as MemoryImportance;
}

function optionalStringArray(params: ToolParams, key: string): string[] | undefined {
  const value = params[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid parameter "${key}" (expected string array).`);
  }
  return value as string[];
}

function formatMemory(memory: memoryService.UserMemory): string {
  const tags = memory.tags.length > 0 ? ` [${memory.tags.join(', ')}]` : '';
  return `${memory.id} | importance ${memory.importance}${tags} | ${memory.content}`;
}

export const memoryToolHandlers: Record<MemoryToolName, ToolHandler> = {
  remember: async (params) => {
    const content = requireString(params, 'content');
    const memory = await memoryService.addMemory({
      content,
      importance: optionalImportance(params),
      tags: optionalStringArray(params, 'tags'),
    });
    return {
      ok: true,
      output: `Saved memory "${memory.id}".`,
      data: memory,
    };
  },

  search_memory: async (params) => {
    const query = requireString(params, 'query');
    const memories = await memoryService.searchMemories(query);
    return {
      ok: true,
      output:
        memories.length > 0 ? memories.map(formatMemory).join('\n') : 'No matching memories found.',
      data: memories,
    };
  },

  list_memory: async () => {
    const memories = await memoryService.listMemories();
    return {
      ok: true,
      output: memories.length > 0 ? memories.map(formatMemory).join('\n') : 'No memories saved.',
      data: memories,
    };
  },

  forget_memory: async (params) => {
    const id = requireString(params, 'id');
    await memoryService.deleteMemory(id);
    return { ok: true, output: `Deleted memory "${id}".` };
  },
};
