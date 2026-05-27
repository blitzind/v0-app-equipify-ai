"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { IntentSignalsSetupDrawer } from "@/components/growth/intent-signals/intent-signals-setup-drawer"
import { IntentSignalsShell } from "@/components/growth/intent-signals/intent-signals-shell"
import type { IntentSignalTabId } from "@/components/growth/intent-signals/intent-signals-ux-constants"
import {
  GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER,
  type GrowthIntentPixelAdminDiagnostics,
  type GrowthIntentPixelAdminSite,
  type GrowthIntentPixelAdminStreamEvent,
  type GrowthIntentPixelProcessRecentResult,
  type GrowthIntentPixelTrackingMode,
} from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import type { GrowthLiveVisitorMonitorSnapshot } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import { buildIntentPixelScriptSnippet } from "@/lib/growth/intent-pixel/intent-pixel-site-config"

export function GrowthIntentPixelAdmin({
  setupDrawerOpen,
  onSetupDrawerOpenChange,
}: {
  setupDrawerOpen: boolean
  onSetupDrawerOpenChange: (open: boolean) => void
}) {
  const [sites, setSites] = useState<GrowthIntentPixelAdminSite[]>([])
  const [selectedKey, setSelectedKey] = useState<string>("equipify-sandbox")
  const [diagnostics, setDiagnostics] = useState<GrowthIntentPixelAdminDiagnostics | null>(null)
  const [events, setEvents] = useState<GrowthIntentPixelAdminStreamEvent[]>([])
  const [snapshot, setSnapshot] = useState<GrowthLiveVisitorMonitorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null)
  const [processingIntent, setProcessingIntent] = useState(false)
  const [lastHandoff, setLastHandoff] = useState<GrowthIntentPixelProcessRecentResult | null>(null)
  const [activeTab, setActiveTab] = useState<IntentSignalTabId>("website-visitors")

  const [siteName, setSiteName] = useState("")
  const [domainsText, setDomainsText] = useState("")
  const [trackingMode, setTrackingMode] = useState<GrowthIntentPixelTrackingMode>("consent_gated")
  const [newSiteKey, setNewSiteKey] = useState("")

  const selected = useMemo(
    () => sites.find((s) => s.site_key === selectedKey) ?? null,
    [sites, selectedKey],
  )

  const scriptSnippet = useMemo(() => {
    if (selected?.script_snippet) return selected.script_snippet
    if (typeof window !== "undefined" && selectedKey) {
      return buildIntentPixelScriptSnippet(window.location.origin, selectedKey).script_snippet
    }
    return ""
  }, [selected, selectedKey])

  const schemaReadyResolved = diagnostics?.schema_ready ?? schemaReady ?? false

  const loadMonitor = useCallback(async (siteKey: string, ready: boolean) => {
    if (!ready) {
      setSnapshot(null)
      return
    }
    setMonitorLoading(true)
    try {
      const res = await fetch(
        `/api/platform/growth/intent-pixel/monitor?site_key=${encodeURIComponent(siteKey)}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        snapshot?: GrowthLiveVisitorMonitorSnapshot
      }
      if (res.ok && data.ok && data.snapshot) setSnapshot(data.snapshot)
    } finally {
      setMonitorLoading(false)
    }
  }, [])

  const loadAll = useCallback(
    async (siteKey: string) => {
      setLoading(true)
      try {
        const [sitesRes, diagRes, eventsRes] = await Promise.all([
          fetch("/api/platform/growth/intent-pixel/sites", { cache: "no-store" }),
          fetch(
            `/api/platform/growth/intent-pixel/diagnostics?site_key=${encodeURIComponent(siteKey)}`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/platform/growth/intent-pixel/events/recent?site_key=${encodeURIComponent(siteKey)}&limit=50`,
            { cache: "no-store" },
          ),
        ])

        const sitesData = (await sitesRes.json().catch(() => ({}))) as {
          ok?: boolean
          schema_ready?: boolean
          sites?: GrowthIntentPixelAdminSite[]
        }
        if (sitesRes.ok && sitesData.ok) {
          if (typeof sitesData.schema_ready === "boolean") setSchemaReady(sitesData.schema_ready)
          setSites(sitesData.sites ?? [])
          if ((sitesData.sites ?? []).length > 0 && !sitesData.sites?.some((s) => s.site_key === siteKey)) {
            setSelectedKey(sitesData.sites![0]!.site_key)
          }
        }

        const diagData = (await diagRes.json().catch(() => ({}))) as {
          ok?: boolean
          diagnostics?: GrowthIntentPixelAdminDiagnostics
        }
        const nextDiagnostics = diagRes.ok && diagData.ok ? (diagData.diagnostics ?? null) : null
        if (diagRes.ok && diagData.ok) setDiagnostics(nextDiagnostics)

        const eventsData = (await eventsRes.json().catch(() => ({}))) as {
          ok?: boolean
          stream?: { events?: GrowthIntentPixelAdminStreamEvent[] }
        }
        if (eventsRes.ok && eventsData.ok) setEvents(eventsData.stream?.events ?? [])

        const ready = nextDiagnostics?.schema_ready ?? sitesData.schema_ready ?? false
        await loadMonitor(siteKey, ready)
      } finally {
        setLoading(false)
      }
    },
    [loadMonitor],
  )

  useEffect(() => {
    void loadAll(selectedKey)
  }, [selectedKey, loadAll])

  useEffect(() => {
    if (!schemaReadyResolved) return
    const timer = window.setInterval(() => {
      void loadAll(selectedKey)
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [schemaReadyResolved, selectedKey, loadAll])

  useEffect(() => {
    if (!schemaReadyResolved) return
    const timer = window.setInterval(() => {
      void loadMonitor(selectedKey, schemaReadyResolved)
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [schemaReadyResolved, selectedKey, loadMonitor])

  useEffect(() => {
    if (!selected) return
    setSiteName(selected.site_name)
    setDomainsText(selected.domain_allowlist.join("\n"))
    setTrackingMode(selected.tracking_mode)
  }, [selected])

  async function saveSite() {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/platform/growth/intent-pixel/sites/${encodeURIComponent(selected.site_key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_name: siteName,
            domain_allowlist: domainsText.split(/[\n,]+/).map((d) => d.trim()).filter(Boolean),
            tracking_mode: trackingMode,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        setMessage(data.message ?? "Could not save site.")
        return
      }
      setMessage("Site settings saved.")
      await loadAll(selected.site_key)
    } finally {
      setSaving(false)
    }
  }

  async function createSite() {
    const key = newSiteKey.trim().toLowerCase()
    if (!key) {
      setMessage("Enter a site key for the new site.")
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/intent-pixel/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_key: key,
          site_name: siteName || key,
          domain_allowlist: domainsText.split(/[\n,]+/).map((d) => d.trim()).filter(Boolean),
          tracking_mode: trackingMode,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        site?: GrowthIntentPixelAdminSite
      }
      if (!res.ok || !data.ok) {
        setMessage(data.message ?? "Could not create site.")
        return
      }
      setMessage("Site created.")
      setNewSiteKey("")
      if (data.site) setSelectedKey(data.site.site_key)
      await loadAll(data.site?.site_key ?? key)
    } finally {
      setSaving(false)
    }
  }

  async function copySnippet() {
    if (!scriptSnippet) return
    await navigator.clipboard.writeText(scriptSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function processRecentIntent() {
    setProcessingIntent(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/intent-pixel/process-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_key: selectedKey, limit: 25 }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: GrowthIntentPixelProcessRecentResult
        message?: string
      }
      if (!res.ok || !data.result) {
        setMessage(data.message ?? "Could not process recent intent.")
        return
      }
      setLastHandoff(data.result)
      setMessage(
        `Processed ${data.result.bridged_count} session(s): ${data.result.ingested_count} added to Lead Inbox, ${data.result.duplicate_count} duplicate(s), ${data.result.skipped_count} skipped.`,
      )
      await loadAll(selectedKey)
    } finally {
      setProcessingIntent(false)
    }
  }

  return (
    <div className="flex flex-col gap-6" data-qa-marker={GROWTH_INTENT_PIXEL_ADMIN_QA_MARKER}>
      <IntentSignalsShell
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        siteKey={selectedKey}
        schemaReady={schemaReadyResolved}
        diagnostics={diagnostics}
        snapshot={snapshot}
        monitorLoading={monitorLoading}
        onOpenSetupDrawer={() => onSetupDrawerOpenChange(true)}
        onProcessRecentIntent={() => void processRecentIntent()}
        processingIntent={processingIntent}
        lastHandoff={lastHandoff}
        onMonitorRefresh={() => void loadMonitor(selectedKey, schemaReadyResolved)}
      />

      <IntentSignalsSetupDrawer
        open={setupDrawerOpen}
        onOpenChange={onSetupDrawerOpenChange}
        sites={sites}
        selectedKey={selectedKey}
        onSelectedKeyChange={setSelectedKey}
        selected={selected}
        siteName={siteName}
        onSiteNameChange={setSiteName}
        domainsText={domainsText}
        onDomainsTextChange={setDomainsText}
        trackingMode={trackingMode}
        onTrackingModeChange={setTrackingMode}
        newSiteKey={newSiteKey}
        onNewSiteKeyChange={setNewSiteKey}
        scriptSnippet={scriptSnippet}
        diagnostics={diagnostics}
        events={events}
        installVerification={snapshot?.install_verification ?? null}
        schemaReadyResolved={schemaReadyResolved}
        loading={loading}
        saving={saving}
        copied={copied}
        message={message}
        onRefresh={() => void loadAll(selectedKey)}
        onSaveSite={() => void saveSite()}
        onCreateSite={() => void createSite()}
        onCopySnippet={() => void copySnippet()}
      />
    </div>
  )
}
