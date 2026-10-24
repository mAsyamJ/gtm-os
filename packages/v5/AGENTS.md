# V5 publishing contract

The owner's V5 master prompt and approved implementation plan authorize the project-local Buffer adapter. This augments the historical packages contract only for V5. Legacy publication paths stay disabled.

An explicit tenant, verified Buffer principal/channel, exact unexpired owner approval and `--execute` are mandatory for each external write. Only the publisher runtime loads its dedicated service credential; research, models, fixtures and artifacts never receive it. No global credentials are inspected or modified. Observed and synthetic stores remain physically separate. Uncertain writes require reconciliation, never automatic resubmission. Public verification uses the reviewed X oEmbed API only, never website automation. Missing credentials, approval, observations or public proof remain BLOCKED.

Run `pnpm check` and `python3 scripts/verify_v5.py`. Keep append-only receipts and V4 data. No push, merge, service installation or arbitrary publication is authorized.
