import * as driveService from '../../services/drive/driveService';
import type { DriveFile } from '../../services/drive/types';
import type { DriveToolName, ToolHandler } from '../../types/tools';
import { optionalNumber, optionalString, requireString } from './paramHelpers';

function formatDriveFile(file: DriveFile): string {
  const size = file.size ?? '-';
  const modified = file.modifiedTime ?? '-';
  const parents = file.parents.length > 0 ? file.parents.join(',') : '-';
  return `${file.id} | ${file.name} | ${file.mimeType} | size=${size} | modified=${modified} | parents=${parents} | trashed=${file.trashed}`;
}

function formatDriveFiles(files: DriveFile[]): string {
  return files.length > 0 ? files.map(formatDriveFile).join('\n') : 'No Drive files found.';
}

export const driveToolHandlers: Record<DriveToolName, ToolHandler> = {
  connect_drive_account: async () => {
    const account = await driveService.connectDrive();
    return {
      ok: true,
      output: `Connected Google Drive account "${account.address}" via Google login (OAuth/PKCE).`,
      data: account,
    };
  },

  drive_get_status: async () => {
    const status = await driveService.getStatus();
    return {
      ok: true,
      output: status.connected
        ? `Google Drive connected: ${status.account?.address ?? 'Google Drive'}.`
        : 'Google Drive is not connected.',
      data: status,
    };
  },

  drive_list_files: async (params) => {
    const folderId = optionalString(params, 'folder_id') || 'root';
    const pageSize = optionalNumber(params, 'page_size');
    const result = await driveService.listFiles(folderId, pageSize);
    return {
      ok: true,
      output: formatDriveFiles(result.files),
      data: result,
    };
  },

  drive_search_files: async (params) => {
    const query = requireString(params, 'query');
    const pageSize = optionalNumber(params, 'page_size');
    const result = await driveService.searchFiles(query, pageSize);
    return {
      ok: true,
      output: formatDriveFiles(result.files),
      data: result,
    };
  },

  drive_download_to_sandbox: async (params) => {
    const fileId = requireString(params, 'file_id');
    const sandboxPath = requireString(params, 'sandbox_path');
    const exportMimeType = optionalString(params, 'export_mime_type') || undefined;
    const result = await driveService.downloadToSandbox(fileId, sandboxPath, exportMimeType);
    return {
      ok: true,
      output:
        `Downloaded "${result.file.name}" to sandbox path "${result.sandboxPath}" ` +
        `(${result.bytesWritten} bytes${result.exported ? `, exported as ${result.exportMimeType}` : ''}).`,
      data: {
        file: result.file,
        sandboxPath: result.sandboxPath,
        bytesWritten: result.bytesWritten,
        exported: result.exported,
        exportMimeType: result.exportMimeType,
      },
    };
  },

  drive_upload_from_sandbox: async (params) => {
    const sandboxPath = requireString(params, 'sandbox_path');
    const driveFolderId = optionalString(params, 'drive_folder_id') || 'root';
    const name = optionalString(params, 'name') || undefined;
    const mimeType = optionalString(params, 'mime_type') || undefined;
    const file = await driveService.uploadFromSandbox(sandboxPath, driveFolderId, name, mimeType);
    return {
      ok: true,
      output: `Uploaded sandbox file "${sandboxPath}" to Drive as "${file.name}" (${file.id}).`,
      data: file,
    };
  },

  drive_move_file: async (params) => {
    const fileId = requireString(params, 'file_id');
    const targetFolderId = requireString(params, 'target_folder_id');
    const file = await driveService.moveFile(fileId, targetFolderId);
    return {
      ok: true,
      output: `Moved Drive file "${file.name}" (${file.id}) to folder "${targetFolderId}".`,
      data: file,
    };
  },

  drive_create_folder: async (params) => {
    const name = requireString(params, 'name');
    const parentFolderId = optionalString(params, 'parent_folder_id') || 'root';
    const folder = await driveService.createFolder(name, parentFolderId);
    return {
      ok: true,
      output: `Created Drive folder "${folder.name}" (${folder.id}) in "${parentFolderId}".`,
      data: folder,
    };
  },

  drive_trash_file: async (params) => {
    const fileId = requireString(params, 'file_id');
    const file = await driveService.trashFile(fileId);
    return {
      ok: true,
      output: `Moved Drive file "${file.name}" (${file.id}) to the trash.`,
      data: file,
    };
  },

  drive_rename_file: async (params) => {
    const fileId = requireString(params, 'file_id');
    const newName = requireString(params, 'new_name');
    const file = await driveService.renameFile(fileId, newName);
    return {
      ok: true,
      output: `Renamed Drive file "${file.id}" to "${file.name}".`,
      data: file,
    };
  },
};
