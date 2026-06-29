# SETTINGS-MENU-COMPLETENESS-AUDIT-1B

Core, Growth, and Platform Admin fallback settings — ownership, completeness, duplication, and placeholder classification.

**Certification:** `pnpm test:settings-menu-completeness-audit-1b`

**Date:** 2026-06-29

---

## Executive summary

| Area | Status | Notes |
|------|--------|-------|
| Core `/settings/*` | **Pass** | Contains only Equipify Core / Scale workspace settings. Growth Engine and Growth Operator groups are removed from visible nav. |
| Growth `/growth/settings/*` | **Pass** | Canonical home for AI OS / Growth Operator settings. All required sections present in nav manifest. |
| Platform Admin fallback | **Pass** | Admin settings group under `/admin/growth/settings/*` plus infrastructure/provider routes remain discoverable. |
| Duplication | **Mostly clean** | No Growth items in Core visible nav. Data & Administration entries are admin-shell stubs with explicit admin fallback CTAs — not operator duplicates. |
| Broken routes (visible nav) | **None found** | All visible Core, Growth, and Platform Admin fallback nav items resolve to a page, redirect, or admin stub. |
| Placeholders | **Documented** | Voice/calling, calendar, and several Advanced-hub routes are navigation shells without persistence. |

---

## A. Final Core Settings Menu

Visible to workspace owners. **Data & Administration** appears only for platform admins (`isDataAdministrationSettingsNavVisible`).

| Group | Item | Route | Status | Notes |
|-------|------|-------|--------|-------|
| General | General | `/settings/general` | Functional | Profile, timezone, appearance |
| General | Notifications | `/settings/notifications` | Functional | Workspace notification preferences |
| General | Team | `/settings/team` | Functional | Member invites and management |
| General | Permissions | `/settings/permissions` | Functional | Role-based access |
| General | Security | `/settings/security` | Functional | Auth, sessions, policies |
| General | API / Developers | `/settings/api` | Functional | API keys; some tier preview UI |
| General | Audit Log | `/settings/audit-log` | Functional | Operational and security history |
| Workspace | Workspace | `/settings/workspace` | Functional | Company profile, branding, defaults |
| Workspace | Sample data | `/settings/sample-data` | Functional | Demo data load/remove |
| Workspace | Migration center | `/settings/imports` | Functional | Hub for historical imports (`/settings/migration-center` redirects here) |
| Workspace | Equipment Types | `/settings/equipment-types` | Functional | Equipment taxonomy |
| Workspace | Archived | `/settings/archived` | Functional | Archived records |
| Commercial | Billing | `/settings/billing` | Functional | Subscription and invoices |
| Commercial | Payments | `/settings/payments` | Functional | Customer payment processing |
| Commercial | AI Usage | `/settings/ai-usage` | Functional | Core/platform AI consumption — **not** Growth copilot |
| Commercial | Automations | `/settings/automations` | Functional | Core/Scale workspace automation rules |
| Commercial | Customer Portal | `/settings/portal` | Functional | Portal branding and access |
| Commercial | Integrations | `/settings/integrations` | Functional | Core third-party integrations |
| Diagnostics | Governance & Exports | `/settings/data-administration/governance-exports` | Admin Fallback Only | Admin shell stub → `/admin/growth/settings/governance` |
| Diagnostics | Provider Health | `/settings/data-administration/provider-health` | Admin Fallback Only | Admin shell stub → `/admin/growth/settings/provider-health` |
| Diagnostics | Deliverability Operations | `/settings/data-administration/deliverability-operations` | Admin Fallback Only | Admin shell stub → `/admin/growth/providers/deliverability-ops` |
| Diagnostics | Growth Diagnostics | `/settings/data-administration/growth-diagnostics` | Admin Fallback Only | Admin shell stub → `/admin/growth/settings/provider-health` |
| Diagnostics | System Logs | `/settings/data-administration/system-logs` | Admin Fallback Only | Admin shell stub → `/settings/audit-log` |

**Removed / not in visible Core nav (legacy registry only):**

