# GE-AIOS-CONTACT-1A — Canonical DataMoon Email & Phone Completion

**Phase:** GE-AIOS-CONTACT-1A  
**Depends on:** SV1-4 DataMoon DM, SV1-5 Draft Factory, AUTONOMY-1B wake wiring  
**Architecture:** Vercel production only — no `.env.local`, no outbound send, no new person DB / verification engine / DF stage.

---

## Exact loss points (before this phase)

1. **`normalizeDatamoonAudienceRecord`** only promoted a single email + `personal_phone` (first personal email token) — alternate emails and other phone field keys were not carried into DM ranking as channel arrays.
2. **`evaluateAndEnrichDecisionMakerForLead`** upserted `lead_decision_makers` as `suspected` with `source=public_web` and **never** called `resolveCanonicalPerson` / `upsertCanonicalPersonEmail` / `upsertCanonicalPersonPhone`.
3. **No `recomputeGrowthLeadDecisionMakerStatus`** and no lead `contact_email` / `contact_phone` projection → Draft Factory `contactVerifiedForEmail` and Cognitive Workspace stayed blocked/empty.
4. **`canonical_person_id` never linked** → buying committee skipped DataMoon DMs.
5. Provider-returned contacts were sometimes treated as “verified” in ranking labels without independent verification evidence.

---

## DataMoon fields supported

**Emails:** `business_email`, `work_email`, `email`, `primary_email`, `personal_emails` (comma/semicolon/pipe), `personal_email`, `alternate_emails`, `emails`

**Phones:** `personal_phone`, `mobile_phone`, `mobile`, `direct_phone`, `direct_dial`, `work_phone`, `business_phone`, `phone`, `company_phone`, `office_phone`, `main_phone` (+ extension parsing via `ext` / `x` / `extension`)

**Profiles:** `linkedin_url`

Company/switchboard phones are flagged (`isCompanySwitchboard`) and **not** used as person primary.

---

## Files added

| File | Role |
|------|------|
| `lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels.ts` | Extract/normalize emails & phones; readiness projection |
| `lib/growth/datamoon-decision-maker/datamoon-dm-canonical-contact-persist.ts` | Resolve person + integrity-gated email/phone upserts + DM attach |
| `scripts/test-ge-aios-contact-1a-datamoon-email-phone-completion.ts` | Certification |
| `docs/GE-AIOS-CONTACT-1A_DATAMOON_EMAIL_PHONE_COMPLETION.md` | This doc |

## Files modified

| File | Change |
|------|--------|
| `datamoon-dm-normalize.ts` | Channel arrays on every candidate |
| `datamoon-dm-types.ts` | `emails[]` / `phones[]` + readiness states |
| `datamoon-dm-engine.ts` | Readiness never fake-verifies provider contacts |
| `datamoon-dm-service.ts` | Persist + emit `growth.contact.available` / verified |
| `datamoon-decision-maker/index.ts` | Export contact helpers |
| `decision-maker-repository.ts` | `canonicalPersonId` on update |
| `datamoon-audience-import-normalizer.ts` | Broader email/phone field fallbacks |
| `draft-factory-durable-live.ts` | Contact stage unblocks on usable email + DM |
| `draft-factory-wake-emitters.ts` | `growth.contact.available` + failed |
| `draft-factory-wake-event-mapper.ts` | Available → one-stage `contact_verified` wake |
| `draft-factory-wake-event-types.ts` / `ai-event-registry.ts` | Event registration |
| `package.json` | `test:ge-aios-contact-1a-datamoon-email-phone-completion` |

---

## Existing canonical services reused

- `resolveCanonicalPerson` / `insertCanonicalPerson` / `touchCanonicalPersonSeen`
- `upsertCanonicalPersonEmail` / `upsertCanonicalPersonPhone` / profile / company role / lineage
- `evaluateCanonicalPersonEmailPromotion` / `evaluateCanonicalPersonPhonePromotion`
- `upsertGrowthLeadDecisionMakerCandidates` / `updateGrowthLeadDecisionMaker` / `recomputeGrowthLeadDecisionMakerStatus`
- AUTONOMY-1B emitters + `draft_factory_wake_observer`

