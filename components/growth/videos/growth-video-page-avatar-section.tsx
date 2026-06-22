"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AI_AVATAR_DEFAULT_RESOLUTION,
  GROWTH_AI_AVATAR_DEFAULT_SETTINGS,
  GROWTH_AI_AVATAR_DEFAULT_THEME,
  type GrowthAiAvatarJobView,
  type GrowthAiAvatarProvider,
  type GrowthAiAvatarProviderStates,
  type GrowthAiAvatarVoiceAssetOption,
} from "@/lib/growth/media/growth-ai-avatar-generation-types"
import { listEnabledMediaAvatars } from "@/lib/growth/media/media-avatar-types"
import type { GrowthVideoScriptVersion } from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoPageAvatarSection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [scriptVersions, setScriptVersions] = useState<GrowthVideoScriptVersion[]>([])
  const [selectedScriptVersionId, setSelectedScriptVersionId] = useState<string | null>(null)
  const [provider, setProvider] = useState<GrowthAiAvatarProvider>("elevenlabs")
  const [avatarId, setAvatarId] = useState("")
  const [voiceMediaAssetId, setVoiceMediaAssetId] = useState<string | null>(null)
  const [resolution, setResolution] = useState(GROWTH_AI_AVATAR_DEFAULT_RESOLUTION)
  const [background, setBackground] = useState(GROWTH_AI_AVATAR_DEFAULT_SETTINGS.background)
  const [theme, setTheme] = useState(GROWTH_AI_AVATAR_DEFAULT_THEME)
  const [voiceAssets, setVoiceAssets] = useState<GrowthAiAvatarVoiceAssetOption[]>([])
  const [job, setJob] = useState<GrowthAiAvatarJobView | null>(null)
  const [providerStates, setProviderStates] = useState<GrowthAiAvatarProviderStates | null>(null)
  const [leadId, setLeadId] = useState("")
  const [operatorInstructions, setOperatorInstructions] = useState("")
  const [attachOnComplete, setAttachOnComplete] = useState(true)
  const [providerReadiness, setProviderReadiness] = useState<{
    ready?: boolean
    dryRunOnly?: boolean
    warnings?: string[]
    blockers?: string[]
  } | null>(null)

  const avatars = useMemo(() => listEnabledMediaAvatars(provider), [provider])
  const activeProviderState = providerStates?.[provider] ?? null

  useEffect(() => {
    const first = avatars[0]?.avatarId
    if (first) setAvatarId(first)
  }, [avatars])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const scriptsRes = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/scripts`)
      const scriptsData = (await scriptsRes.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        metadata?: { versions?: GrowthVideoScriptVersion[]; current_version_id?: string | null }
        current_version?: GrowthVideoScriptVersion | null
      }
      if (!scriptsRes.ok || !scriptsData.ok) {
        throw new Error(scriptsData.message ?? "Could not load scripts.")
      }
      const versions = scriptsData.metadata?.versions ?? []
      setScriptVersions(versions)
      setSelectedScriptVersionId(
        scriptsData.metadata?.current_version_id ?? scriptsData.current_version?.id ?? versions[0]?.id ?? null,
      )

      const voiceJobsRes = await fetch(
        `/api/growth/media/jobs?generation_type=voice_generation&video_page_id=${encodeURIComponent(pageId)}&limit=20`,
      )
      const voiceJobsData = (await voiceJobsRes.json().catch(() => ({}))) as {
        ok?: boolean
        items?: Array<{ id: string; output?: { storage_writeback?: { asset_id?: string }; ai_payload?: { dry_run?: boolean } } }>
      }
      if (voiceJobsRes.ok && voiceJobsData.ok && voiceJobsData.items) {
        const options: GrowthAiAvatarVoiceAssetOption[] = voiceJobsData.items
          .map((item) => {
            const assetId = item.output?.storage_writeback?.asset_id
            if (!assetId) return null
            return {
              mediaAssetId: assetId,
              runId: item.id,
              title: `Voiceover ${item.id.slice(0, 8)}`,
              dryRun: Boolean(item.output?.ai_payload?.dry_run),
            }
          })
          .filter((item): item is GrowthAiAvatarVoiceAssetOption => item != null)
        setVoiceAssets(options)
      }

      const jobsRes = await fetch(
        `/api/growth/media/jobs?generation_type=avatar_generation&video_page_id=${encodeURIComponent(pageId)}&limit=1`,
      )
      const jobsData = (await jobsRes.json().catch(() => ({}))) as {
        ok?: boolean
        items?: Array<{ id: string }>
      }
      if (jobsRes.ok && jobsData.ok && jobsData.items?.[0]?.id) {
        const jobRes = await fetch(`/api/growth/media/avatar/jobs/${encodeURIComponent(jobsData.items[0].id)}`)
        const jobData = (await jobRes.json().catch(() => ({}))) as {
          ok?: boolean
          job?: GrowthAiAvatarJobView
          provider_states?: GrowthAiAvatarProviderStates
        }
        if (jobRes.ok && jobData.ok && jobData.job) {
          setJob(jobData.job)
          setProviderStates(jobData.job.providerStates ?? jobData.provider_states ?? null)
          setProvider(jobData.job.provider === "retell" ? "retell" : "elevenlabs")
        }
      }

      const readinessRes = await fetch("/api/growth/media/elevenlabs/provider-readiness")
      const readinessData = (await readinessRes.json().catch(() => ({}))) as {
        ok?: boolean
        report?: {
          ready?: boolean
          dryRunOnly?: boolean
          warnings?: string[]
          blockers?: string[]
        }
      }
      if (readinessRes.ok && readinessData.ok && readinessData.report) {
        setProviderReadiness(readinessData.report)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void load()
  }, [load])

  async function runGenerate() {
    if (!selectedScriptVersionId || !avatarId) {
      setError("Select a script version and avatar first.")
      return
    }
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/media/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_page_id: pageId,
          script_version_id: selectedScriptVersionId,
          avatar_id: avatarId,
          provider,
          voice_media_asset_id: voiceMediaAssetId,
          settings: { resolution, background, theme },
          lead_id: leadId.trim() || null,
          operator_instructions: operatorInstructions.trim() || null,
          attach_to_page_on_complete: attachOnComplete,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        job?: GrowthAiAvatarJobView
        provider_states?: GrowthAiAvatarProviderStates
      }
      if (!res.ok || !data.ok || !data.job) throw new Error(data.message ?? "Avatar generation failed.")
      setJob(data.job)
      setProviderStates(data.job.providerStates ?? data.provider_states ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Avatar generation failed.")
    } finally {
      setActing(false)
    }
  }

  async function runRetry() {
    if (!job) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/media/avatar/jobs/${encodeURIComponent(job.runId)}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Operator retry" }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; job?: GrowthAiAvatarJobView }
      if (!res.ok || !data.ok || !data.job) throw new Error(data.message ?? "Retry failed.")
      setJob(data.job)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.")
    } finally {
      setActing(false)
    }
  }

  async function runCancel() {
    if (!job) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/media/avatar/jobs/${encodeURIComponent(job.runId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Operator cancelled" }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; job?: GrowthAiAvatarJobView }
      if (!res.ok || !data.ok || !data.job) throw new Error(data.message ?? "Cancel failed.")
      setJob(data.job)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.")
    } finally {
      setActing(false)
    }
  }

  async function runAttachToPage() {
    if (!job?.outputMediaAssetId) {
      setError("Generate a completed avatar video before attaching to the page.")
      return
    }
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/media/generated-video/attach-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_page_id: pageId,
          media_asset_id: job.outputMediaAssetId,
          lead_id: leadId.trim() || null,
          media_generation_run_id: job.runId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Attach failed.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attach failed.")
    } finally {
      setActing(false)
    }
  }

  const selectedScript = scriptVersions.find((version) => version.id === selectedScriptVersionId)

  return (
    <GrowthEnginePanelResilience loading={loading} error={error}>
      <div className="space-y-4">
        <GrowthEngineCard title="Script selection">
          {scriptVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generate a script on the Scripts tab first.</p>
          ) : (
            <div className="space-y-2">
              <Label>Script version</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={selectedScriptVersionId ?? ""}
                onChange={(e) => setSelectedScriptVersionId(e.target.value || null)}
              >
                {scriptVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {new Date(version.createdAt).toLocaleString()} — {version.output.hook.slice(0, 60)}
                  </option>
                ))}
              </select>
              {selectedScript ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedScript.output.script}</p>
              ) : null}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Prospect personalization">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Lead ID (optional)</Label>
              <Input
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="UUID — merges lead/company/sender variables before generation"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Operator instructions (optional)</Label>
              <Input
                value={operatorInstructions}
                onChange={(e) => setOperatorInstructions(e.target.value)}
                placeholder="Extra narration guidance appended to merged script"
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={attachOnComplete}
                onChange={(e) => setAttachOnComplete(e.target.checked)}
              />
              Attach generated video to this page when generation completes
            </label>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Provider diagnostics">
          {providerReadiness ? (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge tone={providerReadiness.ready ? "healthy" : "blocked"}>
                  {providerReadiness.ready ? "Ready" : "Not ready"}
                </GrowthBadge>
                {providerReadiness.dryRunOnly ? <GrowthBadge tone="neutral">Dry run only</GrowthBadge> : null}
              </div>
              {(providerReadiness.blockers ?? []).map((blocker) => (
                <p key={blocker} className="text-destructive">
                  Blocker: {blocker}
                </p>
              ))}
              {(providerReadiness.warnings ?? []).slice(0, 4).map((warning) => (
                <p key={warning} className="text-muted-foreground">
                  {warning}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading ElevenLabs provider readiness…</p>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Provider">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Avatar provider</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={provider}
                onChange={(e) => setProvider(e.target.value as GrowthAiAvatarProvider)}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="retell">Retell</option>
              </select>
            </div>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Avatar settings">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Avatar</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
              >
                {avatars.map((avatar) => (
                  <option key={avatar.avatarId} value={avatar.avatarId}>
                    {avatar.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Voice asset (optional)</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={voiceMediaAssetId ?? ""}
                onChange={(e) => setVoiceMediaAssetId(e.target.value || null)}
              >
                <option value="">None — provider default voice</option>
                {voiceAssets.map((asset) => (
                  <option key={asset.mediaAssetId} value={asset.mediaAssetId}>
                    {asset.title} {asset.dryRun ? "(dry run)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Resolution</Label>
              <Input value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Background</Label>
              <Input value={background} onChange={(e) => setBackground(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Branding theme</Label>
              <Input value={theme} onChange={(e) => setTheme(e.target.value)} />
              <p className="text-xs text-muted-foreground">Default inherits page branding from B2 overlays.</p>
            </div>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Generation">
          {activeProviderState?.dryRunOnly ? (
            <p className="mb-3 text-sm text-amber-700">
              {provider === "elevenlabs"
                ? "ElevenLabs avatar provider disabled — dry-run/mock MP4 only. Set `GROWTH_ELEVENLABS_AVATAR_ENABLED=true` and `ELEVENLABS_API_KEY` on Vercel Production."
                : "Retell avatar provider disabled — dry-run/mock MP4 only. Set `GROWTH_RETELL_AVATAR_ENABLED=true` and `RETELL_API_KEY` on Vercel Production."}
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">
              {provider === "elevenlabs" ? "ElevenLabs" : "Retell"} avatar provider enabled for this environment.
            </p>
          )}
          <Button type="button" onClick={() => void runGenerate()} disabled={acting || !selectedScriptVersionId || !avatarId}>
            {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Generate avatar
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Human review required. No auto-publish, sequences, outreach, or automations are triggered.
          </p>
        </GrowthEngineCard>

        {job ? (
          <>
            <GrowthEngineCard title="Job status">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge tone={job.status === "completed" ? "healthy" : job.status === "failed" ? "blocked" : "neutral"}>
                  {job.status}
                </GrowthBadge>
                <span className="text-sm text-muted-foreground">{job.progressPercent}%</span>
                {job.aiPayload?.dry_run ? <GrowthBadge tone="neutral">Dry run</GrowthBadge> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void runRetry()} disabled={acting}>
                  Retry
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void runCancel()} disabled={acting}>
                  Cancel
                </Button>
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium">Progress timeline</p>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(job.progressTimeline, null, 2)}
                </pre>
              </div>
            </GrowthEngineCard>

            <GrowthEngineCard title="Output">
              {job.videoUrl ? (
                <div className="space-y-3">
                  <video controls className="w-full rounded-xl border border-border bg-black" src={job.videoUrl} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={job.downloadUrl ?? job.videoUrl} download="avatar.mp4" target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </Button>
                    {job.outputMediaAssetId ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={`/growth/media?asset=${job.outputMediaAssetId}`}>Media asset</a>
                      </Button>
                    ) : null}
                    {job.status === "completed" && job.outputMediaAssetId ? (
                      <Button type="button" size="sm" onClick={() => void runAttachToPage()} disabled={acting}>
                        Attach to page
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No video URL available yet.</p>
              )}
              <div className="mt-3">
                <p className="text-sm font-medium">AI payload</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(job.aiPayload, null, 2)}
                </pre>
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium">Raw JSON</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(job, null, 2)}
                </pre>
              </div>
            </GrowthEngineCard>
          </>
        ) : null}
      </div>
    </GrowthEnginePanelResilience>
  )
}
