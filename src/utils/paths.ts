/**
 * Path validation for the file sandbox.
 *
 * Every path coming from the agent or the UI is relative to the sandbox root.
 * This function rejects anything that could escape the sandbox
 * (absolute paths, drive letters, `..` segments, URI schemes).
 */
const INVALID_SEGMENT_CHARS = ['<', '>', ':', '"', '|', '?', '*'];

export function sanitizeSandboxPath(input: string): string {
  const normalized = input.trim().replace(/\\/g, '/');

  if (normalized.includes('://') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Absolute paths or URIs are not allowed: "${input}"`);
  }
  if (normalized.startsWith('/')) {
    throw new Error(`Paths must be relative to the sandbox root: "${input}"`);
  }

  const segments = normalized.split('/').filter((s) => s.length > 0);
  for (const segment of segments) {
    if (segment === '..') {
      throw new Error(`Path traversal ("..") is not allowed: "${input}"`);
    }
    if (segment === '.') {
      continue;
    }
    if (INVALID_SEGMENT_CHARS.some((c) => segment.includes(c))) {
      throw new Error(`Invalid characters in path segment: "${segment}"`);
    }
  }

  return segments.filter((s) => s !== '.').join('/');
}

/** Split a sanitized relative path into segments (empty array = sandbox root). */
export function toSegments(sanitizedPath: string): string[] {
  return sanitizedPath.length === 0 ? [] : sanitizedPath.split('/');
}

/** Join relative sandbox paths (already sanitized). */
export function joinSandboxPath(...parts: string[]): string {
  return parts.filter((p) => p.length > 0).join('/');
}
