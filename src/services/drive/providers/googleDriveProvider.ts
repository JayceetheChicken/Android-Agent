import { fetch as expoFetch, type FetchRequestInit } from 'expo/fetch';

import { DRIVE_SCOPES } from '../../../config/googleOAuth';
import * as sandboxFs from '../../storage/sandboxFs';
import {
  refreshGoogleOAuthTokens,
  revokeGoogleOAuthAccess,
  signInWithGoogleScopes,
  type GoogleOAuthTokens,
} from '../../google/oauth';
import {
  clearDriveTokens,
  loadDriveTokens,
  saveDriveTokens,
  type DriveTokens,
} from '../tokenStore';
import {
  GOOGLE_DRIVE_FOLDER_MIME,
  type DriveAccount,
  type DriveDownloadResult,
  type DriveFile,
  type DriveFileList,
  type DriveProvider,
  type DriveStatus,
} from '../types';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,parents,trashed';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_EXPORT_MIME_TYPE = 'application/pdf';

type DriveRequestInit = Omit<FetchRequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

interface ApiDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
}

interface ApiDriveFileList {
  files?: ApiDriveFile[];
  nextPageToken?: string;
}

interface ApiDriveAbout {
  user?: {
    displayName?: string;
    emailAddress?: string;
    permissionId?: string;
  };
}

// --------------------------------------------------------------- token use

function toDriveTokens(tokens: GoogleOAuthTokens): DriveTokens {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    accountEmail: null,
    accountName: null,
    accountPermissionId: null,
  };
}

async function refreshDriveTokens(tokens: DriveTokens): Promise<DriveTokens> {
  const refreshed = await refreshGoogleOAuthTokens(tokens, 'Google Drive');
  return {
    ...tokens,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
    expiresAt: refreshed.expiresAt,
  };
}

async function getValidTokens(): Promise<DriveTokens> {
  let tokens = await loadDriveTokens();
  if (!tokens) {
    throw new Error('Google Drive is not connected. Connect it on the Drive tab first.');
  }
  if (Date.now() >= tokens.expiresAt - 60_000) {
    tokens = await refreshDriveTokens(tokens);
    await saveDriveTokens(tokens);
  }
  return tokens;
}

async function readApiError(response: { text(): Promise<string> }): Promise<string> {
  const text = await response.text().catch(() => '');
  if (text.length === 0) {
    return '';
  }
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
}

async function googleFetchRaw(
  url: string,
  init: DriveRequestInit = {},
  allowRetry = true,
): Promise<Awaited<ReturnType<typeof expoFetch>>> {
  const tokens = await getValidTokens();

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Network error while calling the Google Drive API. Check your connection.');
  }

  if (response.status === 401 && allowRetry) {
    const refreshed = await refreshDriveTokens(tokens);
    await saveDriveTokens(refreshed);
    return googleFetchRaw(url, init, false);
  }

  if (!response.ok) {
    const apiMessage = await readApiError(response);
    if (response.status === 401) {
      throw new Error('Google Drive session is no longer valid. Please reconnect Drive.');
    }
    if (response.status === 403) {
      throw new Error(
        `Google Drive API access denied (403). ${apiMessage} ` +
          'Check that the Drive API is enabled and the drive scope was granted.',
      );
    }
    throw new Error(
      `Google Drive API error (HTTP ${response.status}): ${apiMessage || 'unknown error'}`,
    );
  }

  return response;
}

