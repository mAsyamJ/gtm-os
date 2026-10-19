import { createHash } from 'node:crypto';

export type ExitCode = 2 | 3 | 4 | 5 | 6;
export class GtmError extends Error {
  constructor(public readonly code: string, message: string, public readonly exitCode: ExitCode = 5) {
    super(message);
    this.name = 'GtmError';
  }
}

export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) throw new GtmError('UNSAFE_KEY', 'Unsafe object key');
    return '{' + keys.map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  throw new GtmError('INVALID_JSON', 'Only finite JSON data is accepted');
}

export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hashObject = (value: unknown): string => sha256(canonical(value));

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
      /password|secret|authorization|cookie|api[_-]?key|^token$|access[_-]?token|refresh[_-]?token|wallet|email/i.test(key)
        ? '[REDACTED]' : redact(v)]));
  }
  if (typeof value === 'string') return value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:access_token|refresh_token|api_key|token|secret|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\bsk-[a-zA-Z0-9_-]{12,}/g, '[REDACTED]')
    .replace(/\b0x[a-fA-F0-9]{40}\b/g, '[REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED]');
  return value;
}

export function publicError(error: unknown): { code: string; message: string; exitCode: ExitCode } {
  if (error instanceof GtmError) return { code: error.code, message: String(redact(error.message)), exitCode: error.exitCode };
  return { code: 'EXECUTION_FAILURE', message: 'Local operation failed; no raw exception or input was logged', exitCode: 6 };
}
