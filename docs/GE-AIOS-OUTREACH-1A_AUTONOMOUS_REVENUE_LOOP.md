# GE-AIOS-OUTREACH-1A — Autonomous Revenue Loop

Research enables outreach; it is not the destination.

## Philosophy

Success metrics shift from **companies researched** to **conversations started**, replies, meetings, and pipeline value.

## Pipeline (unchanged canonical path)

Discovery → Research → Qualification (50% good-enough) → Decision maker → Draft Factory → Operator approval → Ready to send

Outbound transport remains **disabled**. Drafts queue for one-click operator approval only.

## Research exit criteria

Research completes and advances toward outreach when any of:

- confidence ≥ **50%**
- enough website evidence collected
- obvious disqualifier found
- research time budget exhausted

Policy module: `lib/growth/outreach/growth-autonomous-revenue-loop-1a.ts`

## Decision maker policy

One **likely** contact (confirmed, verified, or suspected) is enough to begin outreach prep. Buying committee mapping continues as follow-up work.

## Draft Factory trigger

After ASL research reconciliation, leads at ≥50% confidence schedule `runAutonomousOutreachPreparationManualRequest` (Draft Factory / 5F path). Existing wake bus and due scheduler unchanged.

## Home changes

- Pipeline-first heartbeat: drafts created, awaiting approval, emails, replies, meetings
- Research pace demoted to secondary metric
- Actionable copy: “Drafting personalized outreach…” instead of generic “Preparing outreach…”

## Validation

```bash
pnpm test:ge-aios-outreach-1a-wiring
```
