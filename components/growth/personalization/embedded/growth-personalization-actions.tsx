"use client"

import Link from "next/link"
import { ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildGrowthPersonalizationWorkspaceHref } from "@/lib/growth/personalization/personalization-generation-ux"

type Props = {
  leadId: string
  generationId?: string | null
  generating?: boolean
  disabled?: boolean
  showGenerate?: boolean
  showRegenerate?: boolean
  showOpenWorkspace?: boolean
  showApprove?: boolean
  showEdit?: boolean
  onGenerate?: () => void
  onRegenerate?: () => void
  onApprove?: () => void
  onEdit?: () => void
  compact?: boolean
}

export function GrowthPersonalizationActions({
  leadId,
  generationId,
  generating = false,
  disabled = false,
  showGenerate = true,
  showRegenerate = true,
  showOpenWorkspace = true,
  showApprove = false,
  showEdit = false,
  onGenerate,
  onRegenerate,
  onApprove,
  onEdit,
  compact = false,
}: Props) {
  const size = compact ? "sm" : "sm"
  const buttonClass = compact ? "h-7 text-xs" : undefined

  return (
    <div className="flex flex-wrap gap-1.5" data-qa="growth-personalization-actions">
      {showGenerate ? (
        <Button
          type="button"
          size={size}
          className={buttonClass}
          disabled={disabled || generating}
          onClick={onGenerate}
        >
          {generating ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Sparkles className="mr-1 size-3" />}
          Generate
        </Button>
      ) : null}
      {showRegenerate ? (
        <Button
          type="button"
          size={size}
          variant="outline"
          className={buttonClass}
          disabled={disabled || generating || !generationId}
          onClick={onRegenerate}
        >
          <RefreshCw className="mr-1 size-3" />
          Regenerate
        </Button>
      ) : null}
      {showApprove ? (
        <Button
          type="button"
          size={size}
          className={buttonClass}
          disabled={disabled || generating || !generationId}
          onClick={onApprove}
        >
          Approve
        </Button>
      ) : null}
      {showEdit ? (
        <Button
          type="button"
          size={size}
          variant="outline"
          className={buttonClass}
          disabled={disabled || !generationId}
          onClick={onEdit}
        >
          Edit
        </Button>
      ) : null}
      {showOpenWorkspace ? (
        <Button type="button" size={size} variant="ghost" className={buttonClass} asChild>
          <Link
            href={buildGrowthPersonalizationWorkspaceHref({ leadId, generationId })}
            data-qa-action="growth-personalization-open-workspace"
          >
            <ExternalLink className="mr-1 size-3" />
            Open Workspace
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
