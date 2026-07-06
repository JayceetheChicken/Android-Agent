import { googleDriveProvider } from './providers/googleDriveProvider';
import type { DriveDownloadResult, DriveFile, DriveFileList, DriveStatus } from './types';

/**
 * Drive service facade: the only entry point for UI and agent tools.
 * Tokens and raw Google API details stay inside the provider/token store.
 */

export function connectDrive(): Promise<NonNullable<DriveStatus['account']>> {
  return googleDriveProvider.connect();
}

export function disconnectDrive(): Promise<void> {
  return googleDriveProvider.disconnect();
}

export function getStatus(): Promise<DriveStatus> {
  return googleDriveProvider.getStatus();
}

export function listFiles(folderId?: string, pageSize?: number): Promise<DriveFileList> {
  return googleDriveProvider.listFiles(folderId, pageSize);
}

export function searchFiles(query: string, pageSize?: number): Promise<DriveFileList> {
  return googleDriveProvider.searchFiles(query, pageSize);
}

export function downloadToSandbox(
  fileId: string,
  sandboxPath: string,
  exportMimeType?: string,
): Promise<DriveDownloadResult> {
  return googleDriveProvider.downloadToSandbox(fileId, sandboxPath, exportMimeType);
}

export function uploadFromSandbox(
  sandboxPath: string,
  driveFolderId?: string,
  name?: string,
  mimeType?: string,
): Promise<DriveFile> {
  return googleDriveProvider.uploadFromSandbox(sandboxPath, driveFolderId, name, mimeType);
}

export function moveFile(fileId: string, targetFolderId: string): Promise<DriveFile> {
  return googleDriveProvider.moveFile(fileId, targetFolderId);
}

export function createFolder(name: string, parentFolderId?: string): Promise<DriveFile> {
  return googleDriveProvider.createFolder(name, parentFolderId);
}

export function trashFile(fileId: string): Promise<DriveFile> {
  return googleDriveProvider.trashFile(fileId);
}

export function renameFile(fileId: string, newName: string): Promise<DriveFile> {
  return googleDriveProvider.renameFile(fileId, newName);
}
