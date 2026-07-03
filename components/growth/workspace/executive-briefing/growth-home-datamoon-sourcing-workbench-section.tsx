"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, Loader2, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { DatamoonSourcingWorkbenchForm } from "@/components/growth/lead-sources/datamoon/datamoon-sourcing-workbench-form"
import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  createDefaultAvaDatamoonAudienceDraft,
  type AvaDatamoonAudienceDraft,
  type AvaDatamoonSourcingWorkbenchMode,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER,
  GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER,
  GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL,
  GROWTH_HOME_ADVANCED_SEARCH_SECTION_LABEL,
  GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL,
  GROWTH_HOME_ASK_AVA_PLACEHOLDER,
  GROWTH_HOME_ASK_AVA_TAB_LABEL,
  GROWTH_HOME_AVA_ASK_DRAFT_LABEL,
  GROWTH_HOME_BUILD_AUDIENCE_LABEL,
  GROWTH_HOME_DATAMOON_RUNS_API_PATH,
  GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH,
  GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL,
  GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_STARTED_COPY,
  GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY,
  GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL,
  GROWTH_HOME_DATAMOON_CONTINUE_MANUALLY_LABEL,
  GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR,
  GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL,
  GROWTH_HOME_FIND_LEADS_CARD_MISSING_PROFILE_COPY,
  GROWTH_HOME_FIND_LEADS_CTA,
  GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION,
  GROWTH_HOME_FIND_LEADS_EXAMPLES,
  GROWTH_HOME_FIND_LEADS_SECONDARY_COPY,
  GROWTH_HOME_FIND_LEADS_SUBTITLE,
  GROWTH_HOME_FIND_LEADS_TITLE,
  GROWTH_HOME_IMPORT_RECOMMENDED_LABEL,
  GROWTH_HOME_IMPORT_SELECTED_LABEL,
  GROWTH_HOME_POWERED_BY_DATAMOON_LABEL,
  GROWTH_HOME_REFRESH_SAVED_SEARCH_LABEL,
  GROWTH_HOME_REJECT_SELECTED_LABEL,
  GROWTH_HOME_RESET_SEARCH_LABEL,
  GROWTH_HOME_SAVE_SEARCH_LABEL,
  type GrowthHomeDatamoonSourcingDraftApiResponse,
} from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import type {
  DatamoonAudienceImportRecord,
  DatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { DatamoonProviderDiagnostics } from "@/lib/growth/providers/datamoon"

function runStatusTone(status: DatamoonAudienceImportRun["status"]) {
  switch (status) {
    case "completed":
    case "imported":
      return "healthy" as const
    case "building":
    case "importing":
    case "pending_build":
      return "medium" as const
    case "failed":
      return "critical" as const
    default:
      return "attention" as const
  }
}

export function GrowthHomeDatamoonSourcingWorkbenchSection() {
  const [open, setOpen] = useState(false)
  const [providerDetailsOpen, setProviderDetailsOpen] = useState(false)
  const [mode, setMode] = useState<AvaDatamoonSourcingWorkbenchMode>("ava_draft")
  const [command, setCommand] = useState(GROWTH_HOME_FIND_LEADS_EXAMPLES[0])
  const [draft, setDraft] = useState<AvaDatamoonAudienceDraft>(() => createDefaultAvaDatamoonAudienceDraft())
  const [explanation, setExplanation] = useState<string | null>(null)
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [overrides, setOverrides] = useState<string[]>([])
  const [businessProfileUsed, setBusinessProfileUsed] = useState(false)
  const [businessProfileStatus, setBusinessProfileStatus] = useState<"approved" | "missing" | null>(null)
  const [hasApprovedBusinessProfile, setHasApprovedBusinessProfile] = useState(false)
  const [buildConfirmed, setBuildConfirmed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<DatamoonProviderDiagnostics | null>(null)
  const [activeRun, setActiveRun] = useState<DatamoonAudienceImportRun | null>(null)
  const [records, setRecords] = useState<DatamoonAudienceImportRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())

  const previewRecords = useMemo(
    () => records.filter((record) => record.status === "preview" && !rejectedIds.has(record.id)),
    [records, rejectedIds],
  )

  const recommendedRecords = useMemo(
    () => previewRecords.filter((record) => record.status === "preview"),
    [previewRecords],
  )

  const loadBusinessProfileState = useCallback(async () => {
    const res = await fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" })
    const payload = (await res.json()) as GrowthBusinessProfileApiResponse
    if (res.ok && payload.ok) {
      setHasApprovedBusinessProfile(Boolean(payload.activeApproved))
    }
  }, [])

  const loadDiagnostics = useCallback(async () => {
    const res = await fetch(GROWTH_HOME_DATAMOON_RUNS_API_PATH, { cache: "no-store" })
    const data = (await res.json()) as { diagnostics?: DatamoonProviderDiagnostics }
    setDiagnostics(data.diagnostics ?? null)
  }, [])

  useEffect(() => {
    void loadBusinessProfileState().catch(() => undefined)
  }, [loadBusinessProfileState])

  useEffect(() => {
    if (open) {
      void loadDiagnostics().catch(() => undefined)
      void loadBusinessProfileState().catch(() => undefined)
    }
  }, [open, loadDiagnostics, loadBusinessProfileState])

  async function handleAskAvaDraft() {
    setBusy("draft")
    setError(null)
    try {
      const res = await fetch(GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      })
      const payload = (await res.json()) as GrowthHomeDatamoonSourcingDraftApiResponse
      if (!res.ok || !payload.ok || !payload.draft) {
        throw new Error(payload.message ?? "Could not draft lead search from command.")
      }
      setDraft(payload.draft.audienceDraft)
      setExplanation(payload.draft.explanation)
      setAssumptions(payload.draft.assumptions)
      setOverrides(payload.draft.overrides ?? [])
      setBusinessProfileUsed(payload.draft.businessProfileUsed)
      setBusinessProfileStatus(payload.draft.businessProfileStatus)
      setHasApprovedBusinessProfile(payload.draft.businessProfileUsed)
      setBuildConfirmed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft lead search.")
    } finally {
      setBusy(null)
    }
  }

  async function handleBuildAudience() {
    if (!buildConfirmed) {
      setError("Confirm human review before searching for leads.")
      return
    }
    setBusy("build")
    setError(null)
    try {
      const request = buildDatamoonImportRequestFromAudienceDraft(draft)
      const res = await fetch(GROWTH_HOME_DATAMOON_RUNS_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
      const data = (await res.json()) as {
        ok?: boolean
        run?: DatamoonAudienceImportRun
        error?: string
        issues?: Array<{ message: string }>
      }
      if (!res.ok || !data.ok || !data.run) {
        const issueText = data.issues?.map((issue) => issue.message).join(" ")
        throw new Error(issueText || data.error || "Search for leads failed.")
      }
      setActiveRun(data.run)
      setRecords([])
      setSelectedIds(new Set())
      setRejectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search for leads failed.")
    } finally {
      setBusy(null)
    }
  }

  async function handlePoll() {
    if (!activeRun) return
    setBusy("poll")
    setError(null)
    try {
      const res = await fetch(`${GROWTH_HOME_DATAMOON_RUNS_API_PATH}/${activeRun.id}/poll`, { method: "POST" })
      const data = (await res.json()) as {
        ok?: boolean
        run?: DatamoonAudienceImportRun
        records?: DatamoonAudienceImportRecord[]
        error?: string
      }
      if (!res.ok || !data.ok || !data.run) throw new Error(data.error ?? "Poll failed.")
      setActiveRun(data.run)
      setRecords(data.records ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Poll failed.")
    } finally {
      setBusy(null)
    }
  }

  async function handleImport(importAllPreviewed: boolean) {
    if (!activeRun) return
    setBusy(importAllPreviewed ? "import-all" : "import-selected")
    setError(null)
    try {
      const res = await fetch(`${GROWTH_HOME_DATAMOON_RUNS_API_PATH}/${activeRun.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          import_all_previewed: importAllPreviewed,
          record_ids: importAllPreviewed ? undefined : Array.from(selectedIds),
        }),
      })
      const data = (await res.json()) as { ok?: boolean; run?: DatamoonAudienceImportRun; error?: string }
      if (!res.ok || !data.ok || !data.run) throw new Error(data.error ?? "Import failed.")
      setActiveRun(data.run)
      const detailRes = await fetch(`${GROWTH_HOME_DATAMOON_RUNS_API_PATH}/${activeRun.id}`, { cache: "no-store" })
      const detail = (await detailRes.json()) as { records?: DatamoonAudienceImportRecord[] }
      setRecords(detail.records ?? [])
      setSelectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.")
    } finally {
      setBusy(null)
    }
  }

  function handleReset() {
    setDraft(createDefaultAvaDatamoonAudienceDraft())
    setExplanation(null)
    setAssumptions([])
    setOverrides([])
    setBusinessProfileUsed(false)
    setBusinessProfileStatus(null)
    setBuildConfirmed(false)
    setActiveRun(null)
    setRecords([])
    setSelectedIds(new Set())
    setRejectedIds(new Set())
    setError(null)
  }

  function handleContinueManually() {
    setMode("manual_search")
    setError(null)
  }

  function handleCreateBusinessProfile() {
    setOpen(false)
    const section = document.querySelector(GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR)
    section?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function toggleRecord(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleRejectSelected() {
    setRejectedIds((current) => {
      const next = new Set(current)
      for (const id of selectedIds) next.add(id)
      return next
    })
    setSelectedIds(new Set())
  }

  function handleImportRecommended() {
    setSelectedIds(new Set(recommendedRecords.map((record) => record.id)))
  }

  return (
    <>
      <section
        data-qa-section="home-find-leads"
        data-qa-section-legacy="home-datamoon-sourcing-workbench"
        data-qa-marker={GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER}
        data-qa-marker-foundation={GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER}
        className="rounded-2xl border border-border/70 bg-card p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
            <Search className="size-5" aria-hidden />
          </span>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_FIND_LEADS_TITLE}</h2>
            <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_SUBTITLE}</p>
            <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_SECONDARY_COPY}</p>
            {hasApprovedBusinessProfile ? (
              <GrowthBadge tone="healthy">{GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL}</GrowthBadge>
            ) : (
              <p className="text-sm text-amber-900 dark:text-amber-100">{GROWTH_HOME_FIND_LEADS_CARD_MISSING_PROFILE_COPY}</p>
            )}
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          {GROWTH_HOME_FIND_LEADS_CTA}
        </Button>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{GROWTH_HOME_FIND_LEADS_TITLE}</SheetTitle>
            <SheetDescription>{GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "ava_draft" ? "default" : "outline"}
                onClick={() => setMode("ava_draft")}
              >
                {GROWTH_HOME_ASK_AVA_TAB_LABEL}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "manual_search" ? "default" : "outline"}
                onClick={() => setMode("manual_search")}
              >
                {GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL}
              </Button>
            </div>

            {mode === "ava_draft" ? (
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                {businessProfileUsed ? (
                  <GrowthBadge tone="healthy">{GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL}</GrowthBadge>
                ) : businessProfileStatus === "missing" ? (
                  <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                    <p>{GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={handleCreateBusinessProfile}>
                        {GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={handleContinueManually}>
                        {GROWTH_HOME_DATAMOON_CONTINUE_MANUALLY_LABEL}
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4 text-primary" />
                  {GROWTH_HOME_ASK_AVA_TAB_LABEL}
                </div>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  rows={3}
                  placeholder={GROWTH_HOME_ASK_AVA_PLACEHOLDER}
                />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Examples</p>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {GROWTH_HOME_FIND_LEADS_EXAMPLES.map((example) => (
                      <li key={example}>
                        <button
                          type="button"
                          className="text-left hover:text-foreground hover:underline"
                          onClick={() => setCommand(example)}
                        >
                          {example}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button type="button" size="sm" disabled={busy !== null} onClick={() => void handleAskAvaDraft()}>
                  {busy === "draft" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  {GROWTH_HOME_AVA_ASK_DRAFT_LABEL}
                </Button>
                {explanation ? (
                  <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{explanation}</p>
                ) : null}
                {businessProfileUsed ? (
                  <p className="text-xs text-muted-foreground">{GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_STARTED_COPY}</p>
                ) : null}
                {overrides.length > 0 ? (
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {overrides.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {assumptions.length > 0 ? (
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm font-medium">{GROWTH_HOME_ADVANCED_SEARCH_SECTION_LABEL}</p>
            )}

            <DatamoonSourcingWorkbenchForm draft={draft} onChange={setDraft} />

            <Collapsible open={providerDetailsOpen} onOpenChange={setProviderDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
                  <ChevronDown className={`size-4 transition-transform ${providerDetailsOpen ? "rotate-180" : ""}`} />
                  {GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 text-sm text-muted-foreground">
                <p>{GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL}</p>
                <p>{GROWTH_HOME_POWERED_BY_DATAMOON_LABEL}</p>
                {diagnostics ? (
                  <GrowthBadge tone={diagnostics.configured ? "healthy" : "attention"}>
                    {diagnostics.enabled ? (diagnostics.dryRunOnly ? "Dry run" : "Live") : "Disabled"}
                  </GrowthBadge>
                ) : null}
              </CollapsibleContent>
            </Collapsible>

            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <input
                type="checkbox"
                checked={buildConfirmed}
                onChange={(e) => setBuildConfirmed(e.target.checked)}
              />
              <span>
                I have reviewed this lead search and approve searching for leads. Import still requires a separate
                explicit action — no auto-import.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={busy !== null} onClick={() => void handleBuildAudience()}>
                {busy === "build" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                {GROWTH_HOME_BUILD_AUDIENCE_LABEL}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled title="Saved search persistence coming soon">
                {GROWTH_HOME_SAVE_SEARCH_LABEL} (coming soon)
              </Button>
              <Button type="button" size="sm" variant="outline" disabled title="Saved search persistence coming soon">
                {GROWTH_HOME_REFRESH_SAVED_SEARCH_LABEL}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
                {GROWTH_HOME_RESET_SEARCH_LABEL}
              </Button>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {activeRun ? (
              <div className="space-y-3 rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Run status</span>
                  <GrowthBadge tone={runStatusTone(activeRun.status)}>{activeRun.status}</GrowthBadge>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>Preview: {activeRun.previewCount}</div>
                  <div>Duplicates: {activeRun.duplicateCount}</div>
                  <div>New: {Math.max(activeRun.previewCount - activeRun.duplicateCount, 0)}</div>
                  <div>Imported: {activeRun.importedCount}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => void handlePoll()}>
                    {busy === "poll" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                    Poll / Refresh Preview
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleImportRecommended}>
                    {GROWTH_HOME_IMPORT_RECOMMENDED_LABEL}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={selectedIds.size === 0 || busy !== null}
                    onClick={() => void handleImport(false)}
                  >
                    {GROWTH_HOME_IMPORT_SELECTED_LABEL}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={selectedIds.size === 0}
                    onClick={handleRejectSelected}
                  >
                    {GROWTH_HOME_REJECT_SELECTED_LABEL}
                  </Button>
                </div>
              </div>
            ) : null}

            {previewRecords.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-2 py-2">Select</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Email</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRecords.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleRecord(record.id)}
                          />
                        </td>
                        <td className="px-2 py-2">{record.normalized.contact_name ?? "—"}</td>
                        <td className="px-2 py-2">{record.normalized.email ?? "—"}</td>
                        <td className="px-2 py-2">{record.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
