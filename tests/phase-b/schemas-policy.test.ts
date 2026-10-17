import { describe, expect, test } from 'vitest';
import { ApprovalSchema, DefaultsSchema, SourceSchema, TenantSchema } from '../../packages/schemas/src/index.js';
import { canonical, hashObject, publicError, redact } from '../../packages/observability/src/index.js';
import { parseYaml, readStructured, readText, safePath } from '../../packages/core/src/workspace.js';
import { writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { checkApproval, denyExternalAction } from '../../packages/policy/src/index.js';
import { source, workspace } from './helpers.js';

describe('typed boundaries and redaction', () => {
  test.each(['', 'other', '../founder', undefined])('rejects invalid tenant %s', tenant => expect(TenantSchema.safeParse(tenant).success).toBe(false));
  test('rejects extra source fields and invalid content shape', () => {
    expect(SourceSchema.safeParse({ ...source(), secret: 'not-allowed' }).success).toBe(false);
    expect(SourceSchema.safeParse({ ...source(), expiresAt: '2020-01-01T00:00:00Z' }).success).toBe(false);
  });
  test('canonical hashes ignore key insertion order', () => expect(hashObject({ b: 2, a: 1 })).toBe(hashObject({ a: 1, b: 2 })));
  test.each([NaN, undefined, () => null])('rejects non-JSON values', value => expect(() => canonical(value)).toThrow());
  test('rejects prototype keys', () => expect(() => canonical(JSON.parse('{"__proto__":{}}'))).toThrow());
  test('redacts nested keys and sensitive string forms', () => {
    const result = JSON.stringify(redact({ nested: { password: 'private', accessToken: 'token-value' },
      text: 'Bearer abcdef sk-abcdefghijklmnop wallet 0x' + 'a'.repeat(40), email: 'example@example.com' }));
    expect(result).not.toContain('private'); expect(result).not.toContain('token-value');
    expect(result).not.toContain('abcdefghijklmnop'); expect(result).not.toContain('a'.repeat(40));
    expect(result).not.toContain('example@example.com');
  });
  test('raw exceptions are not exposed', () => expect(JSON.stringify(publicError(new Error('private-value')))).not.toContain('private-value'));
  test.each(['a: 1\na: 2', 'a: &a [*a]', 'a: !!js/function hello'])('rejects unsafe YAML', text => expect(() => parseYaml(text)).toThrow());
  test('supports folded multiline YAML', () => expect(parseYaml('a: >\n  hello\n  world\n')).toEqual({ a: 'hello world\n' }));
  test('unsafe defaults cannot be parsed', () => expect(DefaultsSchema.safeParse({ publish_enabled: true }).success).toBe(false));
  test('credential paths are denied before reading contents', () => {
    const fixture = workspace();
    try {
      writeFileSync(join(fixture.root, '.env'), 'PRIVATE_TEST_VALUE');
      expect(() => readText(fixture.root, '.env')).toThrow('forbidden');
      expect(() => readText(fixture.root, 'config/credentials.json')).toThrow('forbidden');
    } finally { fixture.cleanup(); }
  });
  test('duplicate JSON keys cannot hide conflicting values', () => {
    const fixture = workspace();
    try {
      writeFileSync(join(fixture.root, 'config/example.json'), '{"a":1,"a":2}');
      expect(() => readStructured(fixture.root, 'config/example.json')).toThrow('YAML');
    } finally { fixture.cleanup(); }
  });
  test('broken output symlinks are rejected', () => {
    const fixture = workspace();
    try {
      symlinkSync(join(fixture.root, 'nonexistent'), join(fixture.root, 'runtime'), 'dir');
      expect(() => safePath(fixture.root, 'runtime/state/founder')).toThrow('Symlink');
    } finally { fixture.cleanup(); }
  });
  test('secret-like URL parameters are redacted', () => expect(redact('https://example.invalid/?token=private-value')).not.toContain('private-value'));
});

const approval = {
  id: 'approval_example', tenant: 'retropick', platform: 'x', resolved_user_id: 'principal_example',
  expected_handle: 'RetroPickMarket', asset_sha256: [], canonical_payload_sha256: 'a'.repeat(64),
  action_type: 'publish', approved_at: '2026-10-17T00:00:00Z', expires_at: '2026-10-18T00:00:00Z',
  actor: 'ILLUSTRATIVE_NOT_SIGNED', price_snapshot: { id: 'offline_price', known: true, estimated_usd: 0 },
  max_charge: 0, safe_window: { start: '2026-10-17T00:00:00Z', end: '2026-10-18T00:00:00Z' },
};
const action = { tenant: 'retropick' as const, principalId: 'principal_example', payloadSha256: 'a'.repeat(64),
  mediaSha256: [], estimatedUsd: 0, now: '2026-10-17T12:00:00Z' };

describe('offline approval evaluator never executes', () => {
  test('accepts illustrative schema, returns executable false', () => {
    expect(ApprovalSchema.safeParse(approval).success).toBe(true);
    expect(checkApproval(approval, action)).toEqual({ valid: true, reasons: [], executable: false });
  });
  test('default execution always denies even after approval evaluation', () => expect(denyExternalAction).toThrow('disabled'));
  test.each([
    [{ ...action, tenant: 'founder' as const }, 'TENANT_MISMATCH'],
    [{ ...action, principalId: 'wrong' }, 'PRINCIPAL_MISMATCH'],
    [{ ...action, payloadSha256: 'b'.repeat(64) }, 'PAYLOAD_CHANGED'],
    [{ ...action, mediaSha256: ['b'.repeat(64)] }, 'PAYLOAD_CHANGED'],
    [{ ...action, now: '2026-10-19T00:00:00Z' }, 'APPROVAL_EXPIRED_OR_OUTSIDE_WINDOW'],
    [{ ...action, estimatedUsd: null }, 'PRICE_UNKNOWN_OR_CHANGED'],
    [{ ...action, estimatedUsd: 0.01 }, 'ZERO_BUDGET_EXCEEDED'],
  ])('rejects changed boundary %s', (changed, reason) => expect(checkApproval(approval, changed).reasons).toContain(reason));
});
