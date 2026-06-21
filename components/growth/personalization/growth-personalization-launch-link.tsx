"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildGrowthPersonalizationWorkspaceHref } from "@/lib/growth/personalization/personalization-generation-ux"

export function GrowthPersonalizationLaunchLink({
  leadId,
  generationId,
  label = "Generate personalization",
  variant = "outline",
  size = "sm",
  className,
}: {
  leadId?: string | null
  generationId?: string | null
  label?: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Button type="button" variant={variant} size={size} className={className} asChild>
      <Link
        href={buildGrowthPersonalizationWorkspaceHref({ leadId, generationId })}
        data-qa-action="growth-personalization-launch"
      >
        <Sparkles className="mr-1 size-3.5" />
        {label}
      </Link>
    </Button>
  )
}
