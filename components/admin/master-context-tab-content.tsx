"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { MasterContextDocClient, type MasterContextScanCounts } from "@/app/(admin)/admin/master-context/master-context-doc-client"

type Loaded = {
  markdown: string
  generatedAtIso: string
  scanCounts: MasterContextScanCounts
}

export function MasterContextTabContent() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    void (async () => {
      try {
        const [{ getEquipifyMasterContext, MASTER_CONTEXT_LAST_UPDATED_ISO }, { MCG_SCAN_COUNTS }] = await Promise.all([
          import("@/lib/admin/master-context"),
          import("@/lib/admin/master-context.generated"),
        ])
        if (canceled) return
        setLoaded({
          markdown: getEquipifyMasterContext(),
          generatedAtIso: MASTER_CONTEXT_LAST_UPDATED_ISO,
          scanCounts: MCG_SCAN_COUNTS,
        })
      } catch {
        if (!canceled) setError("Could not load Master Context.")
      }
    })()
    return () => {
      canceled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Master Context…
      </div>
    )
  }

  return (
    <MasterContextDocClient
      embedded
      initialMarkdown={loaded.markdown}
      generatedAtIso={loaded.generatedAtIso}
      scanCounts={loaded.scanCounts}
    />
  )
}
