"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  BUSINESS_PROFILE_APPROVED_LABEL,
  BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER,
  type BusinessProfileDraftContent,
  type BusinessProfileRecord,
} from "@/lib/growth/business-profile"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  GROWTH_BUSINESS_PROFILE_APPROVE_LABEL,
  GROWTH_BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_BUSINESS_PROFILE_DRAFTING_MESSAGE,
  GROWTH_BUSINESS_PROFILE_REJECT_LABEL,
  GROWTH_BUSINESS_PROFILE_SECTION_TITLE,
  GROWTH_BUSINESS_PROFILE_UPDATE_LABEL,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"
import { GROWTH_HOME_GROWTH_PROFILE_SECTION_SUBTITLE } from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import { cn } from "@/lib/utils"

type ViewState = "loading" | "create" | "draft" | "approved"

function profileApiPath(profileId: string, action?: "approve" | "reject"): string {
  if (action === "approve") return `${GROWTH_BUSINESS_PROFILE_API_PATH}/${profileId}/approve`
  if (action === "reject") return `${GROWTH_BUSINESS_PROFILE_API_PATH}/${profileId}/reject`
  return `${GROWTH_BUSINESS_PROFILE_API_PATH}/${profileId}`
}

function draftApiPath(): string {
  return `${GROWTH_BUSINESS_PROFILE_API_PATH}/draft`
}

