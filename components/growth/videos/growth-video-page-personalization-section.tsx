"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import type { GrowthVideoAiPayload, GrowthVideoPage } from "@/lib/growth/videos/growth-video-types"

type PersonalizationState = {
  registryVariables: Array<{ key: string; label: string; namespace: string }>
  legacyAliases: Array<{ alias: string; canonicalKey: string }>
  resolvedValues: Record<string, string>
  aliases: Record<string, string>
  missingVariables: string[]
  sourcesUsed: string[]
  renderedPreview: Record<string, string | null>
  aiPayload: GrowthVideoAiPayload | null
  metadataHooks: Record<string, string | null | undefined>
  rawPersonalization: GrowthVideoPage["personalization"]
}

const DEFAULT_SAMPLE =
  "Hi {{first_name}},\n\nI noticed {{company}} operates in {{industry}}..."

export function GrowthVideoPagePersonalizationSection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<PersonalizationState | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE)
  const [renderedSample, setRenderedSample] = useState<string | null>(null)

  const [firstName, setFirstName] = useState("John")
  const [lastName, setLastName] = useState("Smith")
  const [company, setCompany] = useState("Precision Biomedical")
  const [title, setTitle] = useState("Director of Operations")
  const [industry, setIndustry] = useState("Medical Equipment")
  const [city, setCity] = useState("Boston")
  const [stateValue, setStateValue] = useState("MA")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/personalization`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        registry_variables?: PersonalizationState["registryVariables"]
        legacy_aliases?: PersonalizationState["legacyAliases"]
        resolved_values?: Record<string, string>
        aliases?: Record<string, string>
        missing_variables?: string[]
        sources_used?: string[]
        rendered_preview?: Record<string, string | null>
        ai_payload?: GrowthVideoAiPayload
        metadata_hooks?: Record<string, string | null | undefined>
        personalization?: GrowthVideoPage["personalization"]
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load personalization.")
      setState({
        registryVariables: data.registry_variables ?? [],
        legacyAliases: data.legacy_aliases ?? [],
        resolvedValues: data.resolved_values ?? {},
        aliases: data.aliases ?? {},
        missingVariables: data.missing_variables ?? [],
        sourcesUsed: data.sources_used ?? [],
        renderedPreview: data.rendered_preview ?? {},
        aiPayload: data.ai_payload ?? null,
        metadataHooks: data.metadata_hooks ?? {},
        rawPersonalization: data.personalization ?? {},
      })
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
    setPreviewing(true)
    try {
      const res = await fetch("/api/growth/videos/personalization/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          sample_text: sampleText,
          preview_form: {
            first_name: firstName,
            last_name: lastName,
            company,
            title,
            industry,
            city,
            state: stateValue,
          },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        rendered_sample_text?: string | null
        rendered_preview?: Record<string, string | null>
        ai_payload?: GrowthVideoAiPayload
        variables?: Record<string, string>
        aliases?: Record<string, string>
        missing?: string[]
        sources_used?: string[]
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Preview failed.")
      setRenderedSample(data.rendered_sample_text ?? null)
      setState((prev) =>
        prev
          ? {
              ...prev,
              resolvedValues: data.variables ?? prev.resolvedValues,
              aliases: data.aliases ?? prev.aliases,
              missingVariables: data.missing ?? prev.missingVariables,
              sourcesUsed: data.sources_used ?? prev.sourcesUsed,
              renderedPreview: data.rendered_preview ?? prev.renderedPreview,
              aiPayload: data.ai_payload ?? prev.aiPayload,
            }
          : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <GrowthEnginePanelResilience loading={loading} error={error} onRetry={() => void load()}>
      {state ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Preview form</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={stateValue} onChange={(e) => setStateValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sample text</Label>
              <Textarea value={sampleText} onChange={(e) => setSampleText(e.target.value)} rows={4} />
            </div>
            <Button type="button" onClick={() => void runPreview()} disabled={previewing}>
              {previewing ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Render preview
            </Button>
            {renderedSample ? (
              <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{renderedSample}</pre>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium">Variables (registry)</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {state.registryVariables.map((entry) => (
                <li key={entry.key}>
                  <code>{`{{${entry.key}}}`}</code> — {entry.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium">Aliases</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {state.legacyAliases.map((entry) => (
                <li key={entry.alias}>
                  <code>{`{{${entry.alias}}}`}</code> → <code>{entry.canonicalKey}</code>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium">Resolved values</h3>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify(state.resolvedValues, null, 2)}
            </pre>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium">Missing variables</h3>
            {state.missingVariables.length ? (
              <p className="text-sm text-amber-700">{state.missingVariables.join(", ")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">None detected for current context.</p>
            )}
            <p className="text-xs text-muted-foreground">Sources: {state.sourcesUsed.join(", ") || "—"}</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium">Raw JSON</h3>
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify(state.rawPersonalization, null, 2)}
            </pre>
            <pre className="max-h-32 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify(state.metadataHooks, null, 2)}
            </pre>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-sm font-medium">Rendered preview</h3>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify(state.renderedPreview, null, 2)}
            </pre>
          </section>

          {state.aiPayload ? (
            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-sm font-medium">AI payload (metadata only)</h3>
              <p className="text-xs text-muted-foreground">
                Personalization score: {state.aiPayload.personalization_score}
              </p>
              <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
                {JSON.stringify(state.aiPayload, null, 2)}
              </pre>
            </section>
          ) : null}
        </div>
      ) : null}
    </GrowthEnginePanelResilience>
  )
}
