"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type {
  GrowthVideoScriptAiPayload,
  GrowthVideoScriptB4Metadata,
  GrowthVideoScriptGeneratedOutput,
  GrowthVideoScriptGenerationInput,
  GrowthVideoScriptPreviewContext,
  GrowthVideoScriptTone,
  GrowthVideoScriptVersion,
} from "@/lib/growth/videos/growth-video-types"

const TONES: Array<{ value: GrowthVideoScriptTone; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "direct", label: "Direct" },
  { value: "consultative", label: "Consultative" },
]

export function GrowthVideoPageScriptSection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [metadata, setMetadata] = useState<GrowthVideoScriptB4Metadata | null>(null)
  const [currentVersion, setCurrentVersion] = useState<GrowthVideoScriptVersion | null>(null)
  const [generatedScript, setGeneratedScript] = useState<GrowthVideoScriptGeneratedOutput | null>(null)
  const [previewContext, setPreviewContext] = useState<GrowthVideoScriptPreviewContext | null>(null)
  const [aiPayload, setAiPayload] = useState<GrowthVideoScriptAiPayload | null>(null)
  const [provider, setProvider] = useState<string | null>(null)

  const [goal, setGoal] = useState("Book demo")
  const [targetPersona, setTargetPersona] = useState("HVAC owner")
  const [painPoint, setPainPoint] = useState("missed jobs and manual follow-up")
  const [offer, setOffer] = useState("Equipify")
  const [cta, setCta] = useState("Schedule a demo")
  const [tone, setTone] = useState<GrowthVideoScriptTone>("professional")
  const [lengthSeconds, setLengthSeconds] = useState(45)

  const generationInput = (): GrowthVideoScriptGenerationInput => ({
    videoPageId: pageId,
    goal,
    targetPersona,
    painPoint,
    offer,
    cta,
    tone,
    lengthSeconds,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/scripts`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        metadata?: GrowthVideoScriptB4Metadata
        current_version?: GrowthVideoScriptVersion | null
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load scripts.")
      setMetadata(data.metadata ?? null)
      setCurrentVersion(data.current_version ?? null)
      if (data.current_version?.output) {
        setGeneratedScript(data.current_version.output)
      }
      if (data.metadata?.aiPayload) {
        setAiPayload(data.metadata.aiPayload)
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

  async function runPreview() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/videos/scripts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_page_id: pageId,
          goal,
          target_persona: targetPersona,
          pain_point: painPoint,
          offer,
          cta,
          tone,
          length_seconds: lengthSeconds,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        preview_context?: GrowthVideoScriptPreviewContext
        fallback_script?: GrowthVideoScriptGeneratedOutput
        ai_payload?: GrowthVideoScriptAiPayload
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Preview failed.")
      setPreviewContext(data.preview_context ?? null)
      setGeneratedScript(data.fallback_script ?? null)
      setAiPayload(data.ai_payload ?? null)
      setProvider("deterministic_fallback")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setActing(false)
    }
  }

  async function runGenerate() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/videos/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_page_id: pageId,
          goal,
          target_persona: targetPersona,
          pain_point: painPoint,
          offer,
          cta,
          tone,
          length_seconds: lengthSeconds,
          persist: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        generated_script?: GrowthVideoScriptGeneratedOutput
        ai_payload?: GrowthVideoScriptAiPayload
        provider?: string
        metadata?: GrowthVideoScriptB4Metadata
        version?: GrowthVideoScriptVersion | null
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Generation failed.")
      setGeneratedScript(data.generated_script ?? null)
      setAiPayload(data.ai_payload ?? null)
      setProvider(data.provider ?? null)
      setMetadata(data.metadata ?? null)
      setCurrentVersion(data.version ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.")
    } finally {
      setActing(false)
    }
  }

  async function selectVersion(versionId: string) {
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/scripts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_version_id: versionId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        metadata?: GrowthVideoScriptB4Metadata
        current_version?: GrowthVideoScriptVersion | null
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not select version.")
      setMetadata(data.metadata ?? null)
      setCurrentVersion(data.current_version ?? null)
      setGeneratedScript(data.current_version?.output ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Version select failed.")
    } finally {
      setActing(false)
    }
  }

  const script = generatedScript ?? currentVersion?.output ?? null

  return (
    <GrowthEnginePanelResilience loading={loading} error={error}>
      <div className="space-y-4">
        <GrowthEngineCard title="Script generation inputs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Goal</Label>
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Target persona</Label>
              <Input value={targetPersona} onChange={(e) => setTargetPersona(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Pain point</Label>
              <Textarea value={painPoint} onChange={(e) => setPainPoint(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Offer</Label>
              <Input value={offer} onChange={(e) => setOffer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CTA</Label>
              <Input value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value as GrowthVideoScriptTone)}
              >
                {TONES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Length (seconds)</Label>
              <Input
                type="number"
                min={15}
                max={120}
                value={lengthSeconds}
                onChange={(e) => setLengthSeconds(Number(e.target.value) || 45)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={acting}>
              Preview context
            </Button>
            <Button type="button" onClick={() => void runGenerate()} disabled={acting}>
              {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Generate script
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Human review required. No sequences, automations, or outbound sends are triggered.
          </p>
        </GrowthEngineCard>

        {previewContext ? (
          <GrowthEngineCard title="Preview prompt / context">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {previewContext.promptPreview}
            </pre>
          </GrowthEngineCard>
        ) : null}

        {script ? (
          <>
            <GrowthEngineCard title="Script output">
              {provider ? (
                <p className="mb-2 text-xs text-muted-foreground">Provider: {provider}</p>
              ) : null}
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Hook</p>
                  <p className="text-muted-foreground">{script.hook}</p>
                </div>
                <div>
                  <p className="font-medium">Script</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{script.script}</p>
                </div>
                <div>
                  <p className="font-medium">Talking points</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {script.talking_points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">CTA copy</p>
                  <p className="text-muted-foreground">{script.cta_copy}</p>
                </div>
                <div>
                  <p className="font-medium">Landing page copy</p>
                  <p className="font-medium text-foreground">{script.landing_page_title}</p>
                  <p className="text-muted-foreground">{script.landing_page_description}</p>
                </div>
                <div>
                  <p className="font-medium">Follow-up email</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{script.follow_up_email}</p>
                </div>
                <div>
                  <p className="font-medium">Follow-up SMS</p>
                  <p className="text-muted-foreground">{script.follow_up_sms}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="font-medium">Recommended thumbnail text</p>
                    <p className="text-muted-foreground">{script.recommended_thumbnail_text}</p>
                  </div>
                  <div>
                    <p className="font-medium">Recommended overlay text</p>
                    <p className="text-muted-foreground">{script.recommended_overlay_text}</p>
                  </div>
                </div>
              </div>
            </GrowthEngineCard>
          </>
        ) : null}

        {metadata?.versions?.length ? (
          <GrowthEngineCard title="Version history">
            <div className="space-y-2">
              {metadata.versions.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{new Date(version.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {version.provider}
                      {version.model ? ` · ${version.model}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={metadata.current_version_id === version.id ? "default" : "outline"}
                    onClick={() => void selectVersion(version.id)}
                    disabled={acting}
                  >
                    {metadata.current_version_id === version.id ? "Current" : "Select"}
                  </Button>
                </div>
              ))}
            </div>
          </GrowthEngineCard>
        ) : null}

        {aiPayload ? (
          <GrowthEngineCard title="AI payload">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(aiPayload, null, 2)}
            </pre>
          </GrowthEngineCard>
        ) : null}

        <GrowthEngineCard title="Raw JSON">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(
              {
                generation_input: generationInput(),
                metadata,
                current_version: currentVersion,
                generated_script: script,
              },
              null,
              2,
            )}
          </pre>
        </GrowthEngineCard>
      </div>
    </GrowthEnginePanelResilience>
  )
}