function listLines(values: string[]): string {
  return values.join("\n")
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function ProfileSectionEditor({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  )
}

export function GrowthHomeBusinessProfileSection({ embedded = false }: { embedded?: boolean }) {
  const { teammate } = useAiTeammateIdentity()
  const [view, setView] = useState<ViewState>("loading")
  const [activeApproved, setActiveApproved] = useState<BusinessProfileRecord | null>(null)
  const [latestDraft, setLatestDraft] = useState<BusinessProfileRecord | null>(null)
  const [editingDraft, setEditingDraft] = useState<BusinessProfileRecord | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState("")
  const [website, setWebsite] = useState("")
  const [whatTheySell, setWhatTheySell] = useState("")
  const [whoTheySellTo, setWhoTheySellTo] = useState("")
  const [geography, setGeography] = useState("")
  const [averageDealSize, setAverageDealSize] = useState("")
  const [notes, setNotes] = useState("")

  const [editableProfile, setEditableProfile] = useState<BusinessProfileDraftContent | null>(null)

  const resolveView = useCallback(
    (approved: BusinessProfileRecord | null, draft: BusinessProfileRecord | null, preferCreate = false) => {
      if (preferCreate) {
        setView("create")
        return
      }
      if (draft) {
        setEditingDraft(draft)
        setEditableProfile(draft.profile)
        setView("draft")
        return
      }
      if (approved) {
        setView("approved")
        return
      }
      setView("create")
    },
    [],
  )

  const loadWorkspace = useCallback(async () => {
    setError(null)
    const res = await fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" })
    const payload = (await res.json()) as GrowthBusinessProfileApiResponse
    if (!res.ok || !payload.ok) {
      throw new Error(payload.message ?? "Could not load Business Profile.")
    }
    setActiveApproved(payload.activeApproved ?? null)
    setLatestDraft(payload.latestDraft ?? null)
    resolveView(payload.activeApproved ?? null, payload.latestDraft ?? null)
  }, [resolveView])

  useEffect(() => {
    void loadWorkspace().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load Business Profile.")
      setView("create")
    })
  }, [loadWorkspace])

  async function handleDraftProfile() {
    setBusy("draft")
    setError(null)
    try {
      const res = await fetch(draftApiPath(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          website,
          notes: notes || null,
          whatTheySell: whatTheySell || null,
          whoTheySellTo: whoTheySellTo || null,
          geography: geography || null,
          averageDealSize: averageDealSize || null,
        }),
      })
      const payload = (await res.json()) as GrowthBusinessProfileApiResponse
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.message ?? "Could not draft Business Profile.")
      }
      setLatestDraft(payload.profile)
      setEditingDraft(payload.profile)
      setEditableProfile(payload.profile.profile)
      setView("draft")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft Business Profile.")
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveDraftEdits() {
    if (!editingDraft || !editableProfile) return
    setBusy("save")
    setError(null)
    try {
      const res = await fetch(profileApiPath(editingDraft.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: editableProfile }),
      })
      const payload = (await res.json()) as GrowthBusinessProfileApiResponse
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.message ?? "Could not save edits.")
      }
      setLatestDraft(payload.profile)
      setEditingDraft(payload.profile)
      setEditableProfile(payload.profile.profile)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save edits.")
    } finally {
      setBusy(null)
    }
  }

  async function handleApprove() {
    if (!editingDraft) return
    setBusy("approve")
    setError(null)
    try {
      const res = await fetch(profileApiPath(editingDraft.id, "approve"), { method: "POST" })
      const payload = (await res.json()) as GrowthBusinessProfileApiResponse
      if (!res.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.message ?? "Could not approve Business Profile.")
      }
      setActiveApproved(payload.profile)
      setLatestDraft(null)
      setEditingDraft(null)
      setEditableProfile(null)
      setView("approved")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve Business Profile.")
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    if (!editingDraft) return
    setBusy("reject")
    setError(null)
    try {
      const res = await fetch(profileApiPath(editingDraft.id, "reject"), { method: "POST" })
      const payload = (await res.json()) as GrowthBusinessProfileApiResponse
      if (!res.ok || !payload.ok) {
        throw new Error(payload.message ?? "Could not reject Business Profile.")
      }
      setLatestDraft(null)
      setEditingDraft(null)
      setEditableProfile(null)
      resolveView(activeApproved, null, !activeApproved)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject Business Profile.")
    } finally {
      setBusy(null)
    }
  }

  function handleUpdateBusinessProfile() {
    setCompanyName(activeApproved?.companyName ?? "")
    setWebsite(activeApproved?.website ?? "")
    setWhatTheySell(activeApproved?.input.whatTheySell ?? "")
    setWhoTheySellTo(activeApproved?.input.whoTheySellTo ?? "")
    setGeography(activeApproved?.input.geography ?? "")
    setAverageDealSize(activeApproved?.input.averageDealSize ?? "")
    setNotes(activeApproved?.input.notes ?? "")
    resolveView(activeApproved, latestDraft, true)
  }

  function updateEditableProfile(patch: Partial<BusinessProfileDraftContent>) {
    setEditableProfile((current) => (current ? { ...current, ...patch } : current))
  }

  return (
    <section
      data-qa-section="home-business-profile"
      data-qa-marker={GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER}
      data-qa-marker-foundation={GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER}
      data-business-profile-state={view}
      className={cn(
        "space-y-4",
        embedded
          ? "rounded-xl border border-border/60 bg-background/80 p-4"
          : "rounded-2xl border border-sky-100 bg-sky-50/30 p-6 dark:border-sky-900/30 dark:bg-sky-950/10",
      )}
    >
      {!embedded ? (
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-sky-100 p-2 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
          <Building2 className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_BUSINESS_PROFILE_SECTION_TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_GROWTH_PROFILE_SECTION_SUBTITLE}</p>
        </div>
      </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {view === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading Business Profile…
        </div>
      ) : null}

      {busy === "draft" ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
          data-business-profile-panel="drafting"
        >
          <Loader2 className="size-4 animate-spin" />
          {GROWTH_BUSINESS_PROFILE_DRAFTING_MESSAGE}
        </div>
      ) : null}

      {view === "create" && busy !== "draft" ? (
        <div className="space-y-4" data-business-profile-panel="no-profile">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bp-company-name">Company name</Label>
              <Input
                id="bp-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Service Co."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-website">Website</Label>
              <Input
                id="bp-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-what-sell">What you sell (optional)</Label>
              <Input
                id="bp-what-sell"
                value={whatTheySell}
                onChange={(e) => setWhatTheySell(e.target.value)}
                placeholder="Field service software"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-who-sell">Who you sell to (optional)</Label>
              <Input
                id="bp-who-sell"
                value={whoTheySellTo}
                onChange={(e) => setWhoTheySellTo(e.target.value)}
                placeholder="Equipment maintenance companies"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-geography">Geography (optional)</Label>
              <Input
                id="bp-geography"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="United States"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-deal-size">Average deal size (optional)</Label>
              <Input
                id="bp-deal-size"
                value={averageDealSize}
                onChange={(e) => setAverageDealSize(e.target.value)}
                placeholder="$5k–$25k annual"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bp-notes">Notes for {teammate.name} (optional)</Label>
              <Textarea
                id="bp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Anything else ${teammate.name} should know about your business or ideal customers.`}
                rows={3}
              />
            </div>
          </div>
          <Button onClick={() => void handleDraftProfile()} disabled={busy !== null || !companyName || !website}>
            {busy === "draft" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {GROWTH_BUSINESS_PROFILE_DRAFT_LABEL}
          </Button>
        </div>
      ) : null}

      {view === "draft" && editingDraft && editableProfile ? (
        <div className="space-y-4" data-business-profile-panel="draft">
          <GrowthBadge tone="attention">{BUSINESS_PROFILE_DRAFT_LABEL}</GrowthBadge>
          <p className="text-sm text-muted-foreground">
            I proposed this Business Profile from your inputs. Edit any section, then approve or reject.
          </p>

          <ProfileSectionEditor title="Company">
            <div className="space-y-2">
              <Label>Short description</Label>
              <Textarea
                value={editableProfile.company.shortDescription}
                onChange={(e) =>
                  updateEditableProfile({
                    company: { ...editableProfile.company, shortDescription: e.target.value },
                  })
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Products / services (one per line)</Label>
              <Textarea
                value={listLines(editableProfile.company.productsServices)}
                onChange={(e) =>
                  updateEditableProfile({
                    company: { ...editableProfile.company, productsServices: parseLines(e.target.value) },
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Primary value proposition</Label>
              <Textarea
                value={editableProfile.company.primaryValueProposition}
                onChange={(e) =>
                  updateEditableProfile({
                    company: { ...editableProfile.company, primaryValueProposition: e.target.value },
                  })
                }
                rows={2}
              />
            </div>
          </ProfileSectionEditor>

          <ProfileSectionEditor title="Ideal Customers">
            <div className="space-y-2">
              <Label>Target industries (one per line)</Label>
              <Textarea
                value={listLines(editableProfile.idealCustomers.targetIndustries)}
                onChange={(e) =>
                  updateEditableProfile({
                    idealCustomers: {
                      ...editableProfile.idealCustomers,
                      targetIndustries: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Buyer personas (one per line)</Label>
              <Textarea
                value={listLines(editableProfile.idealCustomers.buyerPersonas)}
                onChange={(e) =>
                  updateEditableProfile({
                    idealCustomers: {
                      ...editableProfile.idealCustomers,
                      buyerPersonas: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
          </ProfileSectionEditor>

          <ProfileSectionEditor title="Problems & Triggers">
            <div className="space-y-2">
              <Label>Pain points (one per line)</Label>
              <Textarea
                value={listLines(editableProfile.problemsAndTriggers.painPoints)}
                onChange={(e) =>
                  updateEditableProfile({
                    problemsAndTriggers: {
                      ...editableProfile.problemsAndTriggers,
                      painPoints: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Keywords (one per line)</Label>
              <Textarea
                value={listLines(editableProfile.problemsAndTriggers.keywords)}
                onChange={(e) =>
                  updateEditableProfile({
                    problemsAndTriggers: {
                      ...editableProfile.problemsAndTriggers,
                      keywords: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
          </ProfileSectionEditor>

          <ProfileSectionEditor title="Sales & Marketing">
            <div className="space-y-2">
              <Label>Messaging angles (one per line)</Label>
              <Textarea
                value={listLines(editableProfile.salesAndMarketing.messagingAngles)}
                onChange={(e) =>
                  updateEditableProfile({
                    salesAndMarketing: {
                      ...editableProfile.salesAndMarketing,
                      messagingAngles: parseLines(e.target.value),
                    },
                  })
                }
                rows={3}
              />
            </div>
          </ProfileSectionEditor>

          <ProfileSectionEditor title="My assumptions">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {editableProfile.confidence.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProfileSectionEditor>

          {editableProfile.confidence.missingInformation.length > 0 ? (
            <ProfileSectionEditor title="I want you to confirm">
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                {editableProfile.confidence.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </ProfileSectionEditor>
          ) : null}

          <ProfileSectionEditor title="Confidence">
            <p className="text-sm text-muted-foreground">
              Confidence score: {Math.round(editableProfile.confidence.score * 100)}%
            </p>
            {editableProfile.draftSource ? (
              <p className="text-xs text-muted-foreground">Draft source: {editableProfile.draftSource}</p>
            ) : null}
          </ProfileSectionEditor>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void handleSaveDraftEdits()} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Edit
            </Button>
            <Button onClick={() => void handleApprove()} disabled={busy !== null}>
              {busy === "approve" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {GROWTH_BUSINESS_PROFILE_APPROVE_LABEL}
            </Button>
            <Button variant="destructive" onClick={() => void handleReject()} disabled={busy !== null}>
              {busy === "reject" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {GROWTH_BUSINESS_PROFILE_REJECT_LABEL}
            </Button>
          </div>
        </div>
      ) : null}

      {view === "approved" && activeApproved ? (
        <div className="space-y-4" data-business-profile-panel="approved">
          <GrowthBadge tone="healthy">{BUSINESS_PROFILE_APPROVED_LABEL}</GrowthBadge>
          <div className="rounded-xl border border-border/60 bg-background/80 p-4">
            <h3 className="font-semibold">{activeApproved.companyName}</h3>
            <p className="text-sm text-muted-foreground">{activeApproved.website}</p>
            <p className="mt-3 text-sm">{activeApproved.profile.company.shortDescription}</p>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="font-medium">Target industries</p>
                <p className="text-muted-foreground">
                  {activeApproved.profile.idealCustomers.targetIndustries.join(", ")}
                </p>
              </div>
              <div>
                <p className="font-medium">Buyer personas</p>
                <p className="text-muted-foreground">
                  {activeApproved.profile.idealCustomers.buyerPersonas.join(", ")}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={handleUpdateBusinessProfile}>
            {GROWTH_BUSINESS_PROFILE_UPDATE_LABEL}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
