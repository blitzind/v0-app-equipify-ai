"use client"

import { useState } from "react"
import { Loader2, Sparkles, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GROWTH_SHARE_PAGE_QUICK_TEMPLATES } from "@/lib/growth/share-pages/share-page-types"

export type SharePageAiDraftResult = {
  headline: string
  heroMessage: string
  whyReachingOut: string
  companyObservations: string[]
  ctaLabel: string
  provider: "ai" | "template_fallback"
  message?: string
}

type Props = {
  disabled?: boolean
  onDraftReady: (draft: SharePageAiDraftResult) => void
  onMessage: (message: string | null) => void
}

export function GrowthSharePageAiDraftPanel({ disabled, onDraftReady, onMessage }: Props) {
  const [targetCompany, setTargetCompany] = useState("")
  const [targetPerson, setTargetPerson] = useState("")
  const [industry, setIndustry] = useState("")
  const [pageObjective, setPageObjective] = useState("")
  const [painPoints, setPainPoints] = useState("")
  const [desiredCta, setDesiredCta] = useState("Schedule Demo")
  const [tone, setTone] = useState("professional")
  const [templateId, setTemplateId] = useState("general_field_service")
  const [draft, setDraft] = useState<SharePageAiDraftResult | null>(null)
  const [generating, setGenerating] = useState(false)

  async function generateDraft() {
    setGenerating(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/share-pages/builder/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCompany,
          targetPerson,
          industry,
          pageObjective,
          painPoints,
          desiredCta,
          tone,
          templateId,
        }),
      })
      const data = (await res.json()) as { ok: boolean; draft?: SharePageAiDraftResult; message?: string }
      if (!res.ok || !data.draft) {
        onMessage(data.message ?? "Generation failed")
        return
      }
      setDraft(data.draft)
      onMessage(data.draft.message ?? "Draft ready — review before saving.")
    } finally {
      setGenerating(false)
    }
  }

  function applyDraft() {
    if (!draft) return
    onDraftReady(draft)
    onMessage("Draft applied to form — review and edit before publishing.")
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4" />
          Generate with AI
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator-driven draft only — review before save or publish. Falls back to templates if AI is unavailable.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Target company</Label>
          <Input value={targetCompany} disabled={disabled || generating} onChange={(e) => setTargetCompany(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Target person</Label>
          <Input value={targetPerson} disabled={disabled || generating} onChange={(e) => setTargetPerson(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={industry} disabled={disabled || generating} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Page objective</Label>
          <Input value={pageObjective} disabled={disabled || generating} onChange={(e) => setPageObjective(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Pain points</Label>
        <Textarea value={painPoints} disabled={disabled || generating} onChange={(e) => setPainPoints(e.target.value)} rows={3} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Desired CTA</Label>
          <Input value={desiredCta} disabled={disabled || generating} onChange={(e) => setDesiredCta(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fallback template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROWTH_SHARE_PAGE_QUICK_TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={disabled || generating} onClick={() => void generateDraft()}>
          {generating ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Wand2 className="mr-1.5 size-4" />}
          Generate draft
        </Button>
        {draft ? (
          <Button type="button" variant="secondary" disabled={disabled} onClick={applyDraft}>
            Apply draft to form
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="font-medium">Preview ({draft.provider === "ai" ? "AI" : "template fallback"})</p>
          <p className="mt-1 text-muted-foreground">{draft.headline}</p>
        </div>
      ) : null}
    </div>
  )
}
