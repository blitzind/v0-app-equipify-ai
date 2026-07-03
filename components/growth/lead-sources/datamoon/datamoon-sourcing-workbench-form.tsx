"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AVA_DATAMOON_AUDIENCE_TYPES,
  AVA_DATAMOON_COMPANY_SIZES,
  AVA_DATAMOON_INTENT_LEVELS,
  AVA_DATAMOON_JOB_TITLE_PRESETS,
  AVA_DATAMOON_LOOKBACK_DAYS,
  AVA_DATAMOON_PROVIDER_MODES,
  AVA_DATAMOON_TOPIC_PRESETS,
  type AvaDatamoonAudienceDraft,
} from "@/lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"

function toggleListValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

type Props = {
  draft: AvaDatamoonAudienceDraft
  onChange: (draft: AvaDatamoonAudienceDraft) => void
}

export function DatamoonSourcingWorkbenchForm({ draft, onChange }: Props) {
  function patch(partial: Partial<AvaDatamoonAudienceDraft>) {
    onChange({ ...draft, ...partial })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dm-audience-name">Audience name</Label>
          <Input
            id="dm-audience-name"
            value={draft.audienceName}
            onChange={(e) => patch({ audienceName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-audience-type">Audience type</Label>
          <select
            id="dm-audience-type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.audienceType}
            onChange={(e) => patch({ audienceType: e.target.value as AvaDatamoonAudienceDraft["audienceType"] })}
          >
            {AVA_DATAMOON_AUDIENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-provider-mode">Provider mode</Label>
          <select
            id="dm-provider-mode"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.providerMode}
            onChange={(e) => patch({ providerMode: e.target.value as AvaDatamoonAudienceDraft["providerMode"] })}
          >
            {AVA_DATAMOON_PROVIDER_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "module" ? "module (default)" : mode}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-record-limit">Record limit</Label>
          <Input
            id="dm-record-limit"
            inputMode="numeric"
            value={String(draft.recordLimit)}
            onChange={(e) => patch({ recordLimit: Number(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-lookback">Lookback window</Label>
          <select
            id="dm-lookback"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={String(draft.lookbackDays)}
            onChange={(e) =>
              patch({ lookbackDays: Number(e.target.value) as AvaDatamoonAudienceDraft["lookbackDays"] })
            }
          >
            {AVA_DATAMOON_LOOKBACK_DAYS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-company-size">Company size</Label>
          <select
            id="dm-company-size"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draft.companySize}
            onChange={(e) => patch({ companySize: e.target.value as AvaDatamoonAudienceDraft["companySize"] })}
          >
            {AVA_DATAMOON_COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>
                {size === "smb" ? "SMB (default)" : size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Intent levels</Label>
        <div className="flex flex-wrap gap-2">
          {AVA_DATAMOON_INTENT_LEVELS.map((level) => (
            <label key={level} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={draft.intentLevels.includes(level)}
                onChange={() => patch({ intentLevels: toggleListValue(draft.intentLevels, level) })}
              />
              {level}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="dm-country">Country</Label>
          <Input
            id="dm-country"
            value={draft.geography.country}
            onChange={(e) => patch({ geography: { ...draft.geography, country: e.target.value } })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-state">State (optional)</Label>
          <Input
            id="dm-state"
            value={draft.geography.state ?? ""}
            onChange={(e) => patch({ geography: { ...draft.geography, state: e.target.value || null } })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dm-city">City (optional)</Label>
          <Input
            id="dm-city"
            value={draft.geography.city ?? ""}
            onChange={(e) => patch({ geography: { ...draft.geography, city: e.target.value || null } })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Industries / topics</Label>
        <div className="flex flex-wrap gap-2">
          {AVA_DATAMOON_TOPIC_PRESETS.map((topic) => (
            <label key={topic} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={draft.topics.includes(topic)}
                onChange={() => patch({ topics: toggleListValue(draft.topics, topic) })}
              />
              {topic}
            </label>
          ))}
        </div>
        <Input
          placeholder="Custom topic"
          value={draft.customTopic ?? ""}
          onChange={(e) => patch({ customTopic: e.target.value || null })}
        />
      </div>

      <div className="space-y-2">
        <Label>Job titles</Label>
        <div className="flex flex-wrap gap-2">
          {AVA_DATAMOON_JOB_TITLE_PRESETS.map((title) => (
            <label key={title} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={draft.jobTitles.includes(title)}
                onChange={() => patch({ jobTitles: toggleListValue(draft.jobTitles, title) })}
              />
              {title}
            </label>
          ))}
        </div>
        <Input
          placeholder="Custom job title"
          value={draft.customJobTitle ?? ""}
          onChange={(e) => patch({ customJobTitle: e.target.value || null })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dm-revenue-range">Revenue range (optional)</Label>
        <Input
          id="dm-revenue-range"
          placeholder="e.g. $1M–$10M"
          value={draft.revenueRange ?? ""}
          onChange={(e) => patch({ revenueRange: e.target.value || null })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["includeBusinessEmail", "Include business email"],
            ["includePhone", "Include phone"],
            ["includeLinkedIn", "Include LinkedIn"],
            ["excludeDuplicates", "Exclude duplicates"],
            ["onlyNewSinceLastRefresh", "Only new records since last refresh"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={() => patch({ [key]: !draft[key] })}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}
