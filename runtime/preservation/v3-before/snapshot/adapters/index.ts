import { AdapterRequestSchema, INTEGRATIONS, type AdapterRequest, type Capabilities, type IntegrationAdapter, type IntegrationId } from '../packages/connectors/src/index.js';
import { HANDLES, TenantSchema, type Tenant } from '../packages/schemas/src/index.js';
import { parseWith } from '../packages/core/src/workspace.js';
import { denyExternalAction } from '../packages/policy/src/index.js';

const VIDEO_ACTIONS = ['capture', 'storyboard', 'generateTimeline', 'render', 'generateCaptions', 'createThumbnail', 'probe', 'visualQA', 'licenseAudit'];

/** An in-process mock only. It never loads a real provider, model, renderer or credential. */
export class OfflineAdapter implements IntegrationAdapter {
  constructor(readonly id: IntegrationId, readonly mode: 'mock' | 'unavailable' = 'mock') {}
  capabilities(): Capabilities {
    return { id: this.id, status: this.mode === 'mock' ? 'MOCK_ONLY' : 'BLOCKED', network: false, liveImplemented: false,
      actions: ['ffmpeg', 'video-shotcraft', 'motion-canvas', 'playwright'].includes(this.id) ? VIDEO_ACTIONS : ['draft', 'preview', 'read', 'render'] };
  }
  identity(tenant: Tenant) {
    parseWith(TenantSchema, tenant, 'adapter tenant');
    return { tenant, expectedHandle: ['x-official', 'x-mcp', 'manual-publisher', 'mock-publisher', 'postiz', 'buffer-manual'].includes(this.id) ? HANDLES[tenant] : null,
      principalId: null, authenticated: false as const, status: 'NOT_AUTHENTICATED' as const };
  }
  costEstimate(request: AdapterRequest) {
    parseWith(AdapterRequestSchema, request, 'adapter request');
    return this.mode === 'mock'
      ? { known: true, estimatedUsd: 0, currency: 'USD' as const, basis: 'OFFLINE_NO_PROVIDER_CALL' as const }
      : { known: false, estimatedUsd: null, currency: 'USD' as const, basis: 'PROVIDER_PRICE_NOT_VERIFIED' as const };
  }
  dryRun(request: AdapterRequest) {
    const input = parseWith(AdapterRequestSchema, request, 'adapter request');
    return { tenant: input.tenant, adapterId: this.id, action: input.action,
      status: this.mode === 'mock' ? 'SYNTHETIC' as const : 'BLOCKED' as const,
      label: this.mode === 'mock' ? 'SYNTHETIC' as const : 'NOT_CONNECTED' as const,
      externalSideEffects: false as const, estimate: this.costEstimate(input),
      data: { summary: 'Phase B contract fixture only; no real content, media, account or analytics result.',
        sourceIds: input.sourceIds, inputHashes: input.inputHashes, actualProviderConnected: false } };
  }
  audit(request: AdapterRequest) {
    const input = parseWith(AdapterRequestSchema, request, 'adapter request');
    return { tenant: input.tenant, integration: this.id, action: input.action,
      mode: this.mode, sourceIds: input.sourceIds, networkCalls: 0, publicationAuthorized: false };
  }
  execute(_request: AdapterRequest): never { return denyExternalAction(); }
}

export const mockAdapter = (id: IntegrationId): IntegrationAdapter => new OfflineAdapter(id);
export const unavailableAdapter = (id: IntegrationId): IntegrationAdapter => new OfflineAdapter(id, 'unavailable');
export const integrationCatalog = () => INTEGRATIONS.map(id => ({ ...unavailableAdapter(id).capabilities(), mockAvailable: true }));
