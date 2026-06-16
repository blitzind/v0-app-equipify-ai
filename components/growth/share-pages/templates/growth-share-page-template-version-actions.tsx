"use client"

import { Copy, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthSharePageTemplateVersion } from "@/lib/growth/share-pages/share-page-template-types"

export function GrowthSharePageTemplateVersionActions({
  version,
  isCurrent,
  busy,
  disabled,
  onRestore,
  onDuplicate,
}: {
  version: GrowthSharePageTemplateVersion
  isCurrent: boolean
  busy?: boolean
  disabled?: boolean
  onRestore: (version: GrowthSharePageTemplateVersion) => void
  onDuplicate: (version: GrowthSharePageTemplateVersion) => void
}) {
  if (isCurrent && version.status === "draft" && !version.isImmutable) {
    return <span className="text-xs text-muted-foreground">Editing current draft</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => onRestore(version)}
      >
        {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 size-3.5" />}
        Restore
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || busy}
        onClick={() => onDuplicate(version)}
      >
        <Copy className="mr-1.5 size-3.5" />
        Duplicate
      </Button>
    </div>
  )
}
