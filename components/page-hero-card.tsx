"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
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

type WithIcon = Base & {
  icon: LucideIcon
  featureColor: string
  leading?: undefined
}

type WithLeading = Base & {
  leading: ReactNode
  icon?: undefined
  featureColor?: undefined
}

export type PageHeroCardProps = WithIcon | WithLeading

export function PageHeroIconFramed({
  icon: Icon,
  featureColor,
  className,
}: {
  icon: LucideIcon
  featureColor: string
  className?: string
}) {
  return (
    <div
      className={cn(PAGE_HERO_ICON_FRAME, className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${featureColor} 14%, var(--card))`,
        borderColor: `color-mix(in srgb, ${featureColor} 24%, var(--border))`,
      }}
    >
      <Icon className={PAGE_HERO_ICON_GLYPH} style={{ color: featureColor }} aria-hidden />
    </div>
  )
}

export function PageHeroCard(props: PageHeroCardProps) {
  const { title, subtitle, trailing, className } = props
  const leading =
    "leading" in props && props.leading ? (
      props.leading
    ) : "icon" in props && props.icon ? (
      <PageHeroIconFramed icon={props.icon} featureColor={props.featureColor} />
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
