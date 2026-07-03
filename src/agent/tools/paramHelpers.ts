import type { ToolParams } from '../../types/tools';

/** Read a required string parameter from an LLM-produced params object. */
export function requireString(params: ToolParams, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing or invalid parameter "${key}" (expected non-empty string).`);
  }
  return value;
}

/** Read an optional string parameter, defaulting to "". */
export function optionalString(params: ToolParams, key: string): string {
  const value = params[key];
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(`Invalid parameter "${key}" (expected string).`);
  }
  return value;
}
