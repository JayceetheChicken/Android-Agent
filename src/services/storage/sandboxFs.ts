import { Directory, File, Paths } from 'expo-file-system';

import { SANDBOX_DIR_NAME } from '../../config/constants';
import { sanitizeSandboxPath, toSegments } from '../../utils/paths';

/**
 * File sandbox: a single directory inside the app's private document storage.
 * ALL file operations in the app (agent tools and UI) go through this module,
 * and every path is validated by sanitizeSandboxPath first.
 * Nothing outside `<documentDirectory>/sandbox/` is ever touched.
 */

export interface SandboxEntry {
  name: string;
  /** Path relative to the sandbox root, e.g. "notes/todo.txt". */
  path: string;
  isDirectory: boolean;
  size: number | null;
}

function sandboxRoot(): Directory {
  const root = new Directory(Paths.document, SANDBOX_DIR_NAME);
  if (!root.exists) {
    root.create({ intermediates: true });
  }
  return root;
}

function resolveDirectory(relativePath: string): Directory {
  const segments = toSegments(sanitizeSandboxPath(relativePath));
  return new Directory(sandboxRoot(), ...segments);
}

function resolveFile(relativePath: string): File {
  const segments = toSegments(sanitizeSandboxPath(relativePath));
  if (segments.length === 0) {
    throw new Error('A file path must not be empty.');
  }
  return new File(sandboxRoot(), ...segments);
}

export async function listEntries(relativePath = ''): Promise<SandboxEntry[]> {
  const dir = resolveDirectory(relativePath);
  if (!dir.exists) {
    throw new Error(`Folder not found: "${relativePath || '/'}"`);
  }
  const prefix = sanitizeSandboxPath(relativePath);
  return dir.list().map((entry) => {
    const isDirectory = entry instanceof Directory;
    return {
      name: entry.name,
      path: prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name,
      isDirectory,
      size: entry instanceof File ? (entry.size ?? null) : null,
    };
  });
}

export async function readTextFile(relativePath: string): Promise<string> {
  const file = resolveFile(relativePath);
  if (!file.exists) {
    throw new Error(`File not found: "${relativePath}"`);
  }
  return file.text();
}

export async function existsInSandbox(relativePath: string): Promise<boolean> {
  const sanitized = sanitizeSandboxPath(relativePath);
  if (sanitized.length === 0) {
    return sandboxRoot().exists;
  }

  const file = resolveFile(sanitized);
  if (file.exists) {
    return true;
  }

  return resolveDirectory(sanitized).exists;
}

export async function writeTextFile(relativePath: string, content: string): Promise<void> {
  const file = resolveFile(relativePath);
  if (!file.parentDirectory.exists) {
    file.parentDirectory.create({ intermediates: true });
  }
  if (!file.exists) {
    file.create();
  }
  file.write(content);
}

export async function copyExternalFileIntoSandbox(
  sourceUri: string,
  targetPath: string,
): Promise<void> {
  const target = resolveFile(targetPath);
  if (await existsInSandbox(targetPath)) {
    throw new Error(`Destination already exists: "${targetPath}"`);
  }
  if (!target.parentDirectory.exists) {
    target.parentDirectory.create({ intermediates: true });
  }

  const source = new File(sourceUri);
  await source.copy(target, { overwrite: false });
}

export async function createFolder(relativePath: string): Promise<void> {
  const dir = resolveDirectory(relativePath);
  if (dir.exists) {
    throw new Error(`Folder already exists: "${relativePath}"`);
  }
  dir.create({ intermediates: true });
}

export async function deleteEntry(relativePath: string): Promise<void> {
  const file = resolveFile(relativePath);
  if (file.exists) {
    file.delete();
    return;
  }
  const dir = resolveDirectory(relativePath);
  if (dir.exists) {
    dir.delete();
    return;
  }
  throw new Error(`Nothing to delete at: "${relativePath}"`);
}

export async function moveEntry(fromPath: string, toPath: string): Promise<void> {
  const target = resolveFile(toPath);
  const sourceFile = resolveFile(fromPath);
  if (sourceFile.exists) {
    if (!target.parentDirectory.exists) {
      target.parentDirectory.create({ intermediates: true });
    }
    await sourceFile.move(target);
    return;
  }
  const sourceDir = resolveDirectory(fromPath);
  if (sourceDir.exists) {
    await sourceDir.move(resolveDirectory(toPath));
    return;
  }
  throw new Error(`Source not found: "${fromPath}"`);
}

export async function renameEntry(relativePath: string, newName: string): Promise<void> {
  if (newName.includes('/') || newName.includes('\\')) {
    throw new Error('New name must not contain path separators. Use move_file instead.');
  }
  sanitizeSandboxPath(newName);
  const file = resolveFile(relativePath);
  if (file.exists) {
    file.rename(newName);
    return;
  }
  const dir = resolveDirectory(relativePath);
  if (dir.exists) {
    dir.rename(newName);
    return;
  }
  throw new Error(`Source not found: "${relativePath}"`);
}
