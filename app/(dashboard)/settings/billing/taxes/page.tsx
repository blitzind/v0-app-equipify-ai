"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type TaxSettingsPayload = {
  autoTaxEnabled: boolean
  fallbackTaxRatePercent: number
  taxableLaborDefault: boolean
  taxablePartsDefault: boolean
  sourcingMode: "origin" | "destination"
  manualOverrideAllowed: boolean
  primaryProvider: string
}

const DEFAULT_SETTINGS: TaxSettingsPayload = {
  autoTaxEnabled: false,
  fallbackTaxRatePercent: 0,
  taxableLaborDefault: true,
  taxablePartsDefault: true,
  sourcingMode: "destination",
  manualOverrideAllowed: true,
  primaryProvider: "equipify_native",
}

export default function BillingTaxesSettingsPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const orgPermissions = useOrgPermissions()
  const canEdit = orgPermissions.status === "ready" && orgPermissions.has("canEditOrgBilling")
  const canView =
    orgPermissions.status === "ready" &&
    (orgPermissions.has("canViewBilling") ||
      orgPermissions.has("canEditInvoices") ||
      orgPermissions.has("canApproveInvoices"))

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<TaxSettingsPayload>(DEFAULT_SETTINGS)

  const load = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/sales-tax/settings`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Could not load tax settings.")
      const data = (await res.json()) as { settings?: Partial<TaxSettingsPayload> }
      const s = data.settings ?? {}
      setValues({
        autoTaxEnabled: Boolean(s.autoTaxEnabled),
        fallbackTaxRatePercent: Number(s.fallbackTaxRatePercent ?? 0),
        taxableLaborDefault: s.taxableLaborDefault !== false,
        taxablePartsDefault: s.taxablePartsDefault !== false,
        sourcingMode: s.sourcingMode === "origin" ? "origin" : "destination",
        manualOverrideAllowed: s.manualOverrideAllowed !== false,
        primaryProvider: String(s.primaryProvider ?? "equipify_native"),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.")
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    if (orgStatus === "ready" && organizationId) void load()
  }, [orgStatus, organizationId, load])

  async function save() {
    if (!organizationId || !canEdit) return
    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/sales-tax/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          autoTaxEnabled: values.autoTaxEnabled,
          fallbackTaxRatePercent: values.fallbackTaxRatePercent,
          taxableLaborDefault: values.taxableLaborDefault,
          taxablePartsDefault: values.taxablePartsDefault,
          sourcingMode: values.sourcingMode,
          manualOverrideAllowed: values.manualOverrideAllowed,
          primaryProvider: values.primaryProvider,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Save failed")
      toast({ title: "Tax settings saved" })
      await load()
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className={PAGE_STANDARD_PAGE_TITLE}>
        <p className="text-sm text-muted-foreground">Select a workspace to configure sales tax.</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className={PAGE_STANDARD_PAGE_TITLE}>
        <p className="text-sm text-muted-foreground">You do not have access to billing tax settings.</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", PAGE_STANDARD_PAGE_TITLE)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Percent className="size-5 text-primary" aria-hidden />
            <h1 className="text-lg font-semibold text-foreground">Sales tax</h1>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Workspace-level defaults for US sales tax on invoices, quotes, and recurring membership billing. Rates come
            from the Equipify reference catalog (extendable per state). This engine is deterministic — it does not file
            or remit taxes.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <Link href="/settings/billing" className="text-primary underline-offset-4 hover:underline">
              ← Back to Billing
            </Link>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="max-w-xl space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Automatic tax calculation</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                When enabled, invoices use server-side jurisdiction stacking (California first). Manual per-invoice tax
                stays available unless disabled below.
              </p>
            </div>
            <Switch
              checked={values.autoTaxEnabled}
              onCheckedChange={(v) => setValues((p) => ({ ...p, autoTaxEnabled: v }))}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fallback-rate">Fallback tax rate (%)</Label>
            <Input
              id="fallback-rate"
              type="number"
              step="0.0001"
              min={0}
              max={100}
              value={values.fallbackTaxRatePercent}
              onChange={(e) =>
                setValues((p) => ({ ...p, fallbackTaxRatePercent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))
              }
              disabled={!canEdit}
            />
            <p className="text-[11px] text-muted-foreground">
              Applied when no jurisdiction rows match (e.g. unsupported ZIP) so tax is never silently zeroed unless exempt.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-sm">Taxable labor (default)</span>
              <Switch
                checked={values.taxableLaborDefault}
                onCheckedChange={(v) => setValues((p) => ({ ...p, taxableLaborDefault: v }))}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-sm">Taxable parts / materials (default)</span>
              <Switch
                checked={values.taxablePartsDefault}
                onCheckedChange={(v) => setValues((p) => ({ ...p, taxablePartsDefault: v }))}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sourcing">Sourcing mode</Label>
            <select
              id="sourcing"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs"
              value={values.sourcingMode}
              onChange={(e) =>
                setValues((p) => ({ ...p, sourcingMode: e.target.value === "origin" ? "origin" : "destination" }))
              }
              disabled={!canEdit}
            >
              <option value="destination">Destination (customer / service address)</option>
              <option value="origin">Origin (billing proxy until org HQ is modeled)</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Allow manual tax overrides on documents</p>
              <p className="text-xs text-muted-foreground">Turn off to require automated or exempt paths only.</p>
            </div>
            <Switch
              checked={values.manualOverrideAllowed}
              onCheckedChange={(v) => setValues((p) => ({ ...p, manualOverrideAllowed: v }))}
              disabled={!canEdit}
            />
          </div>

          <div className="rounded-md border border-dashed border-border bg-muted/10 p-3 text-[11px] text-muted-foreground space-y-1.5">
            <p>
              <span className="font-medium text-foreground">Customer exemptions</span> use customer and location tax
              exemption fields in CRM. <span className="font-medium text-foreground">Overrides</span> can be set per
              customer in <code className="text-foreground">customer_tax_overrides</code> (fixed combined rate or forced
              exempt).
            </p>
            <p>
              Future providers (Stripe Tax, Avalara, TaxJar) will plug into{" "}
              <code className="text-foreground">primaryProvider</code>; today only{" "}
              <code className="text-foreground">equipify_native</code> is supported end-to-end.
            </p>
          </div>

          {canEdit ? (
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save tax settings"
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only billing administrators can edit these settings.</p>
          )}
        </div>
      )}
    </div>
  )
}
