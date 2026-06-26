# GE-AIOS-2B — Existing Event Infrastructure Audit

**Phase:** GE-AIOS-2B  
**Date:** 2026-06-25

---

## Summary

The Growth Engine has **multiple parallel event substrates** serving different purposes. GE-AIOS-2B adds a **canonical immutable AI OS event log** with subscription/delivery orchestration. Legacy systems are **not replaced** — bridges normalize into AI OS events when explicitly invoked.

---

## Systems surveyed

| System | Location | Purpose | GE-AIOS-2B decision |
|--------|----------|---------|---------------------|
| **Realtime events** | `lib/growth/realtime-events/` | UI polling, operator command center, `signal_events` storage | **Keep** — bridge via `buildAiOsEventFromRealtimeEnvelope` |
| **Objective event router** | `lib/growth/objectives/growth-objective-event-router.ts` | Mission signal fan-in, dedupe, kill switches | **Keep** — bridge via `buildAiOsEventFromObjectiveSource` |
| **AI Work Order events** | `growth.ai_work_order_events` (GE-AIOS-2A) | Work order audit trail | **Keep** — bridge via `buildAiOsEventFromWorkOrderAudit` |
| **Lead timeline** | `growth.lead_timeline_events` | CRM-style lead history | **Keep** — future bridge stub |
| **Sequence execution job events** | `growth.sequence_execution_job_events` | Outbound step audit | **Keep** — domain-specific |
| **Platform timeline** | `growth.platform_timeline_events` | Cross-module audit | **Keep** |
| **Conversation timeline** | `growth.conversation_timeline_events` | Inbox/reply history | **Keep** |
| **Multi-channel activity** | `growth.multi_channel_activity_timeline_events` | Revenue intel | **Keep** |
| **Provider secret audit** | `growth.provider_secret_audit_events` | Security audit | **Keep** |
| **Operator notifications** | `lib/growth/operator-notifications/` | User-facing alerts | **Keep** — not AI OS bus |
| **Supabase realtime channels** | `realtime-events-subscriber.ts` | Browser polling/subscriptions | **Keep** — not constitutional bus |
| **WebSockets** | Not a Growth-native AI bus | Transport for UI | **Not used** by GE-AIOS-2B |

---

## Reuse / extend / wrap

| Action | What |
|--------|------|
| **Reuse** | Immutable append-only pattern from `sequence_execution_job_events`, `ai_work_order_events` |
| **Reuse** | Dedupe concept from `growth-objective-event-dedupe` → `replay_key` unique index |
| **Reuse** | Schema health probes, growth schema grants/RLS conventions |
| **Extend** | AI OS event registry catalog (Constitution §11.5) |
| **Wrap** | `ai-event-bridge.ts` — optional normalization from legacy sources |
| **Do not duplicate** | Realtime UI bus, timeline stores, notification delivery |

---

## Why not unify by replacing legacy systems

Replacing `signal_events`, lead timeline, or sequence job events would:

- Break production UI and certifications
- Mix operator notification concerns with AI OS internal bus
- Violate GE-AIOS-2B scope (infrastructure only, no runtime rewiring)

The constitutional goal (§11.5) is **unification over time** via bridges and dual-write periods — not big-bang replacement in Phase 2.

---

## Loose coupling rule

AI OS services publish to `growth.ai_os_events` and subscribe via `ai_os_event_subscriptions` / pull API. Direct cross-service domain calls are discouraged; the subscriber registry supports in-process handlers for future phases without wiring in GE-AIOS-2B.

---

*GE-AIOS-2B Infrastructure Audit*
