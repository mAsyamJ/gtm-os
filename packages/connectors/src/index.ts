import { z } from 'zod';
import { DataSchema, HashSchema, IdSchema, TenantSchema, type Data, type Tenant } from '../../schemas/src/index.js';

export const INTEGRATIONS = [
  'local-fixture', 'x-official', 'x-mcp', 'manual-publisher', 'mock-publisher', 'postiz', 'buffer-manual',
  'github', 'playwright', 'crawl4ai', 'rss', 'posthog', 'umami', 'search-console', 'ga4',
  'satori-sharp', 'ffmpeg', 'video-shotcraft', 'motion-canvas', 'comfyui', 'whisper-local', 'piper-tts', 'model-router',
] as const;
export type IntegrationId = typeof INTEGRATIONS[number];
export const AdapterRequestSchema = z.strictObject({
  tenant: TenantSchema, jobId: IdSchema, action: IdSchema,
  sourceIds: z.array(IdSchema).nonempty(), inputHashes: z.array(HashSchema), parameters: DataSchema,
});
export type AdapterRequest = z.infer<typeof AdapterRequestSchema>;
export interface Capabilities { id: IntegrationId; status: 'MOCK_ONLY' | 'BLOCKED'; network: false; liveImplemented: false; actions: string[] }
export interface Identity { tenant: Tenant; expectedHandle: string | null; principalId: null; authenticated: false; status: 'NOT_AUTHENTICATED' }
export interface Estimate { known: boolean; estimatedUsd: number | null; currency: 'USD'; basis: 'OFFLINE_NO_PROVIDER_CALL' | 'PROVIDER_PRICE_NOT_VERIFIED' }
export interface AdapterReceipt {
  tenant: Tenant; adapterId: IntegrationId; action: string; status: 'SYNTHETIC' | 'BLOCKED';
  label: 'SYNTHETIC' | 'NOT_CONNECTED'; data: Data; externalSideEffects: false; estimate: Estimate;
}
export interface IntegrationAdapter {
  capabilities(): Capabilities;
  identity(tenant: Tenant): Identity;
  costEstimate(request: AdapterRequest): Estimate;
  dryRun(request: AdapterRequest): AdapterReceipt;
  audit(request: AdapterRequest): Data;
  execute(request: AdapterRequest): never;
}
