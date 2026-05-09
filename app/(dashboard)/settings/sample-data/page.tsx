"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Database, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { normalizeIndustryKey, type DemoIndustryKey } from "@/lib/demo-seeding/profiles"

const RESET_CONFIRM = "RESET_SAMPLE_DATA"

function SettingCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

type DemoStatusResponse = {
  demoSeedIndustry: string | null
  industryOptions: { value: DemoIndustryKey; label: string }[]
  message?: string
}

export default function SampleDataSettingsPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()

  const [statusLoading, setStatusLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [demoSeedIndustry, setDemoSeedIndustry] = useState<string | null>(null)
  const [industryOptions, setIndustryOptions] = useState<{ value: DemoIndustryKey; label: string }[]>([])
  const [selectedIndustry, setSelectedIndustry] = useState<DemoIndustryKey>("commercial_equipment")

  const [importLoading, setImportLoading] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") return
    setStatusLoading(true)
    setForbidden(false)
    try {
      const res = await fetch(
        `/api/demo-data?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      )
      const json = (await res.json()) as DemoStatusResponse
      if (res.status === 403) {
        setForbidden(true)
        setIndustryOptions([])
        setDemoSeedIndustry(null)
        return
      }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not load sample data settings",
          description: json.message ?? res.statusText,
        })
        return
      }
      setDemoSeedIndustry(json.demoSeedIndustry ?? null)
      setIndustryOptions(json.industryOptions ?? [])
      const keys = (json.industryOptions ?? []).map((o) => o.value)
      const normalizedSeed = json.demoSeedIndustry ? normalizeIndustryKey(json.demoSeedIndustry) : null
      const preferred =
        (normalizedSeed && keys.includes(normalizedSeed) ? normalizedSeed : keys[0]) ?? "commercial_equipment"
      setSelectedIndustry(preferred as DemoIndustryKey)
    } finally {
      setStatusLoading(false)
    }
  }, [organizationId, orgStatus])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const currentIndustryLabel = useMemo(() => {
    if (!demoSeedIndustry) return null
    const nk = normalizeIndustryKey(demoSeedIndustry)
    const row = industryOptions.find((o) => o.value === nk)
    return row?.label ?? nk.replace(/_/g, " ")
  }, [demoSeedIndustry, industryOptions])

  async function handleImport() {
    if (!organizationId) return
    setImportLoading(true)
    try {
      const res = await fetch("/api/demo-data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          industry: selectedIndustry,
        }),
      })
      const json = (await res.json()) as { message?: string; counts?: Record<string, number> }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Import failed",
          description: json.message ?? "Check workspace is empty of sample rows or non-sample customers.",
        })
        return
      }
      toast({
        title: "Sample data imported",
        description: `Seeded demo bundle for ${selectedIndustry.replace(/_/g, " ")}.`,
      })
      await loadStatus()
    } finally {
      setImportLoading(false)
    }
  }

  async function handleReset() {
    if (!organizationId) return
    setResetLoading(true)
    try {
      const res = await fetch("/api/demo-data/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          confirmation: resetPhrase.trim(),
        }),
      })
      const json = (await res.json()) as { message?: string; summary?: Record<string, number> }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Reset failed",
          description: json.message ?? res.statusText,
        })
        return
      }
      toast({
        title: "Sample data removed",
        description: "Rows marked as sample were deleted. Billing, team, and settings were not changed.",
      })
      setResetOpen(false)
      setResetPhrase("")
      await loadStatus()
    } finally {
      setResetLoading(false)
    }
  }

  if (orgStatus !== "ready" || !organizationId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading workspace…
      </div>
    )
  }

  if (forbidden) {
    return (
      <SettingCard
        title="Sample data"
        description="Industry-based demo bundles for training and demos."
      >
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can reset or import sample data. Platform administrators may use this
          while viewing an account.
        </p>
      </SettingCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingCard
        title="Sample & demo data"
        description="Loads or clears demo-only rows for this workspace. Real customer records you create are never deleted unless they are explicitly marked as sample."
      >
        {statusLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Current sample industry</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentIndustryLabel ? (
                    <>
                      Last import profile: <span className="text-foreground font-medium">{currentIndustryLabel}</span>
                    </>
                  ) : (
                    "No industry recorded yet — import a bundle below or use onboarding seeding."
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-3 max-w-xl">
              <label className="text-xs font-medium text-muted-foreground">Industry for import</label>
              <Select
                value={selectedIndustry}
                onValueChange={(v) => setSelectedIndustry(v as DemoIndustryKey)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose industry profile" />
                </SelectTrigger>
                <SelectContent className="max-h-[min(60vh,320px)]">
                  {industryOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {`${o.label} (${o.value})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Import uses the same generator as onboarding (`seedDemoForIndustry`). Your workspace must have no
                customer rows except after a full sample reset.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleImport()} disabled={importLoading}>
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Import sample data
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setResetPhrase("")
                  setResetOpen(true)
                }}
                disabled={resetLoading}
              >
                Reset sample data…
              </Button>
            </div>
          </div>
        )}
      </SettingCard>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sample-marked data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This permanently removes demo-only rows for this workspace: customers, equipment, work orders,
                  maintenance plans, prospects, catalog and inventory (including precision-demo locations under{" "}
                  <span className="font-mono text-foreground">PBS-SEED-*</span>), sample vendors, quotes and invoices
                  marked sample, demo communications (including timeline entries tagged in seed metadata), and demo
                  technician memberships from the importer. Organization profile, subscriptions, non-sample users,
                  billing, and workspace settings are preserved.
                </p>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Confirmation phrase</label>
                  <Input
                    value={resetPhrase}
                    onChange={(e) => setResetPhrase(e.target.value)}
                    placeholder={RESET_CONFIRM}
                    autoComplete="off"
                  />
                  <p className="text-[11px] mt-1">
                    Type <code className="font-mono bg-muted px-1 rounded">{RESET_CONFIRM}</code> to confirm.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={resetLoading || resetPhrase.trim() !== RESET_CONFIRM}
              onClick={() => void handleReset()}
            >
              {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reset sample data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
