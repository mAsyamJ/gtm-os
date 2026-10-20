import { z } from 'zod';
import { HashSchema, IdSchema, TenantSchema, TimeSchema } from '../../../schemas/src/index.js';
import { EvidenceClass, Dataset } from '../common.js';

export const KINDS = ['entity', 'edge', 'source', 'collection', 'trend', 'opportunity', 'brief', 'campaign', 'model-run'] as const;
export const EntityType = z.enum(['Project','Person','Researcher','Founder','Developer','Trader','MarketMaker','Venue','Protocol','Mechanism','AssetClass','ContentSource','Topic','Claim','Relationship','Opportunity','Campaign']);
export const Base = z.object({ id: IdSchema, tenant: TenantSchema, dataset: Dataset, schemaVersion: z.literal(4),
  label: EvidenceClass, createdAt: TimeSchema }).passthrough();
export const Entity = Base.extend({ canonicalId: IdSchema, types: z.array(EntityType).nonempty(), name: z.string().min(1).max(240),
  organization: z.string().max(240), topics: z.array(z.string().max(240)), sourceUrls: z.array(z.url()),
  identityStatus: z.enum(['UNVERIFIED','REVIEWED_SOURCE']), roleStatus: z.enum(['UNKNOWN','REVIEWED_SOURCE']),
  xHandle: z.string().nullable(), tier: z.enum(['A','B','C','D','UNCLASSIFIED']), seed: z.record(z.string(),z.string()),
  sourceIds: z.array(IdSchema), reviewIds: z.array(IdSchema), intendedUse: z.literal('RESEARCH_AND_ATTRIBUTED_COMMENTARY'),
  biasTags: z.array(z.string()), verifiedAt: TimeSchema.nullable() });
export const Edge = Base.extend({ from: IdSchema, to: IdSchema,
  relation: z.enum(['FOUNDED','BUILDS','RESEARCHES','COVERS','COMPETES_WITH','USES_INFRA','PUBLISHES','CONTRADICTS','RELATES_TO','HAS_VERIFIED_PROOF']),
  dimension: z.string().nullable(), sourceUrl: z.url(), retrievedAt: TimeSchema, confidence: z.number().min(0).max(1),
  evidenceIds: z.array(IdSchema).nonempty(), reviewIds: z.array(IdSchema).nonempty(),
}).refine(e => e.relation !== 'COMPETES_WITH' || Boolean(e.dimension), 'Competition requires an explicit dimension');
export const Observation = Base.extend({ uri: z.url(), canonicalUrl: z.url(), sourceId: IdSchema, pillar: z.string(),
  title: z.string().max(500), author: z.string().nullable(), publishedAt: TimeSchema.nullable(), retrievedAt: TimeSchema,
  responseSha256: HashSchema, contentSha256: HashSchema, excerpt: z.string().max(5000),
  hashScope: z.literal('HTTP_RESPONSE_BODY'), license: z.string(), status: z.enum(['COLLECTED','SOURCE_UNAVAILABLE']),
  error: z.string().nullable(), engagement: z.record(z.string(),z.number().nonnegative().nullable()),
  platform: z.string(), duplicateKey: HashSchema, publicationClock: z.enum(['VERIFIED_METADATA','BACKGROUND']),
  evidenceId: IdSchema.nullable(), reviewId: IdSchema.nullable() });
export const Brief = Base.extend({ topicId: IdSchema, title: z.string().min(1), angle: z.string().min(1),
  audience: z.string(), cta: z.string(), sourceIds: z.array(IdSchema).nonempty(), sourceSetSha256: HashSchema,
  claims: z.array(z.object({ statement: z.string(), evidenceId: IdSchema, evidenceSha256: HashSchema })).nonempty(),
  riskNotes: z.array(z.string()), temporalScope: z.enum(['ROLLING_30D','BACKGROUND']),
  opportunityId: IdSchema.optional(),
  publicationEvidence:z.object({windowStartUtc:TimeSchema,windowEndUtc:TimeSchema,observations:z.array(z.object({id:IdSchema,sha256:HashSchema,evidenceId:IdSchema,reviewId:IdSchema,publishedAt:TimeSchema})).nonempty()}).optional(),
  approvalStatus: z.literal('HOLD'), humanReview: z.literal('PENDING'), publicationAuthorized: z.literal(false) });
export const PILLARS = [
  ['launchpads','launchpad bonding curve graduation'], ['prediction','prediction market liquidity resolution trust'],
  ['orderbooks','Kuru Monad central limit order book'], ['liquidity','LP inventory orderbook AMM'],
  ['rwa','tokenized equities custody rights'], ['infrastructure','Monad builders ecosystem'],
  ['security','DeFi trader slippage MEV security'], ['engineering','Solidity distributed systems exact accounting liveness'],
] as const;
export type Brief = z.infer<typeof Brief>;
export type Observation = z.infer<typeof Observation>;
export type Entity = z.infer<typeof Entity>;
export const CollectionRun=Base.extend({windowStartUtc:TimeSchema,windowEndUtc:TimeSchema,profile:z.literal('crypto'),sourceIds:z.array(IdSchema),
  coverage:z.array(z.object({pillar:z.string(),collected:z.number().int().nonnegative(),unavailable:z.number().int().nonnegative()}).passthrough()),networkRequests:z.number().int().nonnegative(),bodyBytes:z.number().int().nonnegative(),
  status:z.enum(['PARTIAL_COVERAGE','BLOCKED']),approvalStatus:z.literal('HOLD')});
export const TrendSignal=Base.extend({topicId:IdSchema,pillar:z.string(),title:z.string(),windowStartUtc:TimeSchema,windowEndUtc:TimeSchema,sourceIds:z.array(IdSchema).nonempty(),
  independentSourceCount:z.number().int().positive(),trendScore:z.number().min(0).max(100).nullable(),scoreExplanation:z.string(),reviewStatus:z.literal('PENDING'),approvalStatus:z.literal('HOLD')});
export const Opportunity=Base.extend({topicId:IdSchema,title:z.string(),safeAngle:z.string(),sourceIds:z.array(IdSchema).nonempty(),temporalScope:z.enum(['BACKGROUND','ROLLING_30D']),
  ranking:z.object({score:z.number().min(0).max(100),interpretation:z.literal('EDITORIAL_HEURISTIC_NOT_OBSERVED_INFLUENCE')}).passthrough(),counterargument:z.string(),counterEvidence:z.array(z.string()),approvalStatus:z.literal('HOLD')});
