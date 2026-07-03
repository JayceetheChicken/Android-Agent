import * as sandboxFs from '../../services/storage/sandboxFs';
import type { FileToolName, ToolHandler } from '../../types/tools';
import { optionalString, requireString } from './paramHelpers';

/**
 * File tools operate ONLY on the app-internal sandbox directory.
 * Path validation happens inside sandboxFs (sanitizeSandboxPath).
 */
export const fileToolHandlers: Record<FileToolName, ToolHandler> = {
  list_files: async (params) => {
    const path = optionalString(params, 'path');
    const entries = await sandboxFs.listEntries(path);
    const lines = entries.map((e) => `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.path}`);
    return {
      ok: true,
      output: lines.length > 0 ? lines.join('\n') : `Folder "${path || '/'}" is empty.`,
      data: entries,
    };
  },

  read_file: async (params) => {
    const path = requireString(params, 'path');
    const content = await sandboxFs.readTextFile(path);
    return { ok: true, output: content, data: { path, content } };
  },

  write_file: async (params) => {
    const path = requireString(params, 'path');
    const content = optionalString(params, 'content');
    await sandboxFs.writeTextFile(path, content);
    return { ok: true, output: `Wrote ${content.length} characters to "${path}".` };
  },

  move_file: async (params) => {
    const from = requireString(params, 'from');
    const to = requireString(params, 'to');
    await sandboxFs.moveEntry(from, to);
    return { ok: true, output: `Moved "${from}" to "${to}".` };
  },

  rename_file: async (params) => {
    const path = requireString(params, 'path');
    const newName = requireString(params, 'new_name');
    await sandboxFs.renameEntry(path, newName);
    return { ok: true, output: `Renamed "${path}" to "${newName}".` };
  },

  create_folder: async (params) => {
    const path = requireString(params, 'path');
    await sandboxFs.createFolder(path);
    return { ok: true, output: `Created folder "${path}".` };
  },

  delete_file: async (params) => {
    const path = requireString(params, 'path');
    await sandboxFs.deleteEntry(path);
    return { ok: true, output: `Deleted "${path}".` };
  },
};
