"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Loader2 } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AdminGrowthAutomationNewPage() {
  const router = useRouter()
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createFlow() {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      const data = (await res.json()) as { ok: boolean; flow?: { id: string }; message?: string }
      if (!res.ok || !data.flow?.id) {
        setError(data.message ?? "Create failed")
        return
      }
      router.push(`/admin/growth/automation/${data.flow.id}`)
    } catch {
      setError("Create failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <GitBranch size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>New Automation Flow</h1>
              <p className="text-sm text-muted-foreground">Creates a draft flow with version 1.</p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <div className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <label className="flex flex-col gap-1 text-sm">
              Name
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Lead nurture flow" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Description
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional description"
              />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button disabled={busy} onClick={() => void createFlow()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Create draft flow
            </Button>
          </div>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
