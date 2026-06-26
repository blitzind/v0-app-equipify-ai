# GE-AIOS-3F — Known Risks & Deferred Items

**Phase:** GE-AIOS-3F  
**Date:** 2026-06-25

---

## Known risks (accepted for this batch)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Infrastructure certified locally only — not production-deployed | Medium | Apply migrations to staging first; re-run stack cert |
| No automated integration tests against live Supabase | Medium | Schema health probes + manual smoke after migration apply |
| Provider bridge reads Core `lib/ai/providers` | Low | Isolated to `ai-provider-core-bridge.ts`; invocation opt-in via `enableAiEvidence` |
| Planning review `reviewId` not persisted server-side | Low | Audit via events; operator must preview before approve |
| Unrelated dirty files in working tree | Low | Split commit: GE-AIOS only vs. media/middleware work |

---

## Explicitly deferred (not in 2A–3E)

| Item | Target phase |
|------|--------------|
| Cron / scheduled planning ticks | Future — operator-initiated only in 3D/3E |
| Autonomous Work Order execution loops | GE-AI-2I+ / runtime binding |
| Outbound send / enroll from AI OS | GE-AI-2I L4 Supervised Outbound |
| Meta-Recommender supremacy | GE-AI-2F |
| Priority Engine as sole authority | GE-AI-2E |
| Full Mission UI & operator experience | GE-AI-2G |
| L3 human approval flows | GE-AI-2H |
| Event bus consumer wiring to legacy bridges | GE-AI-2B remaining |
| Production feature-flag enforcement for AI OS | Future ops phase |

---

## Recommendation

**Commit now** — GE-AIOS 2A–3E stack is locally certified, migration order is valid, Core is untouched, and no autonomous execution paths are exposed.

**Fix first** only if:

- You intend to include unrelated media/middleware changes in the same commit (don't — split PRs).
- Staging migration apply fails dependency guards (address prerequisite migrations first).

---

**Not committed / not deployed** per phase policy.
