# Tenant-to-account isolation

Expected X handle `retropick → RetroPickMarket` and `founder → iHateModelsss`. Do not infer OAuth from URLs. On each potential external write, verify authenticated user ID and handle from first-party identity endpoint, validate exact tenant action approval and media/text SHA256 and enforce spend cap. Unknown identity/price = hard block. Reconcile ambiguous write before retries. Store credentials outside the repository and LLM context.
