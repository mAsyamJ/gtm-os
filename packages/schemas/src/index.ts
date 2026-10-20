import { z } from 'zod';

export const TenantSchema = z.enum(['retropick', 'founder']);
export type Tenant = z.infer<typeof TenantSchema>;
export const TENANTS = TenantSchema.options;
export const HANDLES: Record<Tenant, string> = { retropick: 'RetroPickMarket', founder: 'iHateModelsss' };
export const IdSchema = z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const TimeSchema = z.iso.datetime({ offset: true });
export const DataSchema = z.record(z.string(), z.json());
export type Data = z.infer<typeof DataSchema>;

export const DefaultsSchema = z.strictObject({
  publish_enabled: z.literal(false), external_writes: z.literal(false), paid_api_enabled: z.literal(false),
  x_monthly_hard_cap_usd: z.literal(0), ads_enabled: z.literal(false), auto_reply_enabled: z.literal(false),
  auto_dm_enabled: z.literal(false), auto_follow_enabled: z.literal(false), mock_mode: z.literal(true),
});
export const FlagsSchema = z.strictObject({
  x_live_auth: z.literal(false), x_auto_publish: z.literal(false), postiz: z.literal(false),
  activepieces: z.literal(false), video_shotcraft: z.literal(false), comfyui: z.literal(false),
  penpot: z.literal(false), posthog_live: z.literal(false),
});
export const ProfileSchema = z.strictObject({
  id: TenantSchema, display_name: z.string().min(1), expected_x_handle: z.string().min(1),
  source_of_truth: z.url(), status: z.literal('provisional_requires_first_party_verification'),
  publication_enabled: z.literal(false),
});
export const SkillSchema = z.object({
  name: IdSchema.max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(1).max(1024),
});
export const StageSchema = z.strictObject({
  id: IdSchema, tool: z.enum(['manual','project_adapter']), skill: IdSchema,
  input: z.string().min(1), output: z.string().min(1), acceptance: z.string().min(1),
});
export const WorkflowSchema = z.strictObject({
  id: IdSchema, version: z.number().int().positive(), description: z.string().min(1), trigger: z.string().min(1),
  owner: IdSchema, tenant: z.literal('REQUIRED_AT_RUNTIME'), risk_tier: z.string().min(1),
  inputs: z.array(z.string().min(1)).nonempty(), stages: z.array(StageSchema).nonempty(),
  outputs: z.string().min(1), approval_gate: z.literal('HUMAN_APPROVAL_REQUIRED_PER_EXTERNAL_ACTION'),
  cost_policy: z.literal('DEFAULT_ZERO_PAID_API_SPEND'), retry_policy: z.string().min(1),
  resume_checkpoint: z.string().min(1), compensation: z.string().min(1), metrics: z.array(z.string()).nonempty(),
  terminal_states: z.array(z.enum(['COMPLETED_LOCAL', 'AWAITING_APPROVAL', 'BLOCKED', 'FAILED', 'CANCELLED'])).nonempty(),
}).refine(w => new Set(w.stages.map(s => s.id)).size === w.stages.length, 'Duplicate stage identifiers')
  .refine(w=>w.stages.every(s=>s.tool==='manual'||w.version===4),'Project adapters require V4 workflow version');
export type Workflow = z.infer<typeof WorkflowSchema>;

export const SourceSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, uri: z.string().min(1), revision: z.string().min(1),
  observedAt: TimeSchema, expiresAt: TimeSchema, contentSha256: HashSchema,
  classification: z.enum(['SYNTHETIC', 'FIRST_PARTY', 'EXTERNAL']), license: z.string().min(1), body: DataSchema,
}).refine(s => Date.parse(s.expiresAt) > Date.parse(s.observedAt), 'Invalid source validity window');
export type Source = z.infer<typeof SourceSchema>;

