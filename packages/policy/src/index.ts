import { ApprovalSchema, HANDLES, type Tenant } from '../../schemas/src/index.js';
import { GtmError, canonical } from '../../observability/src/index.js';

export function denyExternalAction(): never {
  throw new GtmError('EXTERNAL_WRITES_DISABLED', 'External publication, scheduling, outreach and paid provider calls are disabled', 3);
}

export function checkApproval(input: unknown, action: {
  tenant: Tenant; principalId: string; payloadSha256: string; mediaSha256: string[];
  estimatedUsd: number | null; now: string;
}): { valid: boolean; reasons: string[]; executable: false } {
  const result = ApprovalSchema.safeParse(input);
  if (!result.success) return { valid: false, reasons: ['INVALID_APPROVAL'], executable: false };
  const approval = result.data;
  const reasons: string[] = [];
  if (approval.tenant !== action.tenant) reasons.push('TENANT_MISMATCH');
  if (approval.resolved_user_id !== action.principalId || approval.expected_handle !== HANDLES[action.tenant]) reasons.push('PRINCIPAL_MISMATCH');
  if (approval.canonical_payload_sha256 !== action.payloadSha256 || canonical(approval.asset_sha256) !== canonical(action.mediaSha256)) reasons.push('PAYLOAD_CHANGED');
  const now = Date.parse(action.now);
  if (!Number.isFinite(now) || now < Date.parse(approval.approved_at) || now >= Date.parse(approval.expires_at) ||
      now < Date.parse(approval.safe_window.start) || now >= Date.parse(approval.safe_window.end) ||
      Date.parse(approval.expires_at) <= Date.parse(approval.approved_at)) reasons.push('APPROVAL_EXPIRED_OR_OUTSIDE_WINDOW');
  if (action.estimatedUsd === null || !Number.isFinite(action.estimatedUsd) || action.estimatedUsd < 0 ||
      action.estimatedUsd !== approval.price_snapshot.estimated_usd) reasons.push('PRICE_UNKNOWN_OR_CHANGED');
  if (action.estimatedUsd !== null && (action.estimatedUsd > approval.max_charge || action.estimatedUsd > 0)) reasons.push('ZERO_BUDGET_EXCEEDED');
  return { valid: reasons.length === 0, reasons, executable: false };
}
