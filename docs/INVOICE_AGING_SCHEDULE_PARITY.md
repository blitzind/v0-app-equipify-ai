# Invoice aging + service schedule operational parity (Phase 1)

## Summary

Extended the shared operational intelligence layer so **dispatch** and **service-schedule** both show billing/invoice aging, completed-but-not-invoiced cues, certificate release-on-payment awareness (aligned with portal rules), PM/calibration risk, schedule slip (past scheduled date), technician overlap warnings on the schedule list, and a lightweight KPI strip on dispatch.

No scheduling rewrite; enrichment stays batched in `enrichDispatchWorkOrders`.

## Migrations

**None.** Invoice aging uses existing `org_invoices.due_date`, `issued_at`, `status`, `work_order_id`, `invoice_work_order_links`, and portal certificate columns already introduced in prior migrations.

## Key modules

| Area | File |
|------|------|
| Invoice batch + aggregates | `lib/dispatch/work-order-invoice-agg.ts` (`fetchWorkOrderInvoiceOpsBatch`) |
| Badges, filters, KPI inputs | `lib/dispatch/operational-badges.ts` |
| Enrichment wiring | `lib/dispatch/build-dispatch-wos.ts` (`enrichDispatchWorkOrders`, `DispatchWoRow`) |
| Dispatch UI | `app/(dashboard)/dispatch/page.tsx` |
| Service schedule UI | `app/(dashboard)/service-schedule/page.tsx` |

## Operational filters

Shared list: `DISPATCH_FOCUS_OPTIONS` + `DispatchFilterId` in `operational-badges.ts`. Dispatch uses chip buttons; service schedule uses the same set in a `<Select>` for mobile-friendly filtering.

## Future phases (TODO)

- Wire schedule **customer / technician** filters to roster-derived names where maintenance-plan mocks diverge from live profiles.
- Timeline events for **invoice overdue / payment received** using existing timeline hooks when available on detail APIs.
- Narrow **revenue_at_risk** heuristic if `not_invoiced` proves noisy in production.
- Optional **date-range** filter for scheduled work orders (API query params).
