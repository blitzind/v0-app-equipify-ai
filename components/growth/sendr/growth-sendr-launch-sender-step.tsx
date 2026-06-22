"use client"

import Link from "next/link"
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
  senderAccountId: string
  onSenderAccountIdChange: (value: string) => void
  disabled?: boolean
}

export function GrowthSendrLaunchSenderStep({
  summary,
  senderAccountId,
  onSenderAccountIdChange,
  disabled,
}: Props) {
  const profiles = summary.senderProfiles ?? []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Choose sender identity</h3>
        <p className="text-sm text-muted-foreground">
          Outbound emails use this sender profile for merge fields and signatures. Configure profiles in{" "}
          <Link href="/growth/settings/signatures" className="text-indigo-600 hover:underline">
            Settings → Signatures
          </Link>
          .
        </p>
      </div>
      {profiles.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No active sender profiles yet. Create one before launch so{" "}
          <code className="text-xs">{`{{sender_name}}`}</code> and signatures render correctly.
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Sender profile</Label>
          <Select value={senderAccountId} onValueChange={onSenderAccountIdChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select sender identity…" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.senderAccountId} value={profile.senderAccountId}>
                  {profile.displayName || profile.email}
                  {profile.title ? ` · ${profile.title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
