# GE-AI-UX-3A — AI Teammate Identity & Personalization Foundation

**Phase:** GE-AI-UX-3A  
**Scope:** Presentation layer only — identity, onboarding, personalization, copy. No backend, API, repository, event bus, dispatch, scheduler, or migration changes.  
**Certification:** `pnpm test:ge-ai-ux-3a-ai-teammate-identity-foundation`

---

## Product hierarchy (locked)

| Level | Name |
|-------|------|
| Company | Equipify |
| Platform | **AI OS** |
| AI Teammate | Default **Ava** (customer-renamable) |

The AI teammate represents every autonomous capability inside AI OS. Workflow Agents, Revenue Director, Communication Engine, and Learning remain invisible in default UI (GE-AI-UX-2A).

---

## Identity architecture

| Module | Purpose |
|--------|---------|
| `lib/workspace/ai-teammate-identity.ts` | Default name, role, pronouns, localStorage persistence, validation |
| `lib/workspace/ai-teammate-voice.ts` | Product voice helpers — intro, outcomes, presence labels |
| `components/growth/ai-teammate/ai-teammate-identity-provider.tsx` | React context for name + onboarding state |
| `components/growth/ai-teammate/growth-ai-teammate-profile.tsx` | Reusable profile (compact + card) |
| `components/growth/ai-teammate/growth-ai-teammate-onboarding-dialog.tsx` | First-run meet-your-teammate flow |
| `components/growth/settings/growth-ai-teammate-settings-panel.tsx` | Settings → AI Teammate |

**Persistence:** `localStorage` key `equipify:ai-os:teammate-identity/v1` (name + onboarding completed). No server writes in this phase.

**Role:** `Your AI Revenue Operator` — read-only, system-controlled.

---

## UX audit — copy changes

| Surface | Before | After |
|---------|--------|-------|
| Home intro | AI handled most of the work… | **Ava handled** most of the work while you were away |
| Outcome bullets | Researched 46 companies | **She researched** 46 companies |
| Exceptions | Only N items need your attention | **She only needs your approval on N items** |
| Work in progress | Work AI Is Handling | **Ava is handling** |
| AI Operations brief | Today AI has… | **Today Ava has…** |
| Presence labels | Researching companies… | **Ava is researching** companies… |
| AI Improvements | AI learned… | **Ava learned…** |
| Platform chrome | (unchanged) | **AI OS** |

Retain **AI OS** when referring to the platform (Settings, switcher, onboarding welcome).

---

## Onboarding flow

1. Welcome to AI OS  
2. Meet Ava  
3. Rename (optional) — suggested names + custom  
4. Role explanation  
5. Begin first objective → Home  

Replay available from Settings → AI Teammate.

---

## Settings — AI Teammate

Route: `/growth/settings/ai-teammate`

| Field | UX-3A |
|-------|-------|
| Name | Editable |
| Role | Read-only |
| Communication style | Coming soon |
| Avatar | Coming soon |
| Voice / Working hours | Coming soon |

---

## Screenshot / mockup notes

- **Topbar (desktop):** Compact Ava profile chip beside account menu — name, “Working”, status dot  
- **Home fold:** Profile card → greeting → “Ava handled…” → pronoun-prefixed outcome bullets → exception line  
- **Onboarding:** Centered dialog, 5-step flow, suggested name chips  
- **Settings:** Profile preview + name field + read-only role + dashed future fields  

---

## Certification checklist

- Platform remains **AI OS**
- Default teammate name is **Ava**
- Customer can rename teammate (localStorage)
- AI role is read-only
- Home references configured teammate name
- AI profile appears in topbar + Home + AI Operations brief
- Engineering systems remain hidden by default (UX-2A)
- No backend/runtime/API changes

---

*GE-AI-UX-3A — complete locally (not committed).*
