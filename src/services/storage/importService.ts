import * as DocumentPicker from 'expo-document-picker';

import { joinSandboxPath, sanitizeSandboxPath } from '../../utils/paths';
import * as sandboxFs from './sandboxFs';

export interface ImportedFile {
  originalName: string;
  name: string;
  sandboxPath: string;
  size: number | null;
  mimeType: string | null;
  renamed: boolean;
}

const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g;

function normalizePickedFileName(name: string): string {
  const trimmed = name.trim().replace(INVALID_FILE_NAME_CHARS, '_');
  if (trimmed === '.' || trimmed === '..') {
    return 'imported-file';
  }
  return trimmed.length > 0 ? trimmed : 'imported-file';
}

function splitExtension(fileName: string): { base: string; extension: string } {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return { base: fileName, extension: '' };
  }
  return { base: fileName.slice(0, dot), extension: fileName.slice(dot) };
}

export async function makeUniqueSandboxFileName(
  folder: string,
  originalName: string,
): Promise<string> {
  const targetFolder = sanitizeSandboxPath(folder);
  const safeName = normalizePickedFileName(originalName);
  const { base, extension } = splitExtension(safeName);

  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? safeName : `${base} (${index})${extension}`;
    const targetPath = sanitizeSandboxPath(joinSandboxPath(targetFolder, candidate));
    if (!(await sandboxFs.existsInSandbox(targetPath))) {
      return candidate;
    }
  }

  throw new Error(`Could not find a free file name for "${originalName}".`);
}

export async function copyPickedFileToSandbox(
  sourceUri: string,
  targetPath: string,
): Promise<void> {
  const safeTargetPath = sanitizeSandboxPath(targetPath);
  await sandboxFs.copyExternalFileIntoSandbox(sourceUri, safeTargetPath);
}

export async function importDeviceFiles(targetSandboxFolder: string): Promise<ImportedFile[]> {
  const targetFolder = sanitizeSandboxPath(targetSandboxFolder);
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    base64: false,
  });

  if (result.canceled) {
    return [];
  }

  const imported: ImportedFile[] = [];
  for (const asset of result.assets) {
    const name = await makeUniqueSandboxFileName(targetFolder, asset.name);
    const sandboxPath = sanitizeSandboxPath(joinSandboxPath(targetFolder, name));
    await copyPickedFileToSandbox(asset.uri, sandboxPath);
    imported.push({
      originalName: asset.name,
      name,
      sandboxPath,
      size: asset.size ?? null,
      mimeType: asset.mimeType ?? null,
      renamed: name !== normalizePickedFileName(asset.name),
    });
  }

  return imported;
}
