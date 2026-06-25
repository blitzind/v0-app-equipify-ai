"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  EQUIPIFY_DEFAULT_AI_ICP_PROFILE,
  PROSPECT_SEARCH_ICP_SETUP_PLACEHOLDER_STORAGE_KEY,
  type ProspectSearchAiIcpProfile,
} from "@/lib/growth/prospect-search/prospect-search-ai-icp-config"

type ProspectSearchIcpSetupSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "set" | "refine"
  onApplyProfile: (profile: ProspectSearchAiIcpProfile) => void
}

function readStoredIcpDraft(): ProspectSearchAiIcpProfile | null {
  try {
    const raw = localStorage.getItem(PROSPECT_SEARCH_ICP_SETUP_PLACEHOLDER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProspectSearchAiIcpProfile
  } catch {
    return null
  }
}

function writeStoredIcpDraft(profile: ProspectSearchAiIcpProfile): void {
  try {
    localStorage.setItem(PROSPECT_SEARCH_ICP_SETUP_PLACEHOLDER_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // ignore storage failures
  }
}

function listToText(values: string[]): string {
  return values.join("\n")
}

function textToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function ProspectSearchIcpSetupSheet({
  open,
  onOpenChange,
  mode,
  onApplyProfile,
}: ProspectSearchIcpSetupSheetProps) {
  const [draft, setDraft] = useState<ProspectSearchAiIcpProfile>(EQUIPIFY_DEFAULT_AI_ICP_PROFILE)

  useEffect(() => {
    if (!open) return
    const stored = readStoredIcpDraft()
    if (mode === "refine" && stored) {
      setDraft(stored)
      return
    }
    if (mode === "set") {
      setDraft({
        ...EQUIPIFY_DEFAULT_AI_ICP_PROFILE,
        companyLabel: "",
        whatWeSell: "",
        customerTypes: [],
        industries: [],
        workflows: [],
        decisionMakers: [],
        buyingSignals: [],
        geography: "",
        companySize: "",
        disqualifiers: [],
        buyingTriggers: [],
      })
      return
    }
    setDraft(stored ?? EQUIPIFY_DEFAULT_AI_ICP_PROFILE)
  }, [mode, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{mode === "set" ? "Set your ICP" : "Refine your ICP"}</SheetTitle>
          <SheetDescription>
            Describe who you sell to. Growth Engine will turn this into search suggestions. Saved locally
            for now — org-wide ICP storage is coming soon.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Company</span>
            <input
              value={draft.companyLabel}
              onChange={(e) => setDraft((prev) => ({ ...prev, companyLabel: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Your company name"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">What you sell</span>
            <textarea
              value={draft.whatWeSell}
              onChange={(e) => setDraft((prev) => ({ ...prev, whatWeSell: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Product, outcomes, and core value proposition"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Best customer types (one per line)</span>
            <textarea
              value={listToText(draft.customerTypes)}
              onChange={(e) => setDraft((prev) => ({ ...prev, customerTypes: textToList(e.target.value) }))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Industries served</span>
            <textarea
              value={listToText(draft.industries)}
              onChange={(e) => setDraft((prev) => ({ ...prev, industries: textToList(e.target.value) }))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Target geography</span>
            <input
              value={draft.geography}
              onChange={(e) => setDraft((prev) => ({ ...prev, geography: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Company size</span>
            <input
              value={draft.companySize}
              onChange={(e) => setDraft((prev) => ({ ...prev, companySize: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Decision makers</span>
            <textarea
              value={listToText(draft.decisionMakers)}
              onChange={(e) => setDraft((prev) => ({ ...prev, decisionMakers: textToList(e.target.value) }))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Disqualifiers</span>
            <textarea
              value={listToText(draft.disqualifiers)}
              onChange={(e) => setDraft((prev) => ({ ...prev, disqualifiers: textToList(e.target.value) }))}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Buying triggers</span>
            <textarea
              value={listToText(draft.buyingTriggers)}
              onChange={(e) => setDraft((prev) => ({ ...prev, buyingTriggers: textToList(e.target.value) }))}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <SheetFooter className="border-t border-border px-4 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              writeStoredIcpDraft(draft)
              onApplyProfile(draft)
              onOpenChange(false)
            }}
          >
            Save ICP draft
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