| Group | Item | Route | Status | Notes |
|-------|------|-------|--------|-------|
| — | Growth Engine (all sections) | `/settings/growth-engine/*` | Redirect | Registry retained; `[sectionId]` redirects to `/growth/settings/*` |
| — | Growth Operator (all sections) | `/settings/growth-operator/*` | Redirect | Redirects to `/growth/settings/*` |
| — | Voice & Calling | — | Should Remove (from nav) | **Confirmed removed** from `buildWorkspaceSettingsRootCategories` |

---

## B. Final Growth Settings Menu

Canonical operator settings at `/growth/settings/*` (`GROWTH_WORKSPACE_SETTINGS_NAV_MANIFEST`).

| Group | Item | Route | Status | Notes |
|-------|------|-------|--------|-------|
| General | Profile | `/growth/settings/profile` | Functional | Persisted operator profile panel |
| General | Notifications | `/growth/settings/notifications` | Functional | Persisted Growth notification preferences |
| General | Personal Preferences | `/growth/settings/personal-preferences` | Functional | Persisted; admin fallback → `/admin/growth/settings/growth` |
| General | Sidebar Preferences | `/growth/settings/sidebar-preferences` | Functional | Persisted |
| General | Default Views | `/growth/settings/default-views` | Functional | Persisted |
| Communications | Communications | `/growth/settings/communications` | Functional | Hub with drill-down cards |
| Communications | Mailboxes | `/growth/settings/communications/connected-mailboxes` | Functional | Connected mailboxes dashboard |
| Communications | Sending Domains | `/growth/settings/communications/sending-domains` | Functional | Domain management |
| Communications | Deliverability & DNS | `/growth/settings/communications/dns-verification` | Functional | SPF/DKIM/DMARC verification |
| Communications | Warmup | `/growth/settings/communications/warmup` | Functional | Warmup schedules |
| Communications | Sender Pools | `/growth/settings/communications/sender-pools` | Functional | Pool rotation |
| Communications | Reputation | `/growth/settings/communications/sending-limits` | Functional | Reputation / send caps (canonical path) |
| Voice & Calling | Calling Preferences | `/growth/settings/calling-preferences` | Placeholder | Registered in nav; Phase 7D+ shell only |
| Meetings | Calendar Preferences | `/growth/settings/calendar-preferences` | Placeholder | Phase 7D+ shell only |
| Meetings | Calendar & Booking | `/growth/settings/calendar` | Placeholder | Phase 7D+ shell only |
| AI | AI Teammate | `/growth/settings/ai-teammate` | Functional | Persisted identity panel |
| AI | AI Preferences | `/growth/settings/ai-preferences` | Functional | `GrowthAiCopilotSettingsPanel`; admin link to communications settings |
| AI | Growth Autonomy | `/growth/settings/autonomy` | Functional | `GrowthAutonomyControlCenter` |
| Compliance | Compliance | `/growth/settings/compliance` | Functional | `GrowthComplianceDashboardPanel` |
| Advanced | Advanced | `/growth/settings/advanced` | Functional | Hub linking to migrating routes |

**Legacy aliases (not top-level nav, resolve correctly):**

| Route | Status | Notes |
|-------|--------|-------|
| `/growth/settings/communications/mailboxes` | Redirect | → connected-mailboxes |
| `/growth/settings/communications/deliverability` | Redirect | → dns-verification |
| `/growth/settings/communications/reputation` | Redirect | → sending-limits |
| `/growth/settings/connected-mailboxes` | Functional | Legacy flat path |
| `/growth/settings/delivery` | Redirect | → connected-mailboxes |
| `/growth/settings/signatures` | Functional | Email signatures panel (Advanced hub) |
| `/settings/growth-engine/*` | Redirect | → canonical Growth settings |
| `/settings/growth-operator/*` | Redirect | → `/growth/settings/*` |

---

## C. Platform Admin Fallback Settings Menu

From `GROWTH_NAV_GROUP_DEFS` → Settings group (Platform Admin chrome).

| Area/Menu | Item | Route | Status | Why It Should Stay |
|-----------|------|-------|--------|-------------------|
| Platform Admin → Settings | Growth | `/admin/growth/settings/growth` | Functional | Global Growth Engine behavior, safeguards, operating rules |
| Platform Admin → Settings | Communications | `/admin/growth/settings/communications` | Functional | Full channel/provider setup: mail, voice, calendar, booking, copilot |
| Platform Admin → Settings | Providers | `/admin/growth/calls/providers` | Functional | Telephony provider connections (Twilio, Telnyx, etc.) |
| Platform Admin → Settings | Voice Readiness | `/admin/growth/voice/readiness` | Functional | Production readiness certification for voice stack |
| Platform Admin → Settings | Provider Health | `/admin/growth/settings/provider-health` | Functional | Third-party provider health probes |
| Platform Admin → Settings | Governance | `/admin/growth/settings/governance` | Functional | Governance exports and compliance artifacts |

