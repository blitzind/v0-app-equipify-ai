"use client"

import { Info } from "lucide-react"
import { INTENT_SIGNAL_PREVIEW_BANNER } from "@/components/growth/intent-signals/intent-signals-ux-constants"

export function IntentSignalsPreviewBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">Preview:</span> {INTENT_SIGNAL_PREVIEW_BANNER.replace(/^Preview:\s*/, "")}
      </p>
    </div>
  )
}
