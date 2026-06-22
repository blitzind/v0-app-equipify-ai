"use client"

import { useState } from "react"
import { Loader2, Sparkles, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GROWTH_SENDR_PAGE_TEMPLATES } from "@/lib/growth/sendr/growth-sendr-builder-config"

type DraftSection = {
  sectionType: string
  sortOrder: number
  content: Record<string, unknown>
}

type DraftResult = {
  title: string
  sections: DraftSection[]
  provider: "ai" | "template_fallback"
  message?: string
}

type Props = {
  pageId?: string
  disabled?: boolean
  onDraftApplied?: () => void
  onDraftReady?: (draft: DraftResult) => void
  onMessage: (message: string | null) => void
  mode?: "create" | "edit"
}

export function GrowthSendrBuilderAiDraftPanel({
  pageId,
  disabled,
  onDraftApplied,
  onDraftReady,
  onMessage,
  mode = "edit",
}: Props) {
  const [targetCompany, setTargetCompany] = useState("")
  const [targetPerson, setTargetPerson] = useState("")
  const [industry, setIndustry] = useState("")
  const [painPoints, setPainPoints] = useState("")
  const [desiredCta, setDesiredCta] = useState("Schedule Demo")
  const [tone, setTone] = useState("professional")
  const [templateId, setTemplateId] = useState("general_field_service")
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)

  async function generateDraft() {
    setGenerating(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_ai_draft",
          aiInput: {
            targetCompany,
            targetPerson,
            industry,
            painPoints,
            desiredCta,
            tone,
            templateId,
          },
        }),
      })
      const data = (await res.json()) as { ok: boolean; draft?: DraftResult; message?: string }
      if (!res.ok || !data.draft) {
        onMessage(data.message ?? "Generation failed")
        return
      }
      setDraft(data.draft)
      onDraftReady?.(data.draft)
      onMessage(data.draft.message ?? "Draft ready for review")
    } finally {
      setGenerating(false)
    }
  }

  async function applyTemplateOnly() {
    if (!pageId) return
    setApplying(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_template",
          landingPageId: pageId,
          templateId,
          replaceExistingSections: true,
        }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        onMessage(data.message ?? "Template apply failed")
        return
      }
      onMessage("Template applied — review sections before publishing.")
      onDraftApplied?.()
    } finally {
      setApplying(false)
    }
  }

  async function applyDraft() {
    if (!pageId || !draft) return
    setApplying(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_page_draft",
          landingPageId: pageId,
          draftTitle: draft.title,
          draftSections: draft.sections,
          replaceExistingSections: true,
        }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        onMessage(data.message ?? "Apply draft failed")
        return
      }
      onMessage("Draft applied — review and edit before publishing.")
      onDraftApplied?.()
    } finally {
      setApplying(false)
    }
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4" />
          Generate with AI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Operator-driven draft only — review and edit before publish. Falls back to templates if AI is unavailable.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <Label>Desired CTA</Label>
            <Input value={desiredCta} disabled={disabled || generating} onChange={(e) => setDesiredCta(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Pain points</Label>
          <Textarea value={painPoints} disabled={disabled || generating} onChange={(e) => setPainPoints(e.target.value)} rows={3} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Input value={tone} disabled={disabled || generating} onChange={(e) => setTone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fallback template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROWTH_SENDR_PAGE_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled || generating} onClick={() => void generateDraft()}>
            {generating ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Wand2 className="mr-1.5 size-4" />}
            Generate draft
          </Button>
          {pageId ? (
            <>
              <Button variant="outline" disabled={disabled || applying} onClick={() => void applyTemplateOnly()}>
                Apply template only
              </Button>
              {draft ? (
                <Button variant="secondary" disabled={disabled || applying} onClick={() => void applyDraft()}>
                  {applying ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                  Apply draft to page
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        {draft ? (
          <div className="rounded-xl border bg-muted/20 p-4 text-sm">
            <p className="font-medium">
              Draft preview ({draft.provider === "ai" ? "AI" : "template fallback"})
            </p>
            <p className="mt-1 text-muted-foreground">{draft.title}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {draft.sections.map((section) => (
                <li key={`${section.sectionType}-${section.sortOrder}`}>
                  {section.sectionType} · {String(section.content.headline ?? section.content.label ?? "section")}
                </li>
              ))}
            </ul>
            {mode === "create" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Create the page first, then apply this draft from the page editor.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
