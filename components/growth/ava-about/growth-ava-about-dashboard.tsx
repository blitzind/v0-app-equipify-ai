"use client"

import Link from "next/link"
import { ArrowRight, Bot, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAiTeammateProfile } from "@/components/growth/ai-teammate/growth-ai-teammate-profile"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"
import {
  GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER,
  GROWTH_AVA_ABOUT_WORKSPACE_DESCRIPTION,
  GROWTH_AVA_ABOUT_WORKSPACE_TITLE,
  type GrowthAvaAboutCapabilityStatus,
  type GrowthAvaAboutReadModel,
} from "@/lib/growth/ava-about/growth-ava-about-workspace-types"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { cn } from "@/lib/utils"

function statusBadgeClass(status: GrowthAvaAboutCapabilityStatus): string {
  if (status === "available") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
  }
  if (status === "requires_setup") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
  }
  return "bg-muted text-muted-foreground"
}

type Props = {
  loading: boolean
  model: GrowthAvaAboutReadModel | null
  teammate: AiTeammatePresentation
}

export function GrowthAvaAboutDashboard({ loading, model, teammate }: Props) {
  if (loading || !model) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your AI teammate profile…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" data-qa-marker={GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER}>
      <section className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{GROWTH_AVA_ABOUT_WORKSPACE_TITLE}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{GROWTH_AVA_ABOUT_WORKSPACE_DESCRIPTION}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={model.trainingHref}>Training</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={model.operationsHref}>Operations</Link>
            </Button>
          </div>
        </div>
        {model.degradedMessage ? (
          <p className="mt-3 text-xs text-muted-foreground">{model.degradedMessage}</p>
        ) : null}
      </section>

      <GrowthTrainingSectionCard title="Meet Your AI" qaSection="ava-about-meet">
        <div className="space-y-4">
          <GrowthAiTeammateProfile
            teammate={teammate}
            statusLabel={model.statusLabel}
            activityLabel={model.activityLabel}
            variant="card"
          />
          <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
            {model.meetIntro.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-sm leading-relaxed text-foreground">
                {paragraph}
              </p>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={model.identitySettingsHref}>
              Customize my name
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard
        title="What I Can Do"
        description="Capabilities from your autonomy settings — not a separate system."
        qaSection="ava-about-capabilities"
      >
        <ul className="space-y-2">
          {model.capabilities.map((capability) => (
            <li
              key={capability.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{capability.label}</p>
                {capability.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{capability.description}</p>
                ) : null}
              </div>
              {capability.href ? (
                <Link
                  href={capability.href}
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide hover:underline",
                    statusBadgeClass(capability.status),
                  )}
                >
                  {capability.statusLabel}
                </Link>
              ) : (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                    statusBadgeClass(capability.status),
                  )}
                >
                  {capability.statusLabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard title="My Tools" qaSection="ava-about-tools">
        <ul className="space-y-2">
          {model.tools.map((tool) => (
            <li key={tool.id} className="rounded-lg border border-border/60 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{tool.label}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                    tool.connected
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
                  )}
                >
                  {tool.connected ? "Connected" : "Needs setup"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tool.summary}</p>
              {tool.href ? (
                <Link
                  href={tool.href}
                  className="mt-1 inline-block text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
                >
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard title="My Permissions" qaSection="ava-about-permissions">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-foreground">{model.permissions.canDo.title}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {model.permissions.canDo.items.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{model.permissions.needApproval.title}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {model.permissions.needApproval.items.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={model.autonomy.settingsHref}>Change permissions in Settings</Link>
        </Button>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard title="My Current Status" qaSection="ava-about-status">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-indigo-600" aria-hidden />
            <p className="text-sm font-medium text-foreground">{model.statusLabel}</p>
          </div>
          <p className="text-sm text-muted-foreground">I&apos;m {model.activityLabel}.</p>
          {model.currentFocus ? (
            <p className="text-sm text-foreground">
              <span className="font-medium">Current focus:</span> {model.currentFocus}
            </p>
          ) : null}
          {model.nextPlannedWork ? (
            <p className="text-sm text-foreground">
              <span className="font-medium">Next:</span> {model.nextPlannedWork}
            </p>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={model.operationsHref}>See why in Operations</Link>
          </Button>
        </div>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard title="What I'm Learning" qaSection="ava-about-learning">
        <div className="space-y-4">
          {model.learning.recentlyLearned.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-foreground">Recently learned</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {model.learning.recentlyLearned.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">I&apos;m still earning validated learnings from outcomes.</p>
          )}
          {model.learning.needsCoaching.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-foreground">I still need coaching on</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {model.learning.needsCoaching.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button asChild size="sm">
            <Link href={model.learning.trainingHref}>Continue in Training</Link>
          </Button>
        </div>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard title="Activity" qaSection="ava-about-activity">
        {model.activity.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {model.activity.map((row) => (
              <div key={row.id} className="rounded-lg border border-border/60 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{row.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Activity will appear as I work through your queue.</p>
        )}
        <Button asChild variant="link" size="sm" className="mt-2 px-0">
          <Link href={model.operationsHref}>Full breakdown in Operations</Link>
        </Button>
      </GrowthTrainingSectionCard>

      <GrowthTrainingSectionCard title="Autonomy" qaSection="ava-about-autonomy">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {model.autonomy.paused ? "Autonomy is paused" : model.autonomy.modeTitle}
          </p>
          <p className="text-sm text-muted-foreground">{model.autonomy.modeDescription}</p>
          <p className="text-sm text-muted-foreground">{model.autonomy.safetyNote}</p>
          <p className="text-sm text-foreground">
            Outbound policy: <span className="font-medium">{model.autonomy.outboundLabel}</span>
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href={model.autonomy.settingsHref}>Adjust in Settings</Link>
          </Button>
        </div>
      </GrowthTrainingSectionCard>
    </div>
  )
}
