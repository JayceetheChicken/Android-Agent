export const GOOGLE_DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveAccount {
  id: string;
  provider: 'google-drive';
  address: string;
  displayName: string | null;
  connected: boolean;
}

export interface DriveStatus {
  connected: boolean;
  account: DriveAccount | null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  modifiedTime: string | null;
  parents: string[];
  trashed: boolean;
}

export interface DriveFileList {
  files: DriveFile[];
  nextPageToken?: string;
}

export interface DriveDownloadResult {
  file: DriveFile;
  sandboxPath: string;
  bytesWritten: number;
  exported: boolean;
  exportMimeType: string | null;
}

export interface DriveProvider {
  connect(): Promise<DriveAccount>;
  disconnect(): Promise<void>;
  getStatus(): Promise<DriveStatus>;
  listFiles(folderId?: string, pageSize?: number): Promise<DriveFileList>;
  searchFiles(query: string, pageSize?: number): Promise<DriveFileList>;
  downloadToSandbox(
    fileId: string,
    sandboxPath: string,
    exportMimeType?: string,
  ): Promise<DriveDownloadResult>;
  uploadFromSandbox(
    sandboxPath: string,
    driveFolderId?: string,
    name?: string,
    mimeType?: string,
  ): Promise<DriveFile>;
  moveFile(fileId: string, targetFolderId: string): Promise<DriveFile>;
  createFolder(name: string, parentFolderId?: string): Promise<DriveFile>;
  trashFile(fileId: string): Promise<DriveFile>;
  renameFile(fileId: string, newName: string): Promise<DriveFile>;
}