async function driveFetchJson<T>(path: string, init?: DriveRequestInit): Promise<T> {
  const response = await googleFetchRaw(`${DRIVE_BASE}${path}`, init);
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function driveFetchBytes(path: string, init?: DriveRequestInit): Promise<Uint8Array> {
  const response = await googleFetchRaw(`${DRIVE_BASE}${path}`, init);
  return response.bytes();
}

async function uploadFetchJson<T>(path: string, init?: DriveRequestInit): Promise<T> {
  const response = await googleFetchRaw(`${DRIVE_UPLOAD_BASE}${path}`, init);
  return (await response.json()) as T;
}

// --------------------------------------------------------------- utilities

function normalizePageSize(pageSize?: number): number {
  if (pageSize === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
}

function filePath(fileId: string): string {
  return `/files/${encodeURIComponent(fileId)}`;
}

function normalizeDriveFile(file: ApiDriveFile): DriveFile {
  if (!file.id || !file.name || !file.mimeType) {
    throw new Error('Google Drive returned an incomplete file resource.');
  }
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: typeof file.size === 'string' ? file.size : null,
    modifiedTime: typeof file.modifiedTime === 'string' ? file.modifiedTime : null,
    parents: Array.isArray(file.parents) ? file.parents.filter((p) => typeof p === 'string') : [],
    trashed: file.trashed === true,
  };
}

function normalizeFileList(list: ApiDriveFileList): DriveFileList {
  return {
    files: (list.files ?? []).map(normalizeDriveFile),
    nextPageToken: list.nextPageToken,
  };
}

function driveFieldsParam(fields = DRIVE_FILE_FIELDS): string {
  return fields;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function stripTokenQuotes(token: string): string {
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}

function buildSearchQuery(input: string): string {
  const rawTokens = input.trim().match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  const terms: string[] = [];
  const filters: string[] = [];
  let trashedClause = 'trashed = false';

  for (const rawToken of rawTokens) {
    const token = stripTokenQuotes(rawToken);
    const lower = token.toLowerCase();
    if (lower === 'type:folder') {
      filters.push(`mimeType = '${GOOGLE_DRIVE_FOLDER_MIME}'`);
      continue;
    }
    if (lower.startsWith('mimetype:') || lower.startsWith('mimetype=')) {
      const value = token.slice(token.indexOf(lower.includes(':') ? ':' : '=') + 1).trim();
      if (value.length > 0) {
        filters.push(`mimeType = '${escapeDriveQueryValue(value)}'`);
      }
      continue;
    }
    if (lower === 'trashed:true') {
      trashedClause = 'trashed = true';
      continue;
    }
    if (lower === 'trashed:false') {
      trashedClause = 'trashed = false';
      continue;
    }
    if (lower === 'trashed:any') {
      trashedClause = '';
      continue;
    }
    terms.push(token);
  }

  const textQuery = terms.join(' ').trim();
  if (textQuery.length > 0) {
    const safe = escapeDriveQueryValue(textQuery);
    filters.push(`(name contains '${safe}' or fullText contains '${safe}')`);
  }
  if (trashedClause.length > 0) {
    filters.push(trashedClause);
  }
  return filters.length > 0 ? filters.join(' and ') : 'trashed = false';
}

function isGoogleWorkspaceFile(file: DriveFile): boolean {
  return (
    file.mimeType.startsWith('application/vnd.google-apps.') &&
    file.mimeType !== GOOGLE_DRIVE_FOLDER_MIME
  );
}

function ensureNotFolder(file: DriveFile): void {
  if (file.mimeType === GOOGLE_DRIVE_FOLDER_MIME) {
    throw new Error('Folders cannot be downloaded as files.');
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function buildMultipartBody(metadata: object, bytes: Uint8Array, mimeType: string): {
  boundary: string;
  body: Blob;
} {
  const boundary = `android-agent-drive-${Date.now().toString(36)}`;
  const metadataHeader =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  return {
    boundary,
    body: new Blob([metadataHeader, mediaHeader, toArrayBuffer(bytes), closing], {
      type: `multipart/related; boundary=${boundary}`,
    }),
  };
}

const COMMON_MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
};

function guessMimeType(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0) {
    return 'application/octet-stream';
  }
  return COMMON_MIME_TYPES[name.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

function toAccount(tokens: DriveTokens): DriveAccount {
  return {
    id: tokens.accountPermissionId ?? 'google-drive-account',
    provider: 'google-drive',
    address: tokens.accountEmail ?? 'Google Drive',
    displayName: tokens.accountName,
    connected: true,
  };
}

async function fetchAccountAndPersist(): Promise<DriveAccount> {
  const about = await driveFetchJson<ApiDriveAbout>('/about?fields=user');
  const tokens = await getValidTokens();
  const updated: DriveTokens = {
    ...tokens,
    accountEmail: about.user?.emailAddress ?? tokens.accountEmail,
    accountName: about.user?.displayName ?? tokens.accountName,
    accountPermissionId: about.user?.permissionId ?? tokens.accountPermissionId,
  };
  await saveDriveTokens(updated);
  return toAccount(updated);
}

async function getFileMetadata(fileId: string, fields = DRIVE_FILE_FIELDS): Promise<DriveFile> {
  const params = new URLSearchParams({ fields: driveFieldsParam(fields) });
  return normalizeDriveFile(
    await driveFetchJson<ApiDriveFile>(`${filePath(fileId)}?${params.toString()}`),
  );
}

// ---------------------------------------------------------------- provider

export const googleDriveProvider: DriveProvider = {
  async connect(): Promise<DriveAccount> {
    const tokens = toDriveTokens(await signInWithGoogleScopes(DRIVE_SCOPES));
    await saveDriveTokens(tokens);
    return fetchAccountAndPersist();
  },

  async disconnect(): Promise<void> {
    const tokens = await loadDriveTokens();
    if (tokens) {
      await revokeGoogleOAuthAccess(tokens);
    }
    await clearDriveTokens();
  },

  async getStatus(): Promise<DriveStatus> {
    const tokens = await loadDriveTokens();
    return {
      connected: tokens !== null,
      account: tokens ? toAccount(tokens) : null,
    };
  },

  async listFiles(folderId = 'root', pageSize?: number): Promise<DriveFileList> {
    const folder = folderId.trim().length > 0 ? folderId.trim() : 'root';
    const params = new URLSearchParams({
      pageSize: String(normalizePageSize(pageSize)),
      fields: `files(${DRIVE_FILE_FIELDS}),nextPageToken`,
      orderBy: 'folder,name',
      q: `'${escapeDriveQueryValue(folder)}' in parents and trashed = false`,
    });
    return normalizeFileList(await driveFetchJson<ApiDriveFileList>(`/files?${params.toString()}`));
  },

  async searchFiles(query: string, pageSize?: number): Promise<DriveFileList> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new Error('Search query must not be empty.');
    }
    const params = new URLSearchParams({
      pageSize: String(normalizePageSize(pageSize)),
      fields: `files(${DRIVE_FILE_FIELDS}),nextPageToken`,
      orderBy: 'folder,name',
      q: buildSearchQuery(trimmed),
    });
    return normalizeFileList(await driveFetchJson<ApiDriveFileList>(`/files?${params.toString()}`));
  },

  async downloadToSandbox(
    fileId: string,
    sandboxPath: string,
    exportMimeType?: string,
  ): Promise<DriveDownloadResult> {
    if (await sandboxFs.existsInSandbox(sandboxPath)) {
      throw new Error(`Destination already exists in the sandbox: "${sandboxPath}"`);
    }

    const file = await getFileMetadata(fileId);
    ensureNotFolder(file);

    const exported = isGoogleWorkspaceFile(file);
    const bytes = exported
      ? await driveFetchBytes(
          `${filePath(fileId)}/export?${new URLSearchParams({
            mimeType: exportMimeType?.trim() || DEFAULT_EXPORT_MIME_TYPE,
          }).toString()}`,
        )
      : await driveFetchBytes(`${filePath(fileId)}?alt=media`);

    await sandboxFs.writeBinaryFile(sandboxPath, bytes);
    return {
      file,
      sandboxPath,
      bytesWritten: bytes.byteLength,
      exported,
      exportMimeType: exported ? exportMimeType?.trim() || DEFAULT_EXPORT_MIME_TYPE : null,
    };
  },

  async uploadFromSandbox(
    sandboxPath: string,
    driveFolderId = 'root',
    name?: string,
    mimeType?: string,
  ): Promise<DriveFile> {
    const info = await sandboxFs.getFileInfo(sandboxPath);
    const bytes = await sandboxFs.readBinaryFile(sandboxPath);
    const targetName = name?.trim() || info.name;
    if (targetName.length === 0) {
      throw new Error('Drive upload name must not be empty.');
    }
    const targetMimeType = mimeType?.trim() || info.mimeType || guessMimeType(targetName);
    const folderId = driveFolderId.trim().length > 0 ? driveFolderId.trim() : 'root';
    const metadata = { name: targetName, parents: [folderId] };
    const multipart = buildMultipartBody(metadata, bytes, targetMimeType);
    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: DRIVE_FILE_FIELDS,
    });
    return normalizeDriveFile(
      await uploadFetchJson<ApiDriveFile>(`/files?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${multipart.boundary}` },
        body: multipart.body,
      }),
    );
  },

  async moveFile(fileId: string, targetFolderId: string): Promise<DriveFile> {
    const target = targetFolderId.trim();
    if (target.length === 0) {
      throw new Error('Target folder id must not be empty.');
    }
    const current = await getFileMetadata(fileId, 'id,name,mimeType,size,modifiedTime,parents,trashed');
    const removeParents = current.parents.filter((parent) => parent !== target).join(',');
    const params = new URLSearchParams({
      addParents: target,
      fields: DRIVE_FILE_FIELDS,
    });
    if (removeParents.length > 0) {
      params.set('removeParents', removeParents);
    }
    return normalizeDriveFile(
      await driveFetchJson<ApiDriveFile>(`${filePath(fileId)}?${params.toString()}`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
    );
  },

  async createFolder(name: string, parentFolderId = 'root'): Promise<DriveFile> {
    const folderName = name.trim();
    if (folderName.length === 0) {
      throw new Error('Folder name must not be empty.');
    }
    const parent = parentFolderId.trim().length > 0 ? parentFolderId.trim() : 'root';
    const params = new URLSearchParams({ fields: DRIVE_FILE_FIELDS });
    return normalizeDriveFile(
      await driveFetchJson<ApiDriveFile>(`/files?${params.toString()}`, {
        method: 'POST',
        body: JSON.stringify({
          name: folderName,
          mimeType: GOOGLE_DRIVE_FOLDER_MIME,
          parents: [parent],
        }),
      }),
    );
  },

  async trashFile(fileId: string): Promise<DriveFile> {
    const params = new URLSearchParams({ fields: DRIVE_FILE_FIELDS });
    return normalizeDriveFile(
      await driveFetchJson<ApiDriveFile>(`${filePath(fileId)}?${params.toString()}`, {
        method: 'PATCH',
        body: JSON.stringify({ trashed: true }),
      }),
    );
  },

  async renameFile(fileId: string, newName: string): Promise<DriveFile> {
    const name = newName.trim();
    if (name.length === 0) {
      throw new Error('New Drive file name must not be empty.');
    }
    const params = new URLSearchParams({ fields: DRIVE_FILE_FIELDS });
    return normalizeDriveFile(
      await driveFetchJson<ApiDriveFile>(`${filePath(fileId)}?${params.toString()}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    );
  },
};
