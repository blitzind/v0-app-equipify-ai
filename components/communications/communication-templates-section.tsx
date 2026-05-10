"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Eye, Loader2, Mail, MessageSquarePlus, Plus, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { COMMUNICATION_TEMPLATE_CATEGORIES } from "@/lib/communications/template-category"
import { CUSTOMER_SAFE_MERGE_TOKENS, FINANCIAL_MERGE_TOKENS } from "@/lib/communications/template-tokens"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"

type TemplateRow = {
  id: string
  template_key: string
  name: string
  category: string
  subject: string | null
  body: string
  channel: string
  enabled: boolean
  updated_at: string
}

type PreviewPayload = {
  mergedSubject: string
  mergedBody: string
  smsBodyLength: number
  smsSegmentsApprox: number
  warnings: string[]
}

export function CommunicationTemplatesSection({ orgId, active }: { orgId: string; active: boolean }) {
  const { toast } = useToast()
  const { permissions } = useOrgPermissions()
  const canManage = Boolean(permissions.canManageCommunications)
  const canSeeFinancialTokens = Boolean(permissions.canViewFinancials || permissions.canViewBilling)

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [needsManagerSeed, setNeedsManagerSeed] = useState(false)
  const [editTpl, setEditTpl] = useState<TemplateRow | null>(null)
  const [tplDraft, setTplDraft] = useState({
    name: "",
    subject: "",
    body: "",
    category: "general" as string,
    channel: "email" as string,
    enabled: true,
  })
  const [tplSaving, setTplSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState({
    name: "",
    category: "general",
    channel: "email" as "email" | "sms",
    subject: "",
    body: "",
  })
  const [createSaving, setCreateSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/templates`, {
        cache: "no-store",
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        templates?: TemplateRow[]
        needsManagerSeed?: boolean
        message?: string
        error?: string
      }
      if (!res.ok || !body.ok) throw new Error(body.message ?? body.error ?? "Could not load templates.")
      setTemplates(body.templates ?? [])
      setNeedsManagerSeed(Boolean(body.needsManagerSeed))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load templates."
      toast({ title: "Templates unavailable", description: msg, variant: "destructive" })
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [orgId, toast])

  useEffect(() => {
    if (!active || !orgId) return
    void loadTemplates()
  }, [active, orgId, loadTemplates])

  function openEdit(t: TemplateRow) {
    setPreview(null)
    setEditTpl(t)
    setTplDraft({
      name: t.name,
      subject: t.subject ?? "",
      body: t.body,
      category: t.category,
      channel: t.channel,
      enabled: t.enabled !== false,
    })
  }

  async function saveTemplate() {
    if (!orgId || !editTpl) return
    if (!canManage) return
    setTplSaving(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications/templates/${encodeURIComponent(editTpl.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tplDraft.name,
            subject: tplDraft.channel === "email" ? tplDraft.subject : null,
            body: tplDraft.body,
            category: tplDraft.category,
            channel: tplDraft.channel,
            enabled: tplDraft.enabled,
          }),
        },
      )
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !body.ok) throw new Error(body.message ?? "Save failed.")
      toast({ title: "Template saved" })
      setEditTpl(null)
      setPreview(null)
      void loadTemplates()
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save.",
        variant: "destructive",
      })
    } finally {
      setTplSaving(false)
    }
  }

  async function toggleEnabled(t: TemplateRow) {
    if (!canManage) return
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications/templates/${encodeURIComponent(t.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !t.enabled }),
        },
      )
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean }
      if (!res.ok || !body.ok) throw new Error()
      void loadTemplates()
    } catch {
      toast({ title: "Could not update template", variant: "destructive" })
    }
  }

  async function runPreview(subject: string | null, body: string, channel: string) {
    setPreviewLoading(true)
    setPreview(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/communications/templates/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body, channel }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        preview?: PreviewPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.preview) throw new Error(data.message ?? "Preview failed.")
      setPreview(data.preview)
    } catch (e) {
      toast({
        title: "Preview failed",
        description: e instanceof Error ? e.message : "Could not preview.",
        variant: "destructive",
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  async function createTemplate() {
    if (!canManage) return
    const name = createDraft.name.trim()
    const body = createDraft.body.trim()
    if (!name || !body) {
      toast({ variant: "destructive", title: "Missing fields", description: "Name and body are required." })
      return
    }
    setCreateSaving(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/communications/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: createDraft.category,
          channel: createDraft.channel,
          subject: createDraft.channel === "email" ? createDraft.subject : null,
          body,
          enabled: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Create failed.")
      toast({ title: "Template created" })
      setCreateOpen(false)
      setCreateDraft({ name: "", category: "general", channel: "email", subject: "", body: "" })
      void loadTemplates()
    } catch (e) {
      toast({
        title: "Create failed",
        description: e instanceof Error ? e.message : "Could not create.",
        variant: "destructive",
      })
    } finally {
      setCreateSaving(false)
    }
  }

  return (
    <div className="mt-0 space-y-4">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-sm text-sky-950 dark:text-sky-50 space-y-2">
        <p className="font-medium">Customer-safe templates (Phase 51)</p>
        <p className="text-xs leading-relaxed opacity-90">
          These messages are <span className="font-semibold">not sent automatically</span> from this screen. Use merge
          tokens for placeholders — avoid technician-only or internal diagnosis fields in customer-facing copy.
        </p>
        <p className="text-xs leading-relaxed opacity-90">
          <span className="font-semibold">SMS / A2P:</span> Register campaigns and comply with carrier rules before
          sending SMS in production. Character counts are approximate; long bodies may split into multiple segments.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage ?
          <>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadTemplates()} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Refresh
            </Button>
          </>
        : null}
      </div>

      {needsManagerSeed ?
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Default template library not initialized</p>
            <p className="text-xs mt-1 opacity-90">
              Ask a workspace user with communications management access to open this tab once to seed the standard
              email/SMS drafts.
            </p>
          </div>
        </div>
      : null}

      {loading ?
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      : templates.length === 0 ?
        <p className="text-sm text-muted-foreground py-8">
          No templates yet{needsManagerSeed ? "" : " — create one or refresh after a manager seeds defaults."}
        </p>
      : <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card
              key={t.id}
              className={cn("border-border/80 shadow-sm", t.enabled === false && "opacity-60 border-dashed")}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription className="capitalize">{t.category.replace(/_/g, " ")}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      {t.channel === "sms" ?
                        <Smartphone className="size-3" />
                      : <Mail className="size-3" />}
                      {t.channel}
                    </Badge>
                    {t.enabled === false ?
                      <Badge variant="secondary" className="text-[10px]">
                        Disabled
                      </Badge>
                    : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.channel === "email" ?
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    <span className="font-medium text-foreground">Subject: </span>
                    {t.subject ?? "—"}
                  </p>
                : null}
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
                {t.channel === "sms" ?
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    Characters: {t.body.length} · Segments (approx.): {Math.max(1, Math.ceil(t.body.length / 160))}
                  </p>
                : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(t)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    disabled={previewLoading}
                    onClick={() => void runPreview(t.subject, t.body, t.channel)}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                  {canManage ?
                    <Button type="button" variant="ghost" size="sm" onClick={() => void toggleEnabled(t)}>
                      {t.enabled === false ? "Enable" : "Disable"}
                    </Button>
                  : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }

      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Merge tokens</CardTitle>
          <CardDescription>
            Use double curly braces, e.g. {"{{customer_name}}"}. Financial tokens only apply for users with billing
            visibility; preview redacts them for others.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <p className="font-semibold text-foreground mb-2">Customer-safe</p>
            <ul className="space-y-1 text-muted-foreground">
              {CUSTOMER_SAFE_MERGE_TOKENS.map((x) => (
                <li key={x.token}>
                  <code className="text-[11px] bg-muted px-1 rounded">{`{{${x.token}}}`}</code> — {x.label}
                </li>
              ))}
            </ul>
          </div>
          {canSeeFinancialTokens ?
            <div>
              <p className="font-semibold text-foreground mb-2">Financial (staff with billing access)</p>
              <ul className="space-y-1 text-muted-foreground">
                {FINANCIAL_MERGE_TOKENS.map((x) => (
                  <li key={x.token}>
                    <code className="text-[11px] bg-muted px-1 rounded">{`{{${x.token}}}`}</code> — {x.label}
                  </li>
                ))}
              </ul>
            </div>
          : <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
              Financial merge tokens are hidden — your role does not include billing/financial visibility.
            </div>
          }
        </CardContent>
      </Card>

      {preview ?
        <Card className="border-primary/25 bg-primary/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sample merged preview</CardTitle>
            <CardDescription>Illustrative only — not sent to any recipient.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {preview.warnings.length ?
              <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1 list-disc pl-4">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            : null}
            {preview.mergedSubject?.trim() ?
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Subject</p>
                <p className="text-foreground">{preview.mergedSubject}</p>
              </div>
            : null}
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Body</p>
              <p className="text-foreground whitespace-pre-wrap">{preview.mergedBody}</p>
            </div>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              SMS length: {preview.smsBodyLength} · Segments (approx.): {preview.smsSegmentsApprox}
            </p>
          </CardContent>
        </Card>
      : null}

      <Sheet open={Boolean(editTpl)} onOpenChange={(o) => !o && setEditTpl(null)}>
        <SheetContent className="sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>Edit template</SheetTitle>
            <SheetDescription>
              Phase 51 does not send messages — save drafts only. SMS shows a live character estimate.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 py-4 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={tplDraft.name}
                disabled={!canManage}
                onChange={(e) => setTplDraft((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Channel</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  disabled={!canManage}
                  value={tplDraft.channel}
                  onChange={(e) => setTplDraft((p) => ({ ...p, channel: e.target.value }))}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="in_app">In-app</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  disabled={!canManage}
                  value={tplDraft.category}
                  onChange={(e) => setTplDraft((p) => ({ ...p, category: e.target.value }))}
                >
                  {COMMUNICATION_TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tpl-enabled"
                className="rounded border-border"
                disabled={!canManage}
                checked={tplDraft.enabled}
                onChange={(e) => setTplDraft((p) => ({ ...p, enabled: e.target.checked }))}
              />
              <label htmlFor="tpl-enabled" className="text-sm text-foreground">
                Enabled
              </label>
            </div>
            {tplDraft.channel === "email" ?
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input
                  value={tplDraft.subject}
                  disabled={!canManage}
                  onChange={(e) => setTplDraft((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
            : null}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <Textarea
                rows={12}
                value={tplDraft.body}
                disabled={!canManage}
                onChange={(e) => setTplDraft((p) => ({ ...p, body: e.target.value }))}
              />
              {tplDraft.channel === "sms" ?
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Characters: {tplDraft.body.length} · Segments (approx.):{" "}
                  {Math.max(1, Math.ceil(tplDraft.body.length / 160))}
                </p>
              : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={previewLoading}
              onClick={() => void runPreview(tplDraft.channel === "email" ? tplDraft.subject : null, tplDraft.body, tplDraft.channel)}
            >
              {previewLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
              Preview merge
            </Button>
          </div>
          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTpl(null)}>
              Close
            </Button>
            {canManage ?
              <Button type="button" onClick={() => void saveTemplate()} disabled={tplSaving}>
                {tplSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="size-4" />
              New template
            </DialogTitle>
            <DialogDescription>Creates a reusable draft — no messages are sent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input value={createDraft.name} onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Channel</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={createDraft.channel}
                  onChange={(e) =>
                    setCreateDraft((p) => ({ ...p, channel: e.target.value as "email" | "sms" }))
                  }
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={createDraft.category}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, category: e.target.value }))}
                >
                  {COMMUNICATION_TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {createDraft.channel === "email" ?
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input
                  value={createDraft.subject}
                  onChange={(e) => setCreateDraft((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
            : null}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <Textarea
                rows={8}
                value={createDraft.body}
                onChange={(e) => setCreateDraft((p) => ({ ...p, body: e.target.value }))}
              />
              {createDraft.channel === "sms" ?
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Characters: {createDraft.body.length} · Segments (approx.):{" "}
                  {Math.max(1, Math.ceil(createDraft.body.length / 160))}
                </p>
              : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void createTemplate()} disabled={createSaving}>
              {createSaving ? <Loader2 className="size-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
