import { z } from 'zod';
import { HashSchema, IdSchema, TenantSchema, TimeSchema, HANDLES, type Tenant } from '../../schemas/src/index.js';
import { GtmError, hashObject } from '../../observability/src/index.js';

export const PostingDay = z.object({day:z.enum(['mon','tue','wed','thu','fri','sat','sun']),paused:z.boolean(),times:z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).max(48)});
export const Channel = z.object({ principalId: z.string().min(1), organizationId: z.string().min(1), id: z.string().min(1),
  name: z.string(), service: z.literal('twitter'), serviceId: z.string().min(1), isQueuePaused: z.literal(false),
  isDisconnected: z.literal(false), isLocked: z.literal(false), allowedActions: z.array(z.string()), verifiedAt: TimeSchema,
  timezone:z.string().optional(), postingSchedule:z.array(PostingDay).max(7).optional() });
export type Channel = z.infer<typeof Channel>;
export function assertChannel(tenant: Tenant, value: unknown): Channel {
  const channel = Channel.parse(value);
  if (channel.name.replace(/^@/, '').toLowerCase() !== HANDLES[tenant].toLowerCase() || !channel.allowedActions.includes('scheduleUpdates'))
    throw new GtmError('ACCOUNT_MISMATCH', 'Exact connected X handle and scheduling permission required', 3);
  return channel;
}
export const EvidenceRef = z.strictObject({ evidenceId: IdSchema, evidenceSha256: HashSchema, reviewSha256: HashSchema, statement: z.string().min(1).max(1500) });
export const PacketInput = z.strictObject({ tenant: TenantSchema, text: z.string().min(1).max(10000),
  evidence: z.array(EvidenceRef).min(1).max(30), firstPersonExperience: z.boolean(),
  media: z.array(z.strictObject({ path: z.string(), sha256: HashSchema, license: z.string().min(1), rightsReviewed: z.literal(true) })).max(4).default([]) });
export const Packet = PacketInput.extend({ id: IdSchema, contentHash: HashSchema, governanceHash: HashSchema, createdAt: TimeSchema });
export type Packet = z.infer<typeof Packet>;
export const Envelope = z.strictObject({ schemaVersion: z.literal(5), tenant: TenantSchema, provider: z.literal('buffer'),
  account: z.string(), channel: Channel, packetId: IdSchema, contentHash: HashSchema, governanceHash: HashSchema,
  text: z.string(), evidence: z.array(EvidenceRef), media: PacketInput.shape.media,
  dueAt: TimeSchema, targetZone: z.string(), localSlot: z.string(), maxCostUsd: z.literal(0) });
export type Envelope = z.infer<typeof Envelope>;
export const ApprovalInput = z.strictObject({ tenant: TenantSchema, jobId: IdSchema, payloadSha256: HashSchema,
  actor: z.literal('owner'), ownerIdentity: z.literal('Muhammad Asyam Jayanegara'), at: TimeSchema, expiresAt: TimeSchema,
  editorialReviewed: z.literal(true), authenticityReviewed: z.literal(true), rightsReviewed: z.literal(true),
  event: z.enum(['APPROVE', 'REVOKE', 'APPROVE_CANCEL']), ownerConfirmationRef: z.string().min(8).max(500) });
export type ApprovalInput = z.infer<typeof ApprovalInput>;
export const STATES = ['DRAFT','REVIEWED','APPROVAL_PENDING','APPROVED','SUBMITTING','SCHEDULED','SENT','MEASURED',
  'HOLD','CANCELLED','RECONCILE_REQUIRED','FAILED','EXTERNAL_URL_PENDING'] as const;
export type State = typeof STATES[number];
export interface Job { id: string; tenant: Tenant; envelope: Envelope; payloadSha256: string; state: State;
  providerPostId: string | null; leaseOwner: string | null; leaseUntil: number | null; version: number }
export const ProviderPost = z.object({ id: z.string().min(1), channelId: z.string().min(1), text: z.string(),
  status: z.enum(['draft','error','needs_approval','scheduled','sending','sent']), dueAt: TimeSchema.nullable(), sentAt: TimeSchema.nullable(),
  externalLink: z.string().nullable(), metricsUpdatedAt: TimeSchema.nullable().default(null),
  metrics: z.array(z.object({ type: z.string(), name: z.string(), value: z.number().finite().nullable(), unit: z.string() })).nullable().default(null),
  assets: z.array(z.object({ id: z.string() })).default([]) });
export type ProviderPost = z.infer<typeof ProviderPost>;
export interface PublisherAdapter {
  readonly provider: 'buffer'; readonly synthetic: boolean;
  discoverChannels(tenant: Tenant): Promise<Channel[]>;
  probe(tenant: Tenant): Promise<{ status: string; channels: Channel[] }>;
  schedule(envelope: Envelope): Promise<ProviderPost>;
  getScheduled(channel: Channel): Promise<ProviderPost[]>;
  getSent(channel: Channel): Promise<ProviderPost[]>;
  getPostMetrics(id: string): Promise<ProviderPost>;
  reconcile(id: string): Promise<ProviderPost>;
  cancel(id: string): Promise<{ id: string }>;
}
export function contentHash(input: z.infer<typeof PacketInput>) { return hashObject(input); }
