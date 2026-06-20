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
  audienceId: string
  onAudienceIdChange: (value: string) => void
  disabled?: boolean
}

export function GrowthSendrLaunchAudienceStep({
  summary,
  audienceId,
  onAudienceIdChange,
  disabled,
}: Props) {
  const selected = summary.audiences.find((a) => a.id === audienceId)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Choose audience</h3>
        <p className="text-sm text-muted-foreground">
          Select the audience snapshot to enroll into your sequence.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Audience</Label>
        <Select value={audienceId} onValueChange={onAudienceIdChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select audience…" />
          </SelectTrigger>
          <SelectContent>
            {summary.audiences.map((audience) => (
              <SelectItem key={audience.id} value={audience.id}>
                {audience.name}
                {audience.memberCount != null ? ` (${audience.memberCount} members)` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selected && !selected.lastSnapshotId ? (
        <p className="text-sm text-destructive">This audience needs a snapshot before launch.</p>
      ) : null}
    </div>
  )
}
