# Expert and project research methodology

Inputs are the two owner-supplied V4 CSVs. Their 14 people and 25 projects are discovery seeds, not a verified influence dataset. The watchlist is for research and attributed commentary, with no contact harvesting, mass outreach or automated engagement.

## Verification layers

1. Import the original row, source URL, subject area and tenant relevance. Unknown handles stay null.
2. Retrieve a permitted source through a registered adapter. Record exact response hash, retrieval clock, publication metadata, excerpt rights and failures.
3. Review exact identity statements. A name appearing in a current first-party profile is stronger than an unreviewed directory listing.
4. Review the current organizational role separately. A historical founding or joining announcement does not establish a current role.
5. Record content specialties, review time, intended use and coverage bias. Revisit conflicting or expired evidence before reuse.

Keone Hon's historical Foundation announcement supports identity, not an automatic current role. Hayden Adams's official history supports the historical creation attribution, not a current job title by itself. Haseeb Qureshi's current public about page supports a separately reviewed Dragonfly role. Vaibhav Prakash remains unverified pending the required identity corroboration; seed spelling/affiliation is not silently accepted.

## Review file example

After V3 evidence ingest/review, place this under the selected tenant's inbox:

```json
{
  "tenant": "founder",
  "canonicalId": "REPLACE_WITH_PUBLIC_ENTITY_ID",
  "evidenceId": "REPLACE_WITH_REVIEWED_SOURCE_ID",
  "identityClaim": "REPLACE_WITH_EXACT_REVIEWED_NAME_STATEMENT",
  "roleClaim": null,
  "tier": "A",
  "xHandle": null
}
```

```bash
./gtm intelligence entities review --brand founder --file research/inbox/founder/IDENTITY.json --json
./gtm intelligence entities list --brand founder --type person --json
./gtm workflow run influencer-expert-watchlist --brand founder --offline --json
```

A supplied handle is accepted only when the reviewed source contains its exact public X profile link. The adapter does not fetch X. Identity and role reviews bind scoped source/review IDs; they do not grant owner publication approval or establish follower counts.

## Tiers and assessment

- A: relevant technical builders and market-structure researchers.
- B: evidence-backed launchpad, prediction and trading practitioners.
- C: research distribution sources such as newsletters/podcasts.
- D: culture/language observation with low factual authority.

Tier is a reviewer-assigned editorial heuristic. Current implementation stores tier, specialties, evidence bindings and bias tags; it does not claim a measured eight-factor influence model or live audience/network ranking. Expertise, first-party access, evidence quality, recency, on-topic frequency, audience overlap, originality and risk remain structured review questions before broader scoring is promoted. Audience size is not factual authority.

The Day0 watchlist exports report identity-reviewed and current-role-reviewed counts separately. The minimum 14 fully current verified people and target 50 remain blocked where evidence is insufficient. Do not count project, mechanism or claim nodes toward the people target, or count the same public person twice across tenants.

## Graph and competition integrity

Graph entities have typed roles and public canonical identifiers. Edges require source URLs, retrieval clocks, confidence and source/review IDs. `COMPETES_WITH` additionally requires a dimension. A shared ecosystem, integration or token category is not proof of direct competition. The first graph records documentary links such as RetroPick's use of Kuru without asserting current market depth or production readiness.

Store public identities separately from each tenant's private annotations. Reviewer confidence is an assessment, not a probability measured from a representative population. A reviewed source remains distinct from owner attestation, platform verification and product verification.