**Additional admin-only surfaces referenced by Core Data & Administration stubs:**

| Area | Route | Status | Why It Should Stay |
|------|-------|--------|-------------------|
| Deliverability Ops | `/admin/growth/providers/deliverability-ops` | Functional | Internal deliverability diagnostics |
| Infrastructure | `/admin/growth/infrastructure/*` | Functional | Mailboxes, warmup, deliverability admin consoles |
| Provider setup | `/admin/growth/providers/*` | Functional | Sender pools, compliance, webhooks, delivery |

These are **intentional admin fallbacks**, not accidental duplicates of operator Growth settings nav.

---

## D. Duplicate / Conflict Matrix

| Setting Concept | Core Route | Growth Route | Admin Fallback Route | Recommended Canonical Owner | Action |
|-----------------|------------|--------------|----------------------|----------------------------|--------|
| AI Teammate | — (redirect only) | `/growth/settings/ai-teammate` | — | **Growth** | Leave alone — Core redirect removed from nav |
| AI Preferences | — | `/growth/settings/ai-preferences` | `/admin/growth/settings/communications` | **Growth** (operator); Admin for provider keys | Leave alone |
| Growth Autonomy | — | `/growth/settings/autonomy` | `/admin/growth/settings/growth` (related) | **Growth** | Leave alone |
| Calling Preferences | — | `/growth/settings/calling-preferences` | `/admin/growth/settings/communications` | **Growth** (when wired) | Wire persistence next; admin fallback stays |
| Calendar Preferences | — | `/growth/settings/calendar-preferences` | `/admin/growth/settings/communications` | **Growth** | Wire persistence next |
| Calendar & Booking | — | `/growth/settings/calendar` | `/admin/growth/settings/communications` | **Growth** | Wire persistence next |
| Communications | — | `/growth/settings/communications/*` | `/admin/growth/settings/communications` | **Growth** (operator); Admin (infra) | Leave alone |
| Deliverability | — | `/growth/settings/communications/dns-verification` | `/admin/growth/infrastructure/deliverability` | **Growth** (operator); Admin (ops) | Leave alone |
| Provider Health | `/settings/data-administration/provider-health` (stub) | — | `/admin/growth/settings/provider-health` | **Admin Fallback** | Keep stub for platform admin entry; not operator-facing |
| Growth Diagnostics | `/settings/data-administration/growth-diagnostics` (stub) | — | `/admin/growth/settings/provider-health` | **Admin Fallback** | Keep as admin-only entry point |
| Automations | `/settings/automations` | — | — | **Core** | Leave alone — Core/Scale automation |
| AI Usage | `/settings/ai-usage` | — | — | **Core** | Leave alone — platform billing usage |

---

## E. Placeholder Page Inventory

