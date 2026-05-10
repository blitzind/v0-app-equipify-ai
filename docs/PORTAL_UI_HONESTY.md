# Portal UI honesty (Phase 56.2B)

Principles for customer portal and staff portal preview chrome:

1. **No fake affordances** — If a control has no handler and no route, it does not belong as a button, dropdown trigger, or notification dot.
2. **Prefer removal** over placeholder interactivity; use a short text link when a real route exists (e.g. preview **Account (preview)** → `/portal/preview/account`).
3. **Customer menu** — Only items that perform real navigation or sign-out; avoid duplicate/misleading labels (e.g. “Settings” must not point at the dashboard when no settings page exists there).
4. **Staff preview** — The “Staff preview” pill remains the single prominent mode badge; customer selection uses a **real** `<select>` (`View as customer`), not a decorative profile dropdown.
5. **Future features** — When something ships (notifications, etc.), add UI with real wiring rather than reviving inert shells.

## Phase 56.2B changes

| Location | Removed / changed |
| --- | --- |
| `components/portal/portal-shell.tsx` | Notification bell + unread dot (no backend). |
| `components/portal/portal-shell.tsx` | User menu item “Settings” linking to `/portal/dashboard` (misleading duplicate of overview). |
| `components/portal/staff-preview-frame.tsx` | Inert notification bell + dot; fake “Preview” profile row with chevron (no menu). |
| `components/portal/staff-preview-frame.tsx` | Added honest link **Account (preview)** to the existing preview account page. |
| `components/portal/staff-portal-preview-customer-picker.tsx` | Label **View as customer** (clarifies functional `<select>` vs decorative preview chrome). |

## Related docs

- `docs/PORTAL_PREVIEW_CONTEXT.md` — preview security and navigation.
- `docs/PORTAL_SETTINGS_PROPAGATION.md` — which staff settings persist.
