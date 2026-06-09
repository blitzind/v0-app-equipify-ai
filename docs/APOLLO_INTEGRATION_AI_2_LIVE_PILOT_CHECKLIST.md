# Apollo AI-2 Live Pilot Checklist

Use for **one controlled live Apollo pilot**. Do not run in CI. No bulk imports. No automated enrollment.

## Preconditions

### Environment

```bash
GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
GROWTH_APOLLO_USE_MOCK=false
APOLLO_API_KEY=...
GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED=true
GROWTH_DISCOVERY_DISABLE_APOLLO=    # must NOT be 1
```

Optional enrichment (consumes credits — skip for first pilot):

```bash
# GROWTH_APOLLO_ENRICH_EMAILS=true
# GROWTH_APOLLO_ENRICH_EMAILS_ACK=1
```

### Test company

- [ ] Single `discovery_candidates` row selected (internal/test company only)
- [ ] Valid domain for Apollo people search
- [ ] `canonical_company_id` linked or resolvable
- [ ] Not suppressed / disqualified
- [ ] No conflicting bulk acquisition run in progress

Record `company_candidate_id`: ____________________

## Execution

1. [ ] Set `GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID`
2. [ ] Run:

```bash
GROWTH_APOLLO_AI_2_OUTPUT_PATH=./evidence/apollo-ai-2-pilot.json \
  pnpm run:apollo-live-pilot-ai-2
```

3. [ ] Confirm output shows `mock: false`
4. [ ] Confirm `runtime.api_calls >= 1`
5. [ ] Confirm `discovery.contacts_mapped >= 1`
6. [ ] Re-run certification:

```bash
APOLLO_AI_2_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-2-pilot.json \
  pnpm test:apollo-integration-ai-2
```

## Expected pipeline behavior

| Stage | Expected |
|-------|----------|
| Apollo search | `future_apollo` provider returns contacts |
| contact_candidates | Rows stored with Apollo metadata |
| company_contacts | Sync count > 0 |
| canonical persons | `persons_linked > 0` from backfill |
| Research | Lead engine / intelligence runs if lead promoted |
| Sequence readiness | Funnel counts populated in evidence |

## Capture metrics

| Metric | Value |
|--------|-------|
| Contacts discovered | |
| Contacts mapped | |
| Contacts skipped | |
| API calls | |
| Credits consumed | |
| Runtime (ms) | |
| Person created | |
| Person deduped | |
| Sequence ready | |
| Go/No-Go verdict | |

## Rollback

1. Set `GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=false`
2. Set `GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED=false`
3. Archive test `contact_candidates` if needed (`pnpm cleanup:apollo-benchmark-candidates-7-pca-3`)

## Post-pilot

- [ ] Document Go/No-Go in [APOLLO_INTEGRATION_AI_2.md](./APOLLO_INTEGRATION_AI_2.md)
- [ ] If `go`: proceed to 10-company pilot wave at `safe_pilot_volume_per_day`
- [ ] If `conditional_go` or `no_go`: address blockers before any production rollout
