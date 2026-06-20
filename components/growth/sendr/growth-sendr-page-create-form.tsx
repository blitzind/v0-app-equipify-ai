"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
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

const TEMPLATE_TYPES = ["default", "intro", "follow_up", "meeting_recap"] as const
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
  const [templateType, setTemplateType] = useState<string>("default")
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
        templateType,
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
        router.push(`/growth/sendr/${data.page.id}`)
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
          <Label>Template type</Label>
          <Select value={templateType} onValueChange={setTemplateType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
