"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GrowthSendrLaunchWorkspaceSummary } from "@/lib/growth/sendr/growth-sendr-types"
import {
  GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH,
  GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN,
} from "@/lib/growth/sendr/growth-sendr-branding"

type Props = {
  summary: GrowthSendrLaunchWorkspaceSummary
  landingPageId: string
  onLandingPageIdChange: (value: string) => void
  disabled?: boolean
}

export function GrowthSendrLaunchPageStep({
  summary,
  landingPageId,
  onLandingPageIdChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Choose published {GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL.toLowerCase()}</h3>
        <p className="text-sm text-muted-foreground">
          The page URL resolves as {GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN} in sequence content.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Published page</Label>
        <Select value={landingPageId} onValueChange={onLandingPageIdChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent>
            {summary.publishedPages.map((page) => (
              <SelectItem key={page.id} value={page.id}>
                {page.title}
                {page.slug ? ` · ${GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH}/${page.slug}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {summary.publishedPages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Publish a personalized video page before launching.</p>
      ) : null}
    </div>
  )
}
