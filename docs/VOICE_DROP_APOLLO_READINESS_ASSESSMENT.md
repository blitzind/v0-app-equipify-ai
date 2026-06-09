# Voice Drop Apollo Readiness Assessment

**Assessment date:** 2026-06-08  
**Scope:** Operational review only — no implementation changes  
**Verdict:** **Conditionally Ready** for phased Apollo rollout after VD-4 live certification sign-off

## Executive summary

The Voice Drop architecture is production-shaped: Twilio AMD delivery, webhook persistence, sequence integration, operator approval, compliance orchestration, timeline and engagement signals, and cross-channel fatigue rules are implemented and covered by automated certification harnesses (VD-1A through VD-4).

Apollo-scale rollout is **not** approved until:

1. One controlled live sequence certification completes with real CallSid evidence
2. Production env audit shows zero `fail` findings (webhooks reachable, credentials set)
3. Operators complete the runbook training path below

## System limits (built-in)

| Control | Value | Implication for Apollo |
|---------|-------|------------------------|
| Max recipients per campaign | 500 | Batch Apollo segments into ≤500 per campaign |
| Frequency cap | 7 days / phone | Same lead cannot receive another drop within 7 days |
| Max delivery attempts | 3 | Failed numbers stop after 3 attempts |
| Autonomous outbound | **Disabled** | Every sequence step needs human job approval |
| Campaign approval | **Required** | New Apollo messaging requires approval workflow |
| SMS fatigue window | 24h | Voice drop step skipped if SMS touch within 24h |
| Call fatigue window | 12h | Voice drop step skipped if call within 12h |

## Recommended rollout strategy

### Phase 0 — Certification (current)

- One internal test number
- One approved campaign + `multichannel_with_voice_drop` pattern
- One enrollment → one Voice Drop step → verify full evidence chain
- Capture evidence JSON and re-run `pnpm test:voice-drop-sequence-vd-4` with `VOICE_DROP_VD_4_EVIDENCE_JSON`

### Phase 1 — Pilot (Apollo-adjacent, not bulk)

- **Volume:** ≤10 Voice Drops / day / organization
- **Leads:** Manually promoted Apollo contacts with verified mobile numbers
- **Patterns:** Single active pattern with Voice Drop on step 2+ (after email touch)
- **Operators:** One designated approver; daily metric review

### Phase 2 — Limited Apollo sequences

- **Volume:** ≤50 Voice Drops / day / organization
- **Segments:** Pre-qualified Apollo lists (valid phone, not suppressed, US call hours)
- **Campaigns:** One approved campaign per message variant
- **Monitoring:** Alert on failure rate >15% or webhook errors

### Phase 3 — Scale (requires re-assessment)

- Re-evaluate Twilio spend, carrier filtering, and compliance block rates
- Consider org-level daily caps in operations policy (not yet automated)
- Do not enable autonomous bulk — architecture intentionally blocks this

## Maximum safe daily volume (operational estimate)

| Tier | Recommended max | Rationale |
|------|-----------------|-----------|
| Certification | 1–3 calls | Manual verification |
| Pilot | 10 / org / day | Human approval bottleneck + webhook validation |
| Limited rollout | 50 / org / day | Within Twilio trial/small-account comfort; monitor AMD latency |
| Theoretical campaign cap | 500 / campaign | Hard code limit — split larger Apollo imports |

**Note:** Actual safe volume depends on Twilio account tier, carrier acceptance, and operator approval capacity. The binding constraint today is **human approval per execution job**, not provider throughput.

## Approval workflow requirements

Before Apollo leads enter a Voice Drop sequence:

1. Voice Drop campaign approved in admin UI
2. Message template compliance-reviewed (TCPA / state call-time rules via compliance orchestration)
3. Sequence pattern activated with campaign linked on `voice_drop` step
4. `VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true` only on certified environments
5. Execution job approved per lead per step

## Compliance bottlenecks

| Bottleneck | Impact | Mitigation |
|------------|--------|------------|
| `VOICE_COMPLIANCE_ORCHESTRATION_ENABLED` off | Fatigue compliance checks weakened | Enable in all prod environments |
| Call hours / timezone | Blocks outside window | Schedule sequence steps accordingly |
| Opt-out registry | Blocks send | Honor suppressions before enrollment |
| Human answer (AMD) | No voicemail playback | Expected — counts as failed drop, not compliance violation |
| Missing E.164 phone | Enrollment or fatigue block | Normalize Apollo phone data at import |

## Operational monitoring requirements

| Signal | Source | Threshold / action |
|--------|--------|-------------------|
| Voice Drops Failed | Sequence dashboard | Investigate if >15% of attempts |
| Webhook persistence failures | App logs `voice_drop_status_persist_failed` | Page on any sustained spike |
| Provider blocks | Logs `voice_drop_provider_blocked` | Fix env or certification |
| Twilio debugger errors | Twilio console | Daily review during pilot |
| Timeline gaps | Lead timeline missing terminal event | Check webhook reachability |
| Approval queue age | Execution console | Ops SLA ≤4h during pilot |

## Dependencies and gaps

| Item | Status |
|------|--------|
| VD-1A Twilio provider | ✅ Complete |
| VD-1B Certification harness | ✅ Complete |
| VD-2 Sequence integration | ✅ Complete |
| VD-3 Operator readiness | ✅ Complete |
| VD-4 Automated certification | ✅ Harness available |
| VD-4 Live call evidence | ⏳ Manual — required before Apollo |
| VD-2/VD-3 DB migrations on prod | ⚠️ Verify applied |
| Apollo import → sequence enrollment | Existing growth flows — no Voice Drop-specific import logic |

## Decision

| Criterion | Ready? |
|-----------|--------|
| Architecture | ✅ Yes |
| Automated tests | ✅ Yes |
| Operator UI + runbook | ✅ Yes |
| Live Twilio end-to-end evidence | ⏳ Pending manual certification |
| Apollo bulk autonomous | ❌ Intentionally not supported |

**Final recommendation:** Mark Voice Drops **Conditionally Ready** for Apollo. Proceed to Phase 0 live certification, then Phase 1 pilot at ≤10 drops/day. Do **not** attach Voice Drop steps to high-volume Apollo auto-enrollment until live evidence and 7-day pilot metrics are green.
