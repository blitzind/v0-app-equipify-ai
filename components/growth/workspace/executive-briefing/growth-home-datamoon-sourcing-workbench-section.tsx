"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { DatamoonSourcingWorkbenchForm } from "@/components/growth/lead-sources/datamoon/datamoon-sourcing-workbench-form"
import { GrowthHomeFindLeadsMissionBindingCard } from "@/components/growth/workspace/executive-briefing/growth-home-find-leads-mission-binding-card"
import { buildDatamoonImportRequestFromAudienceDraft } from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  buildAvaLedLeadDiscoveryContext,
  GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER,
  type AvaLedLeadDiscoveryContext,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
import {
  AVA_DATAMOON_PROVIDER_MODES,
  createDefaultAvaDatamoonAudienceDraft,
  type AvaDatamoonAudienceDraft,
  type AvaDatamoonSourcingWorkbenchMode,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER,
  GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER,
  GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER,
  GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL,
  GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL,
  GROWTH_HOME_AVA_ASK_DRAFT_LABEL,
  GROWTH_HOME_BUILD_AUDIENCE_LABEL,
  GROWTH_HOME_DATAMOON_RUNS_API_PATH,
  GROWTH_HOME_DATAMOON_SOURCING_DRAFT_API_PATH,
  GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL,
  GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY,
  GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY,
  GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL,
  GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE,
  GROWTH_HOME_AVA_LED_SEARCH_TITLE,
  GROWTH_HOME_REFINE_SEARCH_LABEL,
  GROWTH_HOME_START_LEAD_SEARCH_LABEL,
  GROWTH_HOME_DATAMOON_CONTINUE_MANUALLY_LABEL,
  GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR,
  GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL,
  GROWTH_HOME_FIND_LEADS_APPROVAL_COPY,
  GROWTH_HOME_FIND_LEADS_ASSUMPTIONS_TITLE,
  GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY,
  GROWTH_HOME_FIND_LEADS_CARD_CONTINUE_MANUAL_LABEL,
  GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY,
  GROWTH_HOME_FIND_LEADS_CTA,
  GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION,
  GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL,
  GROWTH_HOME_FIND_LEADS_HERO_PLACEHOLDER,
  GROWTH_HOME_FIND_LEADS_HERO_SUBTITLE,
  GROWTH_HOME_FIND_LEADS_HERO_TITLE,
  GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL,
  GROWTH_HOME_FIND_LEADS_MISSION_BINDING_ATTACHED_COPY,
  GROWTH_HOME_FIND_LEADS_PLAN_LOOKING_FOR_LABEL,
  GROWTH_HOME_FIND_LEADS_PLAN_TITLE,
  GROWTH_HOME_FIND_LEADS_PLAN_USING_LABEL,
  GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_COPY,
  GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE,
  GROWTH_HOME_FIND_LEADS_REVIEW_ALL_LABEL,
  GROWTH_HOME_FIND_LEADS_UNSURE_TITLE,
  GROWTH_HOME_FIND_LEADS_TITLE,
  GROWTH_HOME_FIND_LEADS_SUBTITLE,
  GROWTH_HOME_ASK_AVA_TAB_LABEL,
  GROWTH_HOME_IMPORT_RECOMMENDED_LABEL,
  GROWTH_HOME_IMPORT_SELECTED_LABEL,
  GROWTH_HOME_POWERED_BY_DATAMOON_LABEL,
  GROWTH_HOME_PROVIDER_MODE_LABEL,
  GROWTH_HOME_REFRESH_SAVED_SEARCH_LABEL,
  GROWTH_HOME_REJECT_SELECTED_LABEL,
  GROWTH_HOME_RESET_SEARCH_LABEL,
  GROWTH_HOME_SAVE_SEARCH_LABEL,
  type GrowthHomeDatamoonSourcingDraftApiResponse,
} from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import {
  buildMissionAvaLaunchRunApiPath,
  buildMissionBindFindLeadsApiPath,
  formatGrowthAvaLaunchValidationErrorsForUi,
  GROWTH_AVA_LAUNCH_CANT_START_HEADING,
  GROWTH_AVA_LAUNCH_RUN_SUCCESS_COPY,
  GROWTH_AVA_LAUNCH_RUN_TITLE,
  GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR,
  GROWTH_MISSION_CENTER_API_PATH,
  isGrowthMissionAvaLaunchValidationFailureError,
  type GrowthAvaLaunchValidationError,
  type GrowthMissionAvaLaunchRunResponse,
  type GrowthMissionBindFindLeadsResponse,
  type GrowthMissionCenterSourcesPayload,
} from "@/lib/growth/mission-center"
import { buildAvaLaunchRunSuccessMessage } from "@/lib/growth/mission-center/growth-mission-ava-launch-run-result-semantics"
import {
  GROWTH_HOME_FIND_LEADS_ZERO_PREVIEW_DEBUG_TITLE,
  type GrowthMissionAvaLaunchZeroPreviewDebug,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-zero-preview-debug"
import { selectDefaultFindLeadsMissionId } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type {
  DatamoonAudienceImportRecord,
  DatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { DatamoonProviderDiagnostics } from "@/lib/growth/providers/datamoon"
import { cn } from "@/lib/utils"

type GuidedWorkflowStep = "prompt" | "plan" | "ready" | "configure"

const UNSURE_ASSUMPTION_PATTERN =
  /not prefilled|confirm|missing|wasn't sure|no approved|need a business profile/i

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

function formatAvaLaunchFailureMessage(payload: {
  error?: string
  validationErrors?: GrowthAvaLaunchValidationError[]
}): string {
  if (payload.validationErrors && payload.validationErrors.length > 0) {
    return formatGrowthAvaLaunchValidationErrorsForUi(payload.validationErrors)
  }
  if (payload.error && isGrowthMissionAvaLaunchValidationFailureError(payload.error)) {
    return `${GROWTH_AVA_LAUNCH_CANT_START_HEADING}\n\n• ${GROWTH_AVA_LAUNCH_VALIDATION_FAILED_ERROR}`
  }
  return payload.error ?? "Ava launch run failed."
}

function formatGeography(draft: AvaDatamoonAudienceDraft): string {
  const parts = [draft.geography.country, draft.geography.state, draft.geography.city].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "Not specified"
}

function formatList(values: string[], custom: string | null): string {
  const items = [...values]
  if (custom?.trim()) items.push(custom.trim())
  return items.length > 0 ? items.join(", ") : "Not specified"
}

function splitAssumptions(assumptions: string[], overrides: string[]) {
  const unsureFromAssumptions = assumptions.filter((item) => UNSURE_ASSUMPTION_PATTERN.test(item))
  const confidentAssumptions = assumptions.filter((item) => !UNSURE_ASSUMPTION_PATTERN.test(item))
  const unsureItems = [...new Set([...overrides, ...unsureFromAssumptions])]
  return { confidentAssumptions, unsureItems }
}

export function GrowthHomeDatamoonSourcingWorkbenchSection({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false)
  const [providerDetailsOpen, setProviderDetailsOpen] = useState(false)
  const [mode, setMode] = useState<AvaDatamoonSourcingWorkbenchMode>("ava_draft")
  const [workflowStep, setWorkflowStep] = useState<GuidedWorkflowStep>("prompt")
  const [command, setCommand] = useState("")
  const [draft, setDraft] = useState<AvaDatamoonAudienceDraft>(() => createDefaultAvaDatamoonAudienceDraft())
  const [explanation, setExplanation] = useState<string | null>(null)
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [overrides, setOverrides] = useState<string[]>([])
  const [businessProfileUsed, setBusinessProfileUsed] = useState(false)
  const [businessProfileStatus, setBusinessProfileStatus] = useState<"approved" | "missing" | null>(null)
  const [hasApprovedBusinessProfile, setHasApprovedBusinessProfile] = useState(false)
  const [activeProfile, setActiveProfile] = useState<BusinessProfileDraftContent | null>(null)
  const [profileCompanyName, setProfileCompanyName] = useState<string | null>(null)
  const [avaLedContext, setAvaLedContext] = useState<AvaLedLeadDiscoveryContext | null>(null)
  const [refineOpen, setRefineOpen] = useState(false)
  const [buildConfirmed, setBuildConfirmed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<DatamoonProviderDiagnostics | null>(null)
  const [activeRun, setActiveRun] = useState<DatamoonAudienceImportRun | null>(null)
  const [records, setRecords] = useState<DatamoonAudienceImportRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [missionOptions, setMissionOptions] = useState<Array<{ id: string; title: string }>>([])
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [keepMonitoring, setKeepMonitoring] = useState(true)
  const [missionBindingMessage, setMissionBindingMessage] = useState<string | null>(null)
  const [launchRunMessage, setLaunchRunMessage] = useState<string | null>(null)
  const [zeroPreviewDebug, setZeroPreviewDebug] = useState<GrowthMissionAvaLaunchZeroPreviewDebug | null>(null)
  const [zeroPreviewDebugOpen, setZeroPreviewDebugOpen] = useState(false)
  const resultsTableRef = useRef<HTMLDivElement>(null)

  const previewRecords = useMemo(
    () => records.filter((record) => record.status === "preview" && !rejectedIds.has(record.id)),
    [records, rejectedIds],
  )

  const recommendedRecords = useMemo(
    () => previewRecords.filter((record) => record.status === "preview"),
    [previewRecords],
  )

  const { confidentAssumptions, unsureItems } = useMemo(
    () => splitAssumptions(assumptions, overrides),
    [assumptions, overrides],
  )

  const showAdvancedForm =
    mode === "manual_search" || workflowStep === "configure" || (workflowStep === "ready" && mode === "manual_search")

  const showPlanReview = mode === "ava_draft" && workflowStep === "plan"
  const showHero = mode === "ava_draft" && workflowStep === "prompt"
  const showConfigureActions =
    mode === "manual_search" || workflowStep === "configure" || workflowStep === "ready"

  const planGenerated = workflowStep !== "prompt"

  const loadMissionOptions = useCallback(async () => {
    const res = await fetch(GROWTH_MISSION_CENTER_API_PATH, { cache: "no-store" })
    const payload = (await res.json()) as GrowthMissionCenterSourcesPayload
    if (!res.ok || !payload.ok) {
      setMissionOptions([])
      return
    }
    const objectives = payload.objectiveDashboard?.objectives ?? []
    const active = objectives
      .filter((entry) => entry.status === "active" && entry.runtime?.running)
      .map((entry) => ({ id: entry.id, title: entry.title }))
    setMissionOptions(active)
    setSelectedMissionId((current) => current ?? selectDefaultFindLeadsMissionId(objectives))
    return active
  }, [])

  const hydrateLeadDiscoveryContext = useCallback(
    (profile: BusinessProfileDraftContent | null, companyName: string | null, missionTitle: string | null) => {
      const context = buildAvaLedLeadDiscoveryContext({
        profile,
        companyName,
        missionTitle,
      })
      setAvaLedContext(context)
      setDraft(context.draft)
      setExplanation(context.narrative)
      setAssumptions(context.assumptions)
      setBusinessProfileUsed(context.businessProfileUsed)
      setBusinessProfileStatus(profile ? "approved" : "missing")
    },
    [],
  )

  const loadBusinessProfileState = useCallback(async () => {
    const res = await fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" })
    const payload = (await res.json()) as GrowthBusinessProfileApiResponse
    if (res.ok && payload.ok) {
      const approved = payload.activeApproved
      setHasApprovedBusinessProfile(Boolean(approved))
      const profile = approved?.profile ?? null
      const companyName = approved?.input.companyName ?? null
      setActiveProfile(profile)
      setProfileCompanyName(companyName)
      return { profile, companyName }
    }
    setHasApprovedBusinessProfile(false)
    setActiveProfile(null)
    setProfileCompanyName(null)
    return { profile: null, companyName: null }
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
      void loadMissionOptions().catch(() => undefined)
    }
  }, [open, loadDiagnostics, loadBusinessProfileState, loadMissionOptions])

  useEffect(() => {
    if (!open) return
    const missionTitle = missionOptions.find((entry) => entry.id === selectedMissionId)?.title ?? null
    hydrateLeadDiscoveryContext(activeProfile, profileCompanyName, missionTitle)
  }, [open, activeProfile, profileCompanyName, missionOptions, selectedMissionId, hydrateLeadDiscoveryContext])

  async function handleStartAvaLedSearch() {
    if (!avaLedContext) return
    if (!avaLedContext.profileReady) {
      setError(
        `${GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY} Missing: ${avaLedContext.missingProfileFields.join(", ")}.`,
      )
      return
    }
    setDraft(avaLedContext.draft)
    setExplanation(avaLedContext.narrative)
    setAssumptions(avaLedContext.assumptions)
    setBusinessProfileUsed(true)
    setBusinessProfileStatus("approved")
    setBuildConfirmed(false)
    setWorkflowStep("plan")
    setError(null)
  }

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
      setWorkflowStep("plan")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft lead search.")
    } finally {
      setBusy(null)
    }
  }

  async function bindSearchToMission(request: ReturnType<typeof buildDatamoonImportRequestFromAudienceDraft>, runId: string) {
    if (!selectedMissionId || !keepMonitoring) return
    const searchSummary =
      command.trim() ||
      explanation?.trim() ||
      draft.audienceName.trim() ||
      "Find Leads search"
    const res = await fetch(buildMissionBindFindLeadsApiPath(selectedMissionId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datamoonRequest: request,
        searchSummary,
        source: "find_leads",
        approvedByUser: true,
        keepMonitoring: true,
        lastRunId: runId,
        refreshCadence: "daily",
      }),
    })
    const payload = (await res.json()) as GrowthMissionBindFindLeadsResponse
    if (!res.ok || !payload.ok) {
      throw new Error(payload.error ?? "Could not attach search to mission.")
    }
    setMissionBindingMessage(GROWTH_HOME_FIND_LEADS_MISSION_BINDING_ATTACHED_COPY)
  }

  async function handleRunAvaLaunch() {
    if (!buildConfirmed) {
      setError("Confirm human review before running Ava.")
      return
    }
    if (!selectedMissionId) {
      setError("Select a mission before running Ava.")
      return
    }

    setBusy("ava-launch")
    setError(null)
    setMissionBindingMessage(null)
    setLaunchRunMessage(null)
    setZeroPreviewDebug(null)
    setZeroPreviewDebugOpen(false)
    try {
      const searchSummary =
        command.trim() ||
        explanation?.trim() ||
        draft.audienceName.trim() ||
        "Find Leads search"
      const res = await fetch(buildMissionAvaLaunchRunApiPath(selectedMissionId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceDraft: draft,
          searchSummary,
          approvedByUser: true,
          keepMonitoring,
          refreshCadence: "daily",
        }),
      })
      const payload = (await res.json()) as GrowthMissionAvaLaunchRunResponse & {
        error?: string
        validationErrors?: GrowthAvaLaunchValidationError[]
        routeVersion?: string
      }
      console.log("GE-AVA-LIVE-ROUTE-VERIFY-1 ava-launch-run response.status", res.status)
      console.log(
        'GE-AVA-LIVE-ROUTE-VERIFY-1 ava-launch-run response.headers["X-Ava-Launch-Route-Version"]',
        res.headers.get("X-Ava-Launch-Route-Version"),
      )
      console.log("GE-AVA-LIVE-ROUTE-VERIFY-1 ava-launch-run response JSON body", payload)
      if (!res.ok || !payload.ok) {
        throw new Error(formatAvaLaunchFailureMessage(payload))
      }
      const { result } = payload
      const runRes = await fetch(`${GROWTH_HOME_DATAMOON_RUNS_API_PATH}/${result.runId}`, {
        cache: "no-store",
      })
      const runPayload = (await runRes.json()) as {
        ok?: boolean
        run?: DatamoonAudienceImportRun
        records?: DatamoonAudienceImportRecord[]
      }
      if (runRes.ok && runPayload.ok && runPayload.run) {
        setActiveRun(runPayload.run)
        setRecords(runPayload.records ?? [])
        setSelectedIds(new Set())
        setRejectedIds(new Set())
      }

      setMissionBindingMessage(GROWTH_HOME_FIND_LEADS_MISSION_BINDING_ATTACHED_COPY)
      setLaunchRunMessage(
        `${GROWTH_AVA_LAUNCH_RUN_SUCCESS_COPY} ${buildAvaLaunchRunSuccessMessage({
          importedLeadCount: result.importedLeadCount,
          runCreatedApprovalCount: result.runCreatedApprovalCount,
          orgHumanApprovalPendingTotal: result.orgHumanApprovalPendingTotal,
          researchPendingCount: result.researchPendingCount,
          stoppedAt: result.stoppedAt,
        })}`,
      )
      setZeroPreviewDebug(result.importedLeadCount === 0 ? (result.zeroPreviewDebug ?? null) : null)
      setZeroPreviewDebugOpen(result.importedLeadCount === 0 && Boolean(result.zeroPreviewDebug))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ava launch run failed.")
    } finally {
      setBusy(null)
    }
  }

  async function handleBuildAudience() {
    if (!buildConfirmed) {
      setError("Confirm human review before searching for leads.")
      return
    }
    if (mode === "ava_draft" && avaLedContext && !avaLedContext.profileReady) {
      setError(
        `${GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY} Missing: ${avaLedContext.missingProfileFields.join(", ")}.`,
      )
      return
    }
    setBusy("build")
    setError(null)
    setMissionBindingMessage(null)
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
      if (selectedMissionId && keepMonitoring) {
        await bindSearchToMission(request, data.run.id)
      }
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
    const missionTitle = missionOptions.find((entry) => entry.id === selectedMissionId)?.title ?? null
    hydrateLeadDiscoveryContext(activeProfile, profileCompanyName, missionTitle)
    setCommand("")
    setOverrides([])
    setBuildConfirmed(false)
    setWorkflowStep("prompt")
    setMode("ava_draft")
    setRefineOpen(false)
    setActiveRun(null)
    setRecords([])
    setSelectedIds(new Set())
    setRejectedIds(new Set())
    setMissionBindingMessage(null)
    setLaunchRunMessage(null)
    setZeroPreviewDebug(null)
    setZeroPreviewDebugOpen(false)
    setError(null)
  }

  function handleOpenDrawer(manual = false) {
    if (manual) {
      setMode("manual_search")
      setWorkflowStep("configure")
    } else {
      setMode("ava_draft")
      if (!planGenerated) setWorkflowStep("prompt")
    }
    setOpen(true)
  }

  function handleContinueManually() {
    setMode("manual_search")
    setWorkflowStep("configure")
    setError(null)
  }

  function handleCreateBusinessProfile() {
    setOpen(false)
    const section = document.querySelector(GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR)
    section?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handleModeChange(nextMode: AvaDatamoonSourcingWorkbenchMode) {
    setMode(nextMode)
    if (nextMode === "manual_search") {
      setWorkflowStep("configure")
    } else if (!planGenerated) {
      setWorkflowStep("prompt")
    } else if (workflowStep === "configure") {
      setWorkflowStep("plan")
    }
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

  function handleReviewAllLeads() {
    setSelectedIds(new Set(previewRecords.map((record) => record.id)))
    resultsTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const totalResults = previewRecords.length
  const highIntentIncluded = draft.intentLevels.includes("high")
  const mediumIntentIncluded = draft.intentLevels.includes("medium")

  return (
    <>
      <section
        data-qa-section="home-find-leads"
        data-qa-section-legacy="home-datamoon-sourcing-workbench"
        data-qa-marker={GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER}
        data-qa-marker-7c={GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER}
        data-qa-marker-rename={GROWTH_AIOS_GROWTH_UX_RENAME_1A_QA_MARKER}
        data-qa-marker-foundation={GROWTH_AVA_DATAMOON_SOURCING_WORKBENCH_1A_QA_MARKER}
        className={cn(
          "space-y-4",
          embedded
            ? "rounded-xl border border-border/60 bg-background/80 p-4"
            : "rounded-2xl border border-border/70 bg-card p-6 space-y-5",
        )}
      >
        {!embedded ? (
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
            <Search className="size-5" aria-hidden />
          </span>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_FIND_LEADS_TITLE}</h2>
            <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_SUBTITLE}</p>
            {hasApprovedBusinessProfile ? (
              <>
                <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_CARD_APPROVED_COPY}</p>
                <GrowthBadge tone="healthy">{GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL}</GrowthBadge>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" onClick={handleCreateBusinessProfile}>
                    {GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleOpenDrawer(true)}>
                    {GROWTH_HOME_FIND_LEADS_CARD_CONTINUE_MANUAL_LABEL}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_SUBTITLE}</p>
            {hasApprovedBusinessProfile ? (
              <GrowthBadge tone="healthy">{GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL}</GrowthBadge>
            ) : (
              <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_CARD_MISSING_COPY}</p>
            )}
          </div>
        )}
        {hasApprovedBusinessProfile ? (
          <Button type="button" size="sm" onClick={() => handleOpenDrawer(false)}>
            {GROWTH_HOME_FIND_LEADS_CTA}
          </Button>
        ) : null}
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="space-y-2">
            <SheetTitle>{GROWTH_HOME_FIND_LEADS_TITLE}</SheetTitle>
            <SheetDescription>{GROWTH_HOME_FIND_LEADS_DRAWER_DESCRIPTION}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "ava_draft" ? "default" : "outline"}
                onClick={() => handleModeChange("ava_draft")}
              >
                {GROWTH_HOME_ASK_AVA_TAB_LABEL}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "manual_search" ? "default" : "outline"}
                onClick={() => handleModeChange("manual_search")}
              >
                {GROWTH_HOME_ADVANCED_SEARCH_TAB_LABEL}
              </Button>
            </div>

            {showHero ? (
              <Card className="gap-5 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent py-6 shadow-none">
                <CardHeader className="space-y-2 px-6">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="size-5" aria-hidden />
                    <span className="text-sm font-medium">{GROWTH_HOME_ASK_AVA_TAB_LABEL}</span>
                  </div>
                  <CardTitle className="text-xl">{GROWTH_HOME_FIND_LEADS_HERO_TITLE}</CardTitle>
                  <p className="text-sm text-muted-foreground">{GROWTH_HOME_FIND_LEADS_HERO_SUBTITLE}</p>
                </CardHeader>
                <CardContent className="space-y-4 px-6">
                  {!hasApprovedBusinessProfile ? (
                    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/80 p-5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
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
                  ) : avaLedContext && !avaLedContext.profileReady ? (
                    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/80 p-5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                      <p>{GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY}</p>
                      <p className="text-muted-foreground">
                        Missing: {avaLedContext.missingProfileFields.join(", ")}
                      </p>
                      <Button type="button" size="sm" onClick={handleCreateBusinessProfile}>
                        {GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL}
                      </Button>
                    </div>
                  ) : avaLedContext ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium">{GROWTH_HOME_AVA_LED_SEARCH_TITLE}</p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                          {avaLedContext.narrative}
                        </p>
                      </div>
                      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-4">
                        <p className="text-sm font-medium">{GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE}</p>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {avaLedContext.explainability.map((line) => (
                            <li key={line.id}>
                              <span className="font-medium text-foreground">{line.label}:</span> {line.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void handleStartAvaLedSearch()}
                      >
                        {GROWTH_HOME_START_LEAD_SEARCH_LABEL}
                      </Button>
                    </div>
                  ) : null}

                  {hasApprovedBusinessProfile ? (
                    <Collapsible open={refineOpen} onOpenChange={setRefineOpen}>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="gap-2 px-0">
                          <ChevronDown
                            className={cn("size-4 transition-transform", refineOpen ? "rotate-180" : "")}
                            aria-hidden
                          />
                          {GROWTH_HOME_REFINE_SEARCH_LABEL}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 pt-3">
                        <Textarea
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          rows={5}
                          placeholder={GROWTH_HOME_FIND_LEADS_HERO_PLACEHOLDER}
                          className="min-h-[120px] resize-y text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy !== null || !command.trim()}
                          onClick={() => void handleAskAvaDraft()}
                        >
                          {busy === "draft" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          {GROWTH_HOME_AVA_ASK_DRAFT_LABEL}
                        </Button>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {showPlanReview ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold">{GROWTH_HOME_FIND_LEADS_PLAN_TITLE}</h3>
                  {explanation ? (
                    <p className="mt-2 text-sm text-muted-foreground">{explanation}</p>
                  ) : null}
                </div>

                <Card className="gap-4 py-5 shadow-none">
                  <CardContent className="space-y-4 px-5">
                    <div>
                      <p className="text-sm font-medium">{GROWTH_HOME_FIND_LEADS_PLAN_USING_LABEL}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        {businessProfileUsed ? (
                          <>
                            <Check className="size-4 text-emerald-600" aria-hidden />
                            <span>{GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Manual search configuration</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">{GROWTH_HOME_FIND_LEADS_PLAN_LOOKING_FOR_LABEL}</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                        <li>• Industries: {formatList(draft.topics, null)}</li>
                        <li>• Geography: {formatGeography(draft)}</li>
                        <li>• Company size: {draft.companySize}</li>
                        <li>• Decision makers: {formatList(draft.jobTitles, draft.customJobTitle)}</li>
                        <li>• Intent level: {draft.intentLevels.join(", ") || "Not specified"}</li>
                        <li>• Lookback: {draft.lookbackDays} days</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {confidentAssumptions.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{GROWTH_HOME_FIND_LEADS_ASSUMPTIONS_TITLE}</h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {confidentAssumptions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {unsureItems.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">{GROWTH_HOME_FIND_LEADS_UNSURE_TITLE}</h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {unsureItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setWorkflowStep("ready")}>
                    {GROWTH_HOME_FIND_LEADS_LOOKS_GOOD_LABEL}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setWorkflowStep("configure")}>
                    {GROWTH_HOME_FIND_LEADS_EDIT_SEARCH_LABEL}
                  </Button>
                </div>
              </div>
            ) : null}

            {showAdvancedForm ? (
              <>
                {mode === "manual_search" || workflowStep === "configure" ? (
                  <Separator className="my-2" />
                ) : null}
                <DatamoonSourcingWorkbenchForm
                  draft={draft}
                  onChange={setDraft}
                  layout="grouped"
                  topicPresets={avaLedContext?.topicPresets ?? []}
                  jobTitlePresets={avaLedContext?.jobTitlePresets ?? []}
                />
              </>
            ) : null}

            {showConfigureActions ? (
              <>
                <Separator />

                <Collapsible open={providerDetailsOpen} onOpenChange={setProviderDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 px-0 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={`size-4 transition-transform ${providerDetailsOpen ? "rotate-180" : ""}`}
                      />
                      {GROWTH_HOME_ADVANCED_PROVIDER_DETAILS_LABEL}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-3">
                    <p className="text-sm text-muted-foreground">{GROWTH_HOME_DISCOVERY_SOURCE_DATAMOON_LABEL}</p>
                    <p className="text-sm text-muted-foreground">{GROWTH_HOME_POWERED_BY_DATAMOON_LABEL}</p>
                    <div className="space-y-2">
                      <Label htmlFor="dm-provider-mode-drawer">{GROWTH_HOME_PROVIDER_MODE_LABEL}</Label>
                      <select
                        id="dm-provider-mode-drawer"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draft.providerMode}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            providerMode: e.target.value as AvaDatamoonAudienceDraft["providerMode"],
                          })
                        }
                      >
                        {AVA_DATAMOON_PROVIDER_MODES.map((providerMode) => (
                          <option key={providerMode} value={providerMode}>
                            {providerMode === "module" ? "module (default)" : providerMode}
                          </option>
                        ))}
                      </select>
                    </div>
                    {diagnostics ? (
                      <GrowthBadge tone={diagnostics.configured ? "healthy" : "attention"}>
                        {diagnostics.enabled ? (diagnostics.dryRunOnly ? "Dry run" : "Live") : "Disabled"}
                      </GrowthBadge>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>

                <Card className="border-amber-200/80 bg-amber-50/50 py-5 shadow-none dark:border-amber-900/40 dark:bg-amber-950/20">
                  <CardContent className="px-5">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={buildConfirmed}
                        onChange={(e) => setBuildConfirmed(e.target.checked)}
                      />
                      <span>{GROWTH_HOME_FIND_LEADS_APPROVAL_COPY}</span>
                    </label>
                    <p className="mt-2 pl-6 text-xs text-muted-foreground">
                      Import still requires a separate explicit action — no auto-import.
                    </p>
                  </CardContent>
                </Card>

                <GrowthHomeFindLeadsMissionBindingCard
                  missions={missionOptions}
                  selectedMissionId={selectedMissionId}
                  onSelectedMissionIdChange={setSelectedMissionId}
                  keepMonitoring={keepMonitoring}
                  onKeepMonitoringChange={setKeepMonitoring}
                  disabled={busy !== null}
                />

                {missionBindingMessage ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">{missionBindingMessage}</p>
                ) : null}

                {launchRunMessage ? (
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">{launchRunMessage}</p>
                ) : null}

                {zeroPreviewDebug ? (
                  <Collapsible open={zeroPreviewDebugOpen} onOpenChange={setZeroPreviewDebugOpen}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="w-full justify-between">
                        {GROWTH_HOME_FIND_LEADS_ZERO_PREVIEW_DEBUG_TITLE}
                        <ChevronDown
                          className={cn("size-4 transition-transform", zeroPreviewDebugOpen && "rotate-180")}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                        {JSON.stringify(zeroPreviewDebug, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busy !== null || !buildConfirmed || !selectedMissionId}
                    onClick={() => void handleRunAvaLaunch()}
                  >
                    {busy === "ava-launch" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                    {GROWTH_AVA_LAUNCH_RUN_TITLE}
                  </Button>
                  <Button
                    type="button"
                    disabled={busy !== null || !buildConfirmed}
                    onClick={() => void handleBuildAudience()}
                  >
                    {busy === "build" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {GROWTH_HOME_BUILD_AUDIENCE_LABEL}
                  </Button>
                  <Button type="button" variant="outline" disabled title="Saved search persistence coming soon">
                    {GROWTH_HOME_SAVE_SEARCH_LABEL} (coming soon)
                  </Button>
                  <Button type="button" variant="outline" disabled title="Saved search persistence coming soon">
                    {GROWTH_HOME_REFRESH_SAVED_SEARCH_LABEL}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleReset}>
                    {GROWTH_HOME_RESET_SEARCH_LABEL}
                  </Button>
                </div>
              </>
            ) : null}

            {error ? <p className="whitespace-pre-line text-sm text-destructive">{error}</p> : null}

            {activeRun ? (
              <div className="space-y-6">
                <Separator />
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Run status</span>
                    <GrowthBadge tone={runStatusTone(activeRun.status)}>{activeRun.status}</GrowthBadge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="gap-2 py-4 shadow-none">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">High Intent</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <p className="text-2xl font-semibold">
                          {highIntentIncluded ? totalResults : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {highIntentIncluded ? "Included in search" : "Not included"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="gap-2 py-4 shadow-none">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Medium Intent</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <p className="text-2xl font-semibold">
                          {mediumIntentIncluded ? totalResults : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mediumIntentIncluded ? "Included in search" : "Not included"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="gap-2 py-4 shadow-none">
                      <CardHeader className="px-4 pb-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Results</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4">
                        <p className="text-2xl font-semibold">{totalResults}</p>
                        <p className="text-xs text-muted-foreground">Preview leads ready to review</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => void handlePoll()}>
                    {busy === "poll" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Poll / Refresh Preview
                  </Button>
                </div>

                {previewRecords.length > 0 ? (
                  <div className="space-y-4 rounded-xl border border-border/70 p-5">
                    <div>
                      <h3 className="text-base font-semibold">{GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_TITLE}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {GROWTH_HOME_FIND_LEADS_RESULTS_AVA_RECOMMENDS_COPY}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={busy !== null || recommendedRecords.length === 0}
                        onClick={() => void handleImportRecommended()}
                      >
                        {busy === "import-all" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        {GROWTH_HOME_IMPORT_RECOMMENDED_LABEL}
                      </Button>
                      <Button type="button" variant="outline" onClick={handleReviewAllLeads}>
                        {GROWTH_HOME_FIND_LEADS_REVIEW_ALL_LABEL}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={selectedIds.size === 0 || busy !== null}
                        onClick={() => void handleImport(false)}
                      >
                        {busy === "import-selected" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        {GROWTH_HOME_IMPORT_SELECTED_LABEL}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={selectedIds.size === 0}
                        onClick={handleRejectSelected}
                      >
                        {GROWTH_HOME_REJECT_SELECTED_LABEL}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {previewRecords.length > 0 ? (
              <div ref={resultsTableRef} className="overflow-x-auto rounded-lg border border-border/70">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-3">Select</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRecords.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleRecord(record.id)}
                          />
                        </td>
                        <td className="px-3 py-3">{record.normalized.contact_name ?? "—"}</td>
                        <td className="px-3 py-3">{record.normalized.email ?? "—"}</td>
                        <td className="px-3 py-3">{record.status}</td>
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
