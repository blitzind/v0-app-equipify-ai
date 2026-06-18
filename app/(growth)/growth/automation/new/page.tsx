"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthAutomationNewPage() {
  const router = useRouter()
  const automationEditorBasePath = useGrowthFeaturePath("automation")
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
      router.push(`${automationEditorBasePath}/${data.flow.id}`)
    } catch {
      setError("Create failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <GrowthWorkspacePageContent className="max-w-3xl">
      <GrowthWorkspacePageHeader
        title="New Automation Flow"
        description="Creates a draft flow with version 1."
        icon={GitBranch}
        iconClassName="bg-sky-50 text-sky-600"
      />

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
    </GrowthWorkspacePageContent>
  )
}