| Route | Menu Owner | Placeholder Text / Evidence | Existing Code Location | Recommendation |
|-------|------------|----------------------------|------------------------|----------------|
| `/growth/settings/calling-preferences` | Growth (Voice & Calling nav) | "Coming in Phase 7D+" / "No persistence is wired in Phase 7C" | `components/growth/settings/growth-settings-section-placeholder.tsx` via `GrowthSettingsSectionPage` | Wire dialer/call preference persistence; keep route visible |
| `/growth/settings/calendar-preferences` | Growth (Meetings nav) | Same Phase 7D+ placeholder | `growth-settings-section-placeholder.tsx` | Wire meeting preference persistence |
| `/growth/settings/calendar` | Growth (Meetings nav) | Same Phase 7D+ placeholder | `growth-settings-section-placeholder.tsx` | Wire calendar providers + booking pages into operator settings |
| `/growth/settings/command-center-preferences` | Growth (Advanced hub) | Phase 7D+ placeholder | `app/(growth)/growth/settings/command-center-preferences/page.tsx` | Wire Cmd+K preferences or hide card until ready |
| `/growth/settings/browser-notifications` | Growth (Advanced hub) | Phase 7D+ placeholder | `app/(growth)/growth/settings/browser-notifications/page.tsx` | Wire browser notification permission UX |
| `/growth/settings/gmail` | Growth (Advanced hub) | Phase 7D+ placeholder | `app/(growth)/growth/settings/gmail/page.tsx` | Prefer mailboxes hub; consider redirect vs build |
| `/growth/settings/microsoft-365` | Growth (Advanced hub) | Phase 7D+ placeholder | `app/(growth)/growth/settings/microsoft-365/page.tsx` | Same as Gmail |
| `/settings/data-administration/governance-exports` | Core (platform admin) | "Administrative Tools" admin shell | `components/settings/workspace-settings-phase-placeholder.tsx` | Keep as admin entry; link to governance admin |
| `/settings/data-administration/provider-health` | Core (platform admin) | Admin shell + fallback CTA | `workspace-settings-phase-placeholder.tsx` | Keep as admin entry |
| `/settings/data-administration/deliverability-operations` | Core (platform admin) | Custom admin copy | `workspace-settings-data-admin-placeholder.ts` | Keep as admin entry |
| `/settings/data-administration/growth-diagnostics` | Core (platform admin) | Admin shell | `workspace-settings-phase-placeholder.tsx` | Keep as admin entry |
| `/settings/data-administration/system-logs` | Core (platform admin) | Admin shell → audit log | `workspace-settings-phase-placeholder.tsx` | Keep as admin entry |

---

## F. Broken Routes / 404s

**No broken routes found** among visible nav items in Core, Growth, or Platform Admin fallback menus (verified by `test-settings-menu-completeness-audit-1b`).

| Source Menu | Item | Route | Failure | Recommended Fix |
|-------------|------|-------|---------|-----------------|
| — | — | — | — | — |

**Previously reported issue — verified fixed:**

| Source Menu | Item | Route | Prior Failure | Current Status |
|-------------|------|-------|---------------|----------------|
| Core (removed) | Voice & Calling items | `/growth/settings/calling-preferences` | 404 when not registered | **Fixed** — page exists, nav item in Growth Voice & Calling group |

---

## G. Recommended Next Work Order

### 1. Visible but placeholder (highest priority)

1. **Calling Preferences** — `/growth/settings/calling-preferences` — operators see nav item; wire dialer defaults from admin communications panel.
2. **Calendar Preferences** — `/growth/settings/calendar-preferences` — lift meeting defaults from admin calendar settings.
3. **Calendar & Booking** — `/growth/settings/calendar` — calendar providers + booking pages operator UX.

### 2. Visible and broken

None at audit time.

### 3. Duplicated surfaces

No action required for operator nav. Data & Administration stubs are intentional admin entry points, not duplicates.

### 4. Should hide until built (optional)

- Advanced hub cards for **Gmail** / **Microsoft 365** if mailboxes hub remains canonical — consider redirects instead of placeholder pages.
- **Browser Notifications** — hide Advanced card until permission UX is ready (optional; route is not top-level nav).

### 5. Complete — leave alone

- All Core General + Workspace + Commercial settings
- Growth persisted panels: Profile, Notifications, Personal/Sidebar/Default Views, AI Teammate
- Growth Communications sub-routes (mailboxes, domains, DNS, warmup, pools, reputation)
- Growth AI Preferences, Autonomy, Compliance
- Platform Admin settings group (Growth, Communications, Providers, Voice Readiness, Provider Health, Governance)
- Legacy redirects: `/settings/growth-engine/*`, `/settings/growth-operator/*`, communications legacy slugs

---

## Certification

```bash
pnpm test:settings-menu-completeness-audit-1b
```

Verifies:

- Core settings nav contains no `/growth/settings/*` hrefs
- Core settings nav contains no Growth/AI OS-only items
- Growth settings nav includes all canonical Growth/AI OS sections
- Platform Admin fallback routes are discoverable and do not reuse operator Growth settings hrefs
- Every visible nav item resolves to a real page, redirect, or admin stub
- Placeholder pages are detected and listed
- No visible nav item points to a 404
- Voice & Calling absent from Core nav; present in Growth nav
- Calling and calendar Growth routes registered
