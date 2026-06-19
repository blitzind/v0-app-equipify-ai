"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AI_VOICE_DEFAULT_SETTINGS,
  type GrowthAiVoiceJobView,
  type GrowthAiVoiceProviderState,
} from "@/lib/growth/media/growth-ai-voice-generation-types"
import { GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG } from "@/lib/growth/media/media-voice-types"
import type { GrowthVideoScriptVersion } from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoPageVoiceSection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [scriptVersions, setScriptVersions] = useState<GrowthVideoScriptVersion[]>([])
  const [selectedScriptVersionId, setSelectedScriptVersionId] = useState<string | null>(null)
  const [voiceId, setVoiceId] = useState(GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG[0]?.voiceId ?? "")
  const [stability, setStability] = useState(GROWTH_AI_VOICE_DEFAULT_SETTINGS.stability)
  const [similarity, setSimilarity] = useState(GROWTH_AI_VOICE_DEFAULT_SETTINGS.similarity)
  const [speed, setSpeed] = useState(GROWTH_AI_VOICE_DEFAULT_SETTINGS.speed)
  const [job, setJob] = useState<GrowthAiVoiceJobView | null>(null)
  const [providerState, setProviderState] = useState<GrowthAiVoiceProviderState | null>(null)

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

      const jobsRes = await fetch(
        `/api/growth/media/jobs?generation_type=voice_generation&video_page_id=${encodeURIComponent(pageId)}&limit=1`,
      )
      const jobsData = (await jobsRes.json().catch(() => ({}))) as {
        ok?: boolean
        items?: Array<{ id: string }>
      }
      if (jobsRes.ok && jobsData.ok && jobsData.items?.[0]?.id) {
        const jobRes = await fetch(`/api/growth/media/voice/jobs/${encodeURIComponent(jobsData.items[0].id)}`)
        const jobData = (await jobRes.json().catch(() => ({}))) as {
          ok?: boolean
          job?: GrowthAiVoiceJobView
          provider_state?: GrowthAiVoiceProviderState
        }
        if (jobRes.ok && jobData.ok && jobData.job) {
          setJob(jobData.job)
          setProviderState(jobData.job.providerState ?? jobData.provider_state ?? null)
        }
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
    if (!selectedScriptVersionId) {
      setError("Select a script version first.")
      return
    }
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/media/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_page_id: pageId,
          script_version_id: selectedScriptVersionId,
          voice_id: voiceId,
          provider: "elevenlabs",
          settings: { stability, similarity, speed },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        job?: GrowthAiVoiceJobView
        provider_state?: GrowthAiVoiceProviderState
      }
      if (!res.ok || !data.ok || !data.job) throw new Error(data.message ?? "Voice generation failed.")
      setJob(data.job)
      setProviderState(data.job.providerState ?? data.provider_state ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voice generation failed.")
    } finally {
      setActing(false)
    }
  }

  async function runRetry() {
    if (!job) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/media/voice/jobs/${encodeURIComponent(job.runId)}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Operator retry" }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; job?: GrowthAiVoiceJobView }
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
      const res = await fetch(`/api/growth/media/voice/jobs/${encodeURIComponent(job.runId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Operator cancelled" }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; job?: GrowthAiVoiceJobView }
      if (!res.ok || !data.ok || !data.job) throw new Error(data.message ?? "Cancel failed.")
      setJob(data.job)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.")
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

        <GrowthEngineCard title="Voice settings">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Provider</Label>
              <Input value="ElevenLabs" readOnly />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Voice</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
              >
                {GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG.map((voice) => (
                  <option key={voice.voiceId} value={voice.voiceId}>
                    {voice.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Stability</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={stability}
                onChange={(e) => setStability(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Similarity</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={similarity}
                onChange={(e) => setSimilarity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Speed</Label>
              <Input
                type="number"
                min={0.5}
                max={2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </div>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Generation">
          {providerState?.dryRunOnly ? (
            <p className="mb-3 text-sm text-amber-700">
              Provider disabled — dry-run/mock audio only. Set `GROWTH_ELEVENLABS_VOICE_ENABLED=true` and
              `ELEVENLABS_API_KEY` on Vercel Production for live ElevenLabs generation.
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">ElevenLabs provider enabled for this environment.</p>
          )}
          <Button type="button" onClick={() => void runGenerate()} disabled={acting || !selectedScriptVersionId}>
            {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Generate voice
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Human review required. No sequences, outreach, or automations are triggered.
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
              {job.audioUrl ? (
                <div className="space-y-3">
                  <audio controls className="w-full" src={job.audioUrl} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={job.downloadUrl ?? job.audioUrl} download="voiceover.mp3" target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </Button>
                    {job.outputMediaAssetId ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={`/growth/media?asset=${job.outputMediaAssetId}`}>Media asset</a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No audio URL available yet.</p>
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
