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
  sequencePatternId: string
  onSequencePatternIdChange: (value: string) => void
  disabled?: boolean
}

export function GrowthSendrLaunchSequenceStep({
  summary,
  sequencePatternId,
  onSequencePatternIdChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Choose sequence pattern</h3>
        <p className="text-sm text-muted-foreground">
          Members will be enrolled into this sequence. No steps are sent automatically.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Sequence pattern</Label>
        <Select value={sequencePatternId} onValueChange={onSequencePatternIdChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select sequence…" />
          </SelectTrigger>
          <SelectContent>
            {summary.sequencePatterns.map((pattern) => (
              <SelectItem key={pattern.id} value={pattern.id}>
                {pattern.name}
                {pattern.channelMix ? ` · ${pattern.channelMix}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
