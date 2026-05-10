"use client"

/**
 * Customer Hierarchy + Billing/Service Address — Phase 1
 *
 * Lightweight summary card mounted in both the customer drawer and the full
 * customer detail page. Shows:
 *   - parent account (link out)
 *   - child accounts (count + names; link to filter the customer list)
 *   - total locations
 *   - default service address
 *   - billing address (or "Same as default service location")
 *
 * Strict rules:
 *   - never expose raw UUIDs
 *   - never block parent UI on this card's data
 *   - dark-mode + mobile responsive
 */

import Link from "next/link"
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  ExternalLink,
  MapPin,
  ReceiptText,
  Network,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { invoiceTermsCodeLabel } from "@/lib/billing/invoice-terms"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  formatBillingAddressLine,
  formatServiceAddressLine,
  type CustomerHierarchySummary,
} from "@/lib/customers/hierarchy"

type Props = {
  summary: CustomerHierarchySummary | null
  /** Show during the initial load. */
  loading?: boolean
  /** Optional companyName so the card can render when summary not yet loaded. */
  companyName?: string
  className?: string
  /** Variant tweaks padding/border for the slimmer drawer rail. Defaults to "page". */
  variant?: "page" | "drawer"
  /** When provided, surfaces a "Manage" CTA in the card header. */
  onManage?: () => void
  /** When true, hides the manage CTA even when `onManage` is provided. */
  hideManageButton?: boolean
}

function HierarchyStat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "warning"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border bg-muted/25 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(0,0,0,0.02)]",
        tone === "warning" ? "border-[color:var(--status-warning)]/35" : "border-border",
      )}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground tabular-nums leading-tight">
        {value}
      </span>
    </div>
  )
}