export const JobStateSchema = z.enum(['PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'COMPLETED_LOCAL', 'BLOCKED', 'FAILED', 'CANCELLED']);
export type JobState = z.infer<typeof JobStateSchema>;
export const JobSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, workflowId: IdSchema, definitionSha256: HashSchema,
  inputSha256: HashSchema, idempotencyKey: IdSchema, state: JobStateSchema,
  checkpoint: z.number().int().nonnegative(), version: z.number().int().nonnegative(),
  sourceIds: z.array(IdSchema).nonempty(), createdAt: TimeSchema, updatedAt: TimeSchema,
  offline: z.literal(true), synthetic: z.literal(true),
});
export type Job = z.infer<typeof JobSchema>;
export const ArtifactPayloadSchema = z.strictObject({
  id: IdSchema, revision: z.literal('phase-b-r1'), tenant: TenantSchema, jobId: IdSchema, stageId: IdSchema, skill: IdSchema,
  sourceIds: z.array(IdSchema).nonempty(), inputArtifactHashes: z.array(HashSchema),
  createdAt: TimeSchema, label: z.literal('SYNTHETIC'), format: z.literal('application/json'),
  approvalStatus: z.literal('NOT_APPROVED'), audience: z.string().min(1),
  assetLicense: z.literal('NO_EXTERNAL_ASSETS'), data: DataSchema,
  limitations: z.array(z.string()).nonempty(),
});
export type ArtifactPayload = z.infer<typeof ArtifactPayloadSchema>;
export const ArtifactSchema = ArtifactPayloadSchema.extend({ sha256: HashSchema, relativePath: z.string().min(1) });
export type Artifact = z.infer<typeof ArtifactSchema>;
export const CostSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, jobId: IdSchema, stageId: IdSchema,
  estimatedUsd: z.literal(0), actualUsd: z.literal(0), currency: z.literal('USD'),
  basis: z.literal('OFFLINE_NO_PROVIDER_CALL'), modelTokens: z.null(), computeCost: z.literal('NOT_MEASURED'),
});
export type Cost = z.infer<typeof CostSchema>;
export const OutboxSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, jobId: IdSchema, stageId: IdSchema,
  status: z.literal('BLOCKED'), reason: z.literal('EXTERNAL_WRITES_DISABLED'), payloadSha256: HashSchema, approval: z.null(),
});
export type Outbox = z.infer<typeof OutboxSchema>;
export const AuditEventSchema = z.strictObject({
  seq: z.number().int().positive(), tenant: TenantSchema, jobId: IdSchema.nullable(),
  kind: IdSchema, at: TimeSchema, data: DataSchema, previousHash: HashSchema, hash: HashSchema,
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const ClaimSchema = z.strictObject({
  claim_id: IdSchema, tenant: TenantSchema, statement: z.string().min(1), classification: z.string().min(1),
  source_uri: z.url(), source_revision: z.string().min(1), observed_at: TimeSchema, expires_at: TimeSchema,
  verification_method: z.string().min(1), review_status: z.enum(['UNVERIFIED', 'VERIFIED', 'OWNER_APPROVED', 'REJECTED']),
  risk_tier: z.string().min(1), permitted_channels: z.array(z.string().min(1)).nonempty(),
  owner_approval: z.string().min(1).nullable(),
});
export const ClaimsLedgerSchema = z.strictObject({ tenant: TenantSchema, approval_required: z.literal(true), claims: z.array(ClaimSchema) });

export const ApprovalSchema = z.strictObject({
  id: IdSchema, tenant: TenantSchema, platform: z.literal('x'), resolved_user_id: IdSchema,
  expected_handle: z.string().min(1), asset_sha256: z.array(HashSchema), canonical_payload_sha256: HashSchema,
  action_type: z.literal('publish'), approved_at: TimeSchema, expires_at: TimeSchema, actor: z.string().min(1),
  price_snapshot: z.strictObject({ id: IdSchema, known: z.literal(true), estimated_usd: z.number().finite().nonnegative() }),
  max_charge: z.number().finite().nonnegative(), safe_window: z.strictObject({ start: TimeSchema, end: TimeSchema }),
});
export type Approval = z.infer<typeof ApprovalSchema>;
