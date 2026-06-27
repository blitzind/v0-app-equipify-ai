# GE-AI-UX-2A — Outcome-First Unified Experience

**Phase:** GE-AI-UX-2A  
**Scope:** UX, IA, terminology, and presentation only — no backend, API, repository, event bus, dispatch, autonomy, or migration changes.  
**Certification:** `pnpm test:ge-ai-ux-2a-outcome-first-unified-experience`

---

## Product philosophy

The operator should feel that **AI is operating the business** and only bringing **exceptions**. Default UI copy emphasizes completed outcomes first; engineering concepts remain under **Advanced** progressive disclosure.

---

## UX audit

| Page / Surface | Current Problem | Outcome-First Change | Risk |
| -------------- | --------------- | -------------------- | ---- |
| **Home** (`/growth`) | Metrics-first welcome; "Needs Your Attention" dominated; recommendation framed as system tool | Executive brief leads with **completed outcomes**; **Review Exceptions** primary CTA; hierarchy: outcomes → Top Business Move → Exceptions & Approvals → Exceptions → Work in Progress → snapshot → timeline | Low — presentation synthesizer only |
| **AI Operations** (`/growth/os`) | Revenue Director, Approval Center, Communication Engine visible; "AI Currently Working" | **Top Business Move**, **Exceptions & Approvals**, **Recommended Outreach**, **AI Improvements**, **Work AI Is Handling**; engine sections collapsed behind disclosure | Low — legacy sections preserved |
| **Home recommendation** | Generic "Recommendation" / Revenue Director framing | **Top Business Move** with expected impact language | Low |
| **Home approvals** | "Approval queue" metrics tone | **Exceptions & Approvals** with outcome buckets (Ready to send, Ready to activate, etc.) | Low |
| **Home exceptions** | Broad "Needs Your Attention" | **Exceptions** — "AI completed everything else" | Low |
| **Home AI activity** | "AI Currently Working" / agent labels | **Work AI Is Handling** grouped by outcome (Finding opportunities, Preparing outreach, …) | Low |
| **Operator attention cards** | Engine names in headlines (Revenue Director, Calibration) | Outcome headlines ("Outreach ready for your review", "Improvement ready to apply") | Low |
| **Operator system status** | Runtime/queue labels prominent | Moved below timeline; health summarized in plain language | Low — diagnostics unchanged under Advanced |
| **Command center sections** (collapsible) | Revenue Director, Communication Engine, Human Approval Center titles | Unchanged — only visible when operator expands **Show more details** / engineering disclosure | None — intentional Advanced surface |
| **Human Approval panel** (`/growth/os/approvals`) | "Human Approval Center" page title | Not changed in UX-2A — dedicated route; rename deferred to UX-2B | Medium — route-level rename needs nav audit |
| **Navigation** | Tool-oriented labels (Sequences, Engagement, etc.) | Documented recommended UX-2B nav; **routes unchanged** | None in 2A |
| **Business snapshot metrics** | Raw dashboard metric labels | Outcome-oriented labels where mapped (`Accounts AI prioritized`, etc.) | Low |

### Duplicates addressed

- Single **Top Business Move** on Home and AI Operations (no duplicate Revenue Director card in default fold).
- **Exceptions & Approvals** summary precedes individual exception cards — avoids duplicate approval counts dominating the fold.
- **Work AI Is Handling** replaces parallel "active agents" wording on default surfaces.

---

## Implementation summary

### Shared terminology

`lib/workspace/ai-os-outcome-first-terminology.ts` — central labels, approval buckets, hidden engine list, UX-2B nav recommendation.

### Home (`/growth`)

- QA marker: `growth-ge-ai-ux-2a-home-outcome-first-briefing-v1`
- Synthesizer builds `completedOutcomes`, `introLine`, exception count, dual CTAs
- Dashboard layout reordered per outcome-first priorities
- Components: Exceptions section, Top Business Move card, Exceptions & Approvals, Work AI Is Handling

### AI Operations (`/growth/os`)

- QA marker: `growth-ge-ai-ux-2a-outcome-first-operator-experience-v1`
- Operator dashboard reordered; **AI Improvements** section added
- Engine UI hidden in default chrome; collapsible command-center sections for details
- Engineering disclosure unchanged under Advanced

---

## Copy / terminology changes

| Before | After (default UI) |
| ------ | ------------------ |
| Needs Your Attention | **Exceptions** |
| Approval Center / Human Approval Center | **Exceptions & Approvals** |
| Revenue Director | **Top Business Move** |
| Communication Engine | **Recommended Outreach** |
| AI Currently Working | **Work AI Is Handling** |
| Calibration / Learning Calibration | **AI Improvements** |
| (Home primary action) | **Review Exceptions** |
| (Home secondary action) | **View AI Work Summary** |

Tone: *AI handled*, *AI completed*, *AI prepared*, *AI needs your review* — avoid *engine*, *dispatcher*, *workflow request* outside Advanced.

---

## Navigation recommendation (UX-2B — not applied)

Home · Prospecting · Campaigns · Conversations · Meetings · Objectives · Runbooks · Settings · Advanced

Existing `/growth/*` routes unchanged.

---

## Screenshot / mockup notes

- **Home fold:** Greeting → completed outcome bullets → exception count → dual CTAs → Top Business Move → Exceptions & Approvals → Exceptions (if any) → Work in Progress grid
- **AI Operations fold:** Same narrative pattern with Recommended Outreach and AI Improvements before in-progress work
- **Advanced disclosure:** Legacy operations dashboard + diagnostics retain engine names

---

## Engineering terminology under Advanced

Preserved in:

- `growth-ai-os-operator-engineering-disclosure.tsx`
- Collapsible command-center sections (Revenue Director, Communication Engine, Human Approval Center)
- Full diagnostics routes and cert scripts for GE-AI-3A–3D

---

## Certification

```bash
pnpm test:ge-ai-ux-2a-outcome-first-unified-experience
pnpm test:ge-ai-ux-1a-operator-experience-redesign
pnpm test:ge-ai-ux-1b-ai-os-branding-workspace-architecture
pnpm test:ge-ai-ux-1c-ai-executive-briefing-experience
```

---

## Remaining risks (UX-2B)

1. Dedicated approval route still titled "Human Approval Center"
2. Navigation still tool-oriented — UX-2B rename pass
3. Some collapsed "everything else" Home tools still expose legacy metric grids
4. Bounded autonomous outbound section retains "Open Approval Center" link text

---

*GE-AI-UX-2A — outcome-first unified experience complete locally (not committed).*