export function CustomerHierarchyCard({
  summary,
  loading,
  companyName,
  className,
  variant = "page",
  onManage,
  hideManageButton = false,
}: Props) {
  const drawer = variant === "drawer"
  const showManage = Boolean(onManage) && !hideManageButton

  if (loading || !summary) {
    return (
      <Card
        className={cn(
          "border-border",
          drawer ? "shadow-[0_1px_3px_rgba(0,0,0,0.06)]" : "",
          className,
        )}
      >
        <CardHeader className={cn(drawer ? "pb-2" : "pb-3")}>
          <CardTitle
            className={cn(drawer ? "text-sm" : "text-base", "flex items-center gap-2")}
          >
            <Network className="h-4 w-4 text-muted-foreground" aria-hidden />
            Hierarchy &amp; addresses
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(drawer ? "pt-0 pb-3" : "")}>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading hierarchy…" : "Hierarchy unavailable for this customer."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const {
    parent,
    children,
    locationCount,
    childCount,
    defaultServiceAddress,
    billingAddress,
    billingAddressMissing,
    schemaMigrationPending,
  } = summary

  const billingLine = formatBillingAddressLine(billingAddress)
  const serviceLine = formatServiceAddressLine(defaultServiceAddress)
  const isParentAccount = childCount > 0
  const isChildAccount = Boolean(parent)

  return (
    <Card
      className={cn(
        "border-border",
        drawer ? "shadow-[0_1px_3px_rgba(0,0,0,0.06)]" : "",
        className,
      )}
    >
      <CardHeader className={cn(drawer ? "pb-2" : "pb-3", "flex-row items-center gap-2 space-y-0")}>
        <CardTitle
          className={cn(
            drawer ? "text-sm" : "text-base",
            "flex items-center gap-2 min-w-0 flex-1",
          )}
        >
          <Network className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <span className="truncate">Hierarchy &amp; addresses</span>
        </CardTitle>
        <div className="flex shrink-0 items-center gap-1">
          {isParentAccount ? (
            <Badge
              variant="secondary"
              className="border border-primary/30 bg-primary/10 text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              Parent account
            </Badge>
          ) : null}
          {isChildAccount ? (
            <Badge
              variant="secondary"
              className="border border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--status-info)]"
            >
              Sub-account
            </Badge>
          ) : null}
          {showManage ? (
            <button
              type="button"
              onClick={onManage}
              className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              Manage
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn(drawer ? "pt-0 pb-3 space-y-3" : "space-y-4")}>
        {schemaMigrationPending ? (
          <div className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
            Hierarchy fields are not yet available on this database. Run the latest
            migration to enable parent/child accounts and explicit billing addresses.
          </div>
        ) : null}

        {/* Quick stats */}
        <div className={cn("grid gap-2", drawer ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-3")}>
          <HierarchyStat
            icon={<MapPin className="h-3 w-3" aria-hidden />}
            label="Locations"
            value={String(locationCount)}
          />
          <HierarchyStat
            icon={<Building2 className="h-3 w-3" aria-hidden />}
            label="Sub-accounts"
            value={String(childCount)}
          />
          <HierarchyStat
            icon={<ReceiptText className="h-3 w-3" aria-hidden />}
            label="Billing"
            value={
              billingAddressMissing
                ? "Missing"
                : billingAddress.inheritsFromDefaultLocation
                  ? "Primary site"
                  : billingAddress.usesSecondaryBillingLocation
                    ? "Billing site"
                    : "Custom"
            }
            tone={billingAddressMissing ? "warning" : "default"}
          />
        </div>

        {/* Parent / children */}
        {parent ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Parent account
            </p>
            <Link
              href={`/customers/${parent.id}`}
              className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
            >
              {parent.companyName}
              <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden />
            </Link>
            {companyName ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{companyName}</span> rolls
                up under this parent for consolidated reporting.
              </p>
            ) : null}
          </div>
        ) : null}

        {children.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sub-accounts ({children.length})
              </p>
              <Link
                href={`/customers?parent=${encodeURIComponent(summary.customerId)}`}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                View all
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <ul className="mt-1.5 space-y-1">
              {children.slice(0, 5).map((child) => (
                <li key={child.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/customers/${child.id}`}
                    className="truncate text-xs font-medium text-foreground hover:text-primary"
                  >
                    {child.companyName}
                  </Link>
                  {child.status === "inactive" ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Inactive
                    </span>
                  ) : null}
                </li>
              ))}
              {children.length > 5 ? (
                <li className="text-[11px] text-muted-foreground">
                  + {children.length - 5} more
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {/* Service address */}
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden />
            Default service address
          </p>
          {serviceLine ? (
            <>
              {defaultServiceAddress?.name ? (
                <p className="mt-0.5 text-xs font-semibold text-foreground">
                  {defaultServiceAddress.name}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-foreground">{serviceLine}</p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              No service address on file.
            </p>
          )}
        </div>

        {/* Billing address */}
        <div
          className={cn(
            "rounded-lg border bg-muted/20 px-3 py-2",
            billingAddressMissing
              ? "border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/5"
              : "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ReceiptText className="h-3 w-3" aria-hidden />
              Billing address
            </p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                billingAddress.inheritsFromDefaultLocation || billingAddress.usesSecondaryBillingLocation
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary",
              )}
            >
              {billingAddress.inheritsFromDefaultLocation
                ? "Same as primary"
                : billingAddress.usesSecondaryBillingLocation
                  ? "Saved location"
                  : "Custom"}
            </span>
          </div>
          {billingAddress.attention ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Attn: <span className="font-medium text-foreground">{billingAddress.attention}</span>
            </p>
          ) : null}
          {billingAddress.usesSecondaryBillingLocation && billingAddress.billingLocationName ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Bill-to site:{" "}
              <span className="font-medium text-foreground">{billingAddress.billingLocationName}</span>
            </p>
          ) : null}
          {billingLine ? (
            <p className="mt-0.5 text-xs text-foreground">{billingLine}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              No billing address on file.
            </p>
          )}
          {billingAddress.email ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Email: <span className="font-medium text-foreground">{billingAddress.email}</span>
            </p>
          ) : null}
          {billingAddress.poRequired || billingAddress.poRequiredBeforeService || billingAddress.poRequiredBeforeInvoice ? (
            <div className="mt-2 rounded-md border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-2 py-1.5 text-[11px] text-[color:var(--status-warning)]">
              <p className="font-semibold text-foreground">PO requirements</p>
              <p>
                {[
                  billingAddress.poRequired ? "PO required" : null,
                  billingAddress.poRequiredBeforeService ? "before service" : null,
                  billingAddress.poRequiredBeforeInvoice ? "before invoice" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {billingAddress.defaultPoNumber ? ` · Default ${billingAddress.defaultPoNumber}` : ""}
              </p>
            </div>
          ) : null}
          {billingAddress.defaultPaymentTermsKey ? (
            <p className="mt-2 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Payment terms:</span>{" "}
              {billingAddress.defaultPaymentTermsLabel || invoiceTermsCodeLabel(billingAddress.defaultPaymentTermsKey)}
              {billingAddress.defaultPaymentTermsKey === "custom" && billingAddress.defaultPaymentTermsDays
                ? ` (${billingAddress.defaultPaymentTermsDays} days)`
                : ""}
            </p>
          ) : null}
          {billingAddress.taxExempt || billingAddress.defaultTaxBasis || billingAddress.defaultTaxCategory ? (
            <p className="mt-2 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Tax defaults:</span>{" "}
              {[
                billingAddress.taxExempt ? "Tax exempt" : null,
                billingAddress.defaultTaxBasis ? `Basis ${billingAddress.defaultTaxBasis.replace(/_/g, " ")}` : null,
                billingAddress.defaultTaxCategory ? `Category ${billingAddress.defaultTaxCategory}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {billingAddress.invoiceInstructions ? (
            <p className="mt-2 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Invoice instructions:</span>{" "}
              {billingAddress.invoiceInstructions}
            </p>
          ) : null}
          {billingAddressMissing ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-2 py-1.5 text-[11px] text-[color:var(--status-warning)]">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                No billing address yet. Invoices and POs need a bill-to street/city — add a
                primary service location, pick a billing site, or set a custom bill-to address.
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
