"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GROWTH_SENDR_PAGE_TEMPLATES } from "@/lib/growth/sendr/growth-sendr-builder-config"
import { buildGrowthPersonalizedVideosPageDetailPath } from "@/lib/growth/sendr/growth-sendr-branding"

const SOURCE_TYPES = ["manual", "lead", "company", "audience_member"] as const

export function GrowthSendrPageCreateForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [title, setTitle] = useState(searchParams.get("title") ?? "")
  const [sourceType, setSourceType] = useState<(typeof SOURCE_TYPES)[number]>(() => {
    if (searchParams.get("audienceMemberId")) return "audience_member"
    if (searchParams.get("leadId")) return "lead"
    if (searchParams.get("companyId")) return "company"
    return "manual"
  })
  const [leadId, setLeadId] = useState(searchParams.get("leadId") ?? "")
  const [companyId, setCompanyId] = useState(searchParams.get("companyId") ?? "")
  const [audienceMemberId, setAudienceMemberId] = useState(searchParams.get("audienceMemberId") ?? "")
  const [quickStartTemplateId, setQuickStartTemplateId] = useState<string>("general_field_service")
  const [applyQuickStart, setApplyQuickStart] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createPage() {
    if (!title.trim()) {
      setError("Page name is required")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        action: "create",
        title: title.trim(),
        templateType: "default",
      }
      if (sourceType === "lead" && leadId.trim()) body.leadId = leadId.trim()
      if (sourceType === "company" && companyId.trim()) body.companyId = companyId.trim()
      if (sourceType === "audience_member") {
        if (leadId.trim()) body.leadId = leadId.trim()
        if (audienceMemberId.trim()) body.audienceMemberId = audienceMemberId.trim()
        if (companyId.trim()) body.companyId = companyId.trim()
      }

      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { ok: boolean; page?: { id: string }; message?: string }
      if (!res.ok) {
        setError(data.message ?? "Create failed")
        return
      }
      if (data.page?.id) {
        if (applyQuickStart) {
          await fetch("/api/platform/growth/sendr/landing-pages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "apply_template",
              landingPageId: data.page.id,
              templateId: quickStartTemplateId,
              replaceExistingSections: true,
            }),
          })
        }
        router.push(buildGrowthPersonalizedVideosPageDetailPath(data.page.id))
      }
    } catch {
      setError("Create failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Create personalized landing page</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Page name</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acme intro page" />
        </div>

        <div className="space-y-2">
          <Label>Source</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as (typeof SOURCE_TYPES)[number])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(sourceType === "lead" || sourceType === "audience_member") && (
          <div className="space-y-2">
            <Label htmlFor="leadId">Lead ID</Label>
            <Input id="leadId" value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="UUID" />
          </div>
        )}

        {(sourceType === "company" || sourceType === "audience_member") && (
          <div className="space-y-2">
            <Label htmlFor="companyId">Company ID</Label>
            <Input id="companyId" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="UUID" />
          </div>
        )}

        {sourceType === "audience_member" && (
          <div className="space-y-2">
            <Label htmlFor="audienceMemberId">Audience member ID</Label>
            <Input
              id="audienceMemberId"
              value={audienceMemberId}
              onChange={(e) => setAudienceMemberId(e.target.value)}
              placeholder="UUID"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Quick-start template</Label>
          <Select value={quickStartTemplateId} onValueChange={setQuickStartTemplateId}>
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
          <p className="text-xs text-muted-foreground">
            Seeds hero, benefits, FAQ, and CTA sections — no AI required. Edit before publishing.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={applyQuickStart}
            onChange={(e) => setApplyQuickStart(e.target.checked)}
          />
          Apply quick-start template on create
        </label>

        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Sparkles className="size-4" />
            AI-assisted drafts
          </p>
          <p className="mt-1">
            After creating the page, open the <strong>AI &amp; templates</strong> tab to generate a personalized draft
            with operator review.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button disabled={busy} onClick={() => void createPage()}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Create page
        </Button>
      </CardContent>
    </Card>
  )
}
