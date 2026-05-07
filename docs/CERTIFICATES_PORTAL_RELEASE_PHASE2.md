# Certificates + Portal Release Workflow — Phase 2

Additive enhancements that extend the Phase 1 calibration_records / portal
release rules with: certificate file attachments, technician signature
foundations, and clearer staff/portal communication around release behavior.
No existing schema or generated certificate output is rewritten.

## Files changed

### Migration
- `supabase/migrations/20260722120000_certificate_workflow_phase2.sql` — adds
  the `certificate_attachments` table (linked to `work_orders`,
  optionally to `equipment` and `calibration_records`), the
  `technicians.signature_url` + `technicians.signature_updated_at` columns, and
  a new private `equipify-signatures` storage bucket with RLS-equivalent
  storage policies (read for any org member, write for owners/admins/managers).

### Helpers
- `lib/certificates/certificate-attachments.ts` — list / upload / delete +
  signed URL helpers for uploaded calibration PDFs and supplementary docs.
  Files are stored in the existing `work-order-attachments` bucket so no new
  bucket policies are required.
- `lib/technicians/signature-storage.ts` — load / upload / delete + signed URL
  helpers for technician signatures stored in the new `equipify-signatures`
  bucket. Schema-drift safe — degrades gracefully when the Phase 2 migration
  hasn't been applied yet.

### Components
- `components/work-orders/certificate-attachments-card.tsx` — embedded
  attachments list / upload UI for the Work Order Certificates tab.
- `components/technicians/technician-signature-card.tsx` — self-managed card +
  `TechnicianSignatureCardForMember` wrapper that resolves the operational
  `technicians.id` from the drawer's user/membership identifier and renders
  nothing when the org has not migrated to operational technicians yet.
- `components/customers/customer-portal-certificate-rule-card.tsx` — read-only
  clarity card on the customer detail Overview tab. Shows whether the
  customer inherits the workspace default release rule or overrides it, and
  explains the policy in human language.

### Wiring
- `components/work-orders/certificate-multi-tab-content.tsx` — embeds the
  attachments card per asset, fetches the assigned technician's stored
  signature path, and uses it as the cert output's
  `technicianSignatureDataUrl` fallback when no fresh visit signature was
  captured.
- `components/work-orders/certificate-tab-content.tsx` — accepts a new
  `attachmentsSlot` ReactNode prop rendered above the template fields.
- `components/drawers/technician-drawer.tsx` — renders the
  `TechnicianSignatureCardForMember` on the Overview tab. Hidden when the
  drawer's identifier doesn't resolve to a `technicians` row (legacy orgs).
- `app/(dashboard)/customers/[id]/page.tsx` — renders the new
  `CustomerPortalCertificateRuleCard` at the top of the Overview tab.
- `components/invoices/invoice-portal-certificate-panel.tsx` — adds a status
  row showing the linked job's certificate count, how many are already
  released, and a "Blocked until invoice paid" pill when the effective rule
  is `release_on_payment` and any linked invoice is unpaid.
- `lib/calibration-certificates.ts` — `CompletedCertificateListItem` now
  carries an optional `technicianSignaturePath`. The single-record loader
  populates it (schema-drift safe) and `buildCompletedCertificatePdfHtml`
  resolves it to a signed URL for download / portal use when no fresh
  signature is captured.
- `app/(portal)/portal/certificates/page.tsx` — clearer status pills per row
  ("Available" / "Awaiting payment" / "Awaiting release"), explicit "Not yet
  available" CTA when locked, and a top-of-page hint when any cert is
  pending release.

### Generated
- `lib/admin/master-context.generated.ts` — regenerated via
  `pnpm update:master-context`.

## Architectural decisions

1. **Reuse `work-order-attachments` storage bucket for cert PDFs**. The
   existing private bucket already supports the path scheme
   `{org_uuid}/{wo_uuid}/...`. Cert attachments use that same scheme with a
   `cert-...` filename prefix, which means we did not need new storage
   policies. Cleanup is straightforward because deletes go through the
   `certificate_attachments` row helper.

2. **Dedicated `equipify-signatures` bucket for technician signatures**. The
   existing bucket's path constraint (`split_part(name, '/', 2) ~ uuid`) is
   tied to work order ids. Technician signatures live under
   `{org}/technicians/{tech_id}/signature-...`, so a small dedicated bucket
   with simple per-org RLS keeps concerns separated. 2 MiB cap; PNG/JPEG/WEBP
   only.

3. **Technician signature is auto-applied as a fallback**. The existing fresh
   `repair_log.signatureDataUrl` (captured live during a visit) always wins.
   The stored technician signature is only rendered when no fresh signature
   was captured. This preserves the current "live signature when present"
   semantics and is fully additive.

4. **Schema-drift safety**. Every Phase 2 helper detects the missing column
   / table case (`certificate_attachments` table missing, technicians
   `signature_url` missing) and degrades to an empty result. Pages render
   normally on databases that haven't yet applied the migration.

5. **No invoice schema changes**. Invoice-level certificate visibility is
   delivered entirely as a UI enhancement on top of the Phase 1
   `org_invoices.portal_certificate_release_override` and existing portal
   release helpers.

6. **No raw UUIDs in any UI surface**. All status/policy text uses the
   `modeLabel()` and `staffPortalCertificateBullets()` helpers from Phase 1.

## TODOs / follow-up

- Surface a "Release all certificates" bulk action when the manual-release
  policy is in effect (currently single-record only).
- Auto-link a freshly uploaded external calibration PDF to a saved
  `calibration_record` when one already exists for the same equipment +
  work order combination.
- Emit a portal notification (email) when a previously-locked certificate
  becomes available because its linked invoice was paid.
- Profile-level (non-technician) signature support for orgs that primarily
  use `assigned_user_id` workflows.

## Verification / build status

- `pnpm update:master-context` — regenerated `master-context.generated.ts`
  (127 API routes, 98 migrations).
- `pnpm build` — succeeds with no warnings/errors.
- TypeScript strict mode — clean.
- ReadLints across modified files — clean.

## Deploy notes

- Apply the new migration:
  `supabase/migrations/20260722120000_certificate_workflow_phase2.sql`.
  Migration is fully additive and idempotent (`if not exists` everywhere).
- The new `equipify-signatures` storage bucket is created automatically by
  the migration (`insert into storage.buckets ... on conflict do update`).
- After deploy: existing certificate output is unchanged when no signatures
  are uploaded and no attachments exist. Behavior changes only when staff
  upload via the new UIs.