---

## Normalization behavior

**Email:** trim → lowercase → syntax validate via `normalizeEmail` → dedupe by normalized → classify work/personal/unknown → preserve raw provider value. Never fabricate.

**Phone:** strip extension → `normalizePhone` digits → optional E.164 → classify mobile/direct/work/company → dedupe by normalized → flag switchboard. Never fabricate.

---

## Canonical persistence behavior

1. Resolve or create canonical person (email/phone/linkedin indexes).
2. Match existing email/phone rows before insert.
3. Skip if verified would be overwritten by weaker unverified.
4. Skip if weaker unverified would downgrade confidence.
5. Provenance: `provider_name=datamoon`; DM row `source=public_web` + `source_detail=datamoon:person_enrichment:…` (see schema note).
6. Confirm DM + set `canonical_person_id`; recompute lead DM status; project `contact_email` / `contact_phone` / `contact_name` on lead.

---

## Verification & readiness rules

| State | Meaning |
|-------|---------|
| `email_available_unverified` | Valid provider email persisted; not independently verified |
| `phone_available_unverified` | Valid person phone; call package may proceed |
| `verified_email` / `verified_phone` / `email_and_phone_verified` | Only with verification evidence |
| `profile_only` / `no_usable_channel` | Drafting remains blocked |

Provider-returned ≠ verified.

---

## Draft Factory resume

- Email-ready (available or verified) → contact stage clears → personalization/generation path (send still gated).
- Phone-only → readiness allows call-oriented prep when Growth 5F supports it.
- No channel → remain `waiting_for_dm` / contact blocked.
- Wakes resume **one stage only**; do not restart research/qualification/investment/DM discovery solely for contact readiness.

---

## Event / wake behavior

Emitted (existing types):

- `growth.contact.available`
- `growth.contact.verified`
- `growth.contact.verification_failed`
- `growth.datamoon.person_completed`

Payload includes org, lead, canonical person, channel, source run id, verification status, deterministic `replayKey`. Observer advances exactly one DF stage.

---

## Operator surfaces

Lead rollup (`contact_email` / `contact_phone` / `decisionMakerStatus`) feeds Cognitive Workspace, Decision Makers, approval/recipient prep. Canonical person email/phone rows are SoR — not provider JSON.

---

## No-waste controls (unchanged SV1-4 gates)

Stop Investment, portfolio defer, provider disabled/unconfigured, budget exhausted, cooldown / recent no-result, sufficient existing DM, kill switch, research incomplete, company identity uncertain — each returns a deterministic deny reason; no billable call.

---

## Schema note (`datamoon` source enum)

`lead_decision_makers.source` CHECK still allows only:  
`website | public_web | apollo | seamless | manual | lead_contact`

**Temporary:** `source = public_web` + `source_detail = datamoon:person_enrichment:<id>`  
Canonical channel rows use `provider_name = datamoon`.

**Smallest later migration:** add `datamoon` to the CHECK + TypeScript enum. Do not silently label DataMoon as Apollo.

---

## Remaining gaps

1. Default live DM discovery adapter remains a no-network stub outside injected records/tests — CONTACT-1A fixes persistence when records exist.
2. Independent email/phone verification providers are unchanged (not a new verification engine).
3. DM `source` enum still lacks `datamoon` (documented above).
4. Approval packages continue to read lead/canonical projections; full UI polish for multi-email/phone lists can follow.

---

## Certification

```bash
pnpm test:ge-aios-contact-1a-datamoon-email-phone-completion
pnpm test:sv1-4-datamoon-decision-maker-enrichment
pnpm test:sv1-5a-production-durable-draft-factory
pnpm test:ge-aios-autonomy-1b-canonical-wake-wiring
pnpm test:ge-aios-growth-5f-autonomous-outreach-preparation
pnpm test:ge-aios-identity-1b-customer-surface-identity
```

**Results (this batch):** all PASS.  
**No commit, push, or deployment.**
