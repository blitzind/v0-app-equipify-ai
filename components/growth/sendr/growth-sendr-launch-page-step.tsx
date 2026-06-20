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
        <h3 className="text-sm font-medium">Choose published SENDR page</h3>
        <p className="text-sm text-muted-foreground">
          The page URL resolves as {"{{sendr_page_url}}"} in sequence content.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Published page</Label>
        <Select value={landingPageId} onValueChange={onLandingPageIdChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select SENDR page…" />
          </SelectTrigger>
          <SelectContent>
            {summary.publishedPages.map((page) => (
              <SelectItem key={page.id} value={page.id}>
                {page.title}
                {page.slug ? ` · /sendr/${page.slug}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {summary.publishedPages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Publish a SENDR page before launching.</p>
      ) : null}
    </div>
  )
}
