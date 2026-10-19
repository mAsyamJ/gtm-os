# Agent orchestration and handoffs

`Chief GTM -> Research -> Product Marketing/Founder Brand -> Social Editor -> Graphic/Motion -> QA + Compliance -> OWNER APPROVAL -> Marketing Ops/Distribution -> Analyst -> Chief GTM`.

For each job require `job_id`, `tenant`, `goal`, `source_ids`, `owner_role`, `input_artifact_hashes`, `outputs`, `validation_receipts`, `risk_tier`, `approval_id`, `state`, `trace_id` and `retries`. No agent may self-authorize external writes. Fail closed and preserve durable checkpoints. Limits: task-specific delegation, no recursion with uncontrolled budget, bounded retry with backoff, side-effect idempotency and deterministic resume. Analysts can recommend campaigns, never self-initiate ads or outbound actions.
