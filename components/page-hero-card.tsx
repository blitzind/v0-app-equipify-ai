"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { PageHeroIconNamedTone, PageHeroIconTone } from "@/lib/page-hero-icon-tones"
import {
  PAGE_HERO_ICON_TONE_FRAME,
  PAGE_HERO_ICON_TONE_GLYPH,
} from "@/lib/page-hero-icon-tones"
import {
  PAGE_HERO_CARD,
  PAGE_HERO_CLUSTER,
  PAGE_HERO_ICON_FRAME,
  PAGE_HERO_ICON_GLYPH,
  PAGE_HERO_TRAILING_ROW,
  PAGE_STANDARD_PAGE_SUBTITLE,
  PAGE_STANDARD_PAGE_TITLE,
} from "@/lib/page-hero-tokens"

type Base = {
  title: string
  subtitle: string
  trailing?: ReactNode
  className?: string
}

/** Hex/rgb string + optional `default` tone — uses `color-mix` frame (not CSS `var()` colors). */
type WithIconDefault = Base & {
  icon: LucideIcon
  iconTone?: "default"
  featureColor: string
  leading?: undefined
}

/** Semantic palette — no `featureColor`; avoids `color-mix` + CSS variable bugs. */
type WithIconNamed = Base & {
  icon: LucideIcon
  iconTone: PageHeroIconNamedTone
  featureColor?: undefined
  leading?: undefined
}

type WithLeading = Base & {
  leading: ReactNode
  icon?: undefined
  featureColor?: undefined
  iconTone?: undefined
}

export type PageHeroCardProps = WithIconDefault | WithIconNamed | WithLeading

export function PageHeroIconFramed({
  icon: Icon,
  tone = "default",
  featureColor,
  className,
}: {
  icon: LucideIcon
  tone?: PageHeroIconTone
  /** Required when `tone` is `"default"`; must be a concrete color (e.g. hex), not `var(--…)`. */
  featureColor?: string
  className?: string
}) {
  if (tone !== "default") {
    const named = tone as PageHeroIconNamedTone
    return (
      <div className={cn(PAGE_HERO_ICON_FRAME, PAGE_HERO_ICON_TONE_FRAME[named], className)}>
        <Icon className={cn(PAGE_HERO_ICON_GLYPH, PAGE_HERO_ICON_TONE_GLYPH[named])} aria-hidden />
      </div>
    )
  }

  const fg = featureColor?.trim()
  if (!fg) {
    const fallback: PageHeroIconNamedTone = "slate"
    return (
      <div className={cn(PAGE_HERO_ICON_FRAME, PAGE_HERO_ICON_TONE_FRAME[fallback], className)}>
        <Icon className={cn(PAGE_HERO_ICON_GLYPH, PAGE_HERO_ICON_TONE_GLYPH[fallback])} aria-hidden />
      </div>
    )
  }

  return (
    <div
      className={cn(PAGE_HERO_ICON_FRAME, className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${fg} 14%, var(--card))`,
        borderColor: `color-mix(in srgb, ${fg} 24%, var(--border))`,
      }}
    >
      <Icon className={PAGE_HERO_ICON_GLYPH} style={{ color: fg }} aria-hidden />
    </div>
  )
}

export function PageHeroCard(props: PageHeroCardProps) {
  const { title, subtitle, trailing, className } = props
  const leading =
    "leading" in props && props.leading ? (
      props.leading
    ) : "icon" in props && props.icon ? (
      "featureColor" in props && props.featureColor ? (
        <PageHeroIconFramed icon={props.icon} tone="default" featureColor={props.featureColor} />
      ) : "iconTone" in props && props.iconTone && props.iconTone !== "default" ? (
        <PageHeroIconFramed icon={props.icon} tone={props.iconTone} />
      ) : (
        <PageHeroIconFramed icon={props.icon} tone="default" />
      )
    ) : null

  return (
    <div className={cn(PAGE_HERO_CARD, className)}>
      <div className={PAGE_HERO_CLUSTER}>
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "text-foreground")}>{title}</h1>
          <p className={PAGE_STANDARD_PAGE_SUBTITLE} title={subtitle}>
            {subtitle}
          </p>
        </div>
      </div>
      {trailing ? <div className={PAGE_HERO_TRAILING_ROW}>{trailing}</div> : null}
    </div>
  )
}

export type { PageHeroIconTone, PageHeroIconNamedTone } from "@/lib/page-hero-icon-tones"
