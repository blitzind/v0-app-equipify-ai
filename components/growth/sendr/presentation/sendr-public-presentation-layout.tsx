"use client"

import {
  CalendarDays,
  CircleHelp,
  Download,
  MessageSquareQuote,
  MousePointerClick,
  Sparkles,
} from "lucide-react"
import type { GrowthSendrPublicPagePayload } from "@/lib/growth/sendr/growth-sendr-types"
import {
  isPresentationBenefitsSection,
  parsePresentationResources,
  parsePresentationTestimonials,
} from "@/lib/growth/sendr/growth-sendr-presentation-content"
import { PresentationCtaButton } from "@/components/growth/sendr/presentation/presentation-cta-button"
import {
  PresentationDeckDivider,
  PresentationDeckGap,
  PresentationFinaleCta,
} from "@/components/growth/sendr/presentation/presentation-deck-rhythm"
import { PresentationResourceCard } from "@/components/growth/sendr/presentation/presentation-resource-card"
import { PresentationSection } from "@/components/growth/sendr/presentation/presentation-section"
import { PresentationSidebarBrand } from "@/components/growth/sendr/presentation/presentation-sidebar-brand"
import { PresentationTestimonialCard } from "@/components/growth/sendr/presentation/presentation-testimonial-card"
import {
  PresentationVideoHero,
  type PresentationVideoPlayback,
} from "@/components/growth/sendr/presentation/presentation-video-hero"
import { PresentationVideoEmptyState } from "@/components/growth/sendr/presentation/presentation-video-empty-state"
import { usePresentationTheme } from "@/components/growth/sendr/presentation/presentation-section"
import { cn } from "@/lib/utils"

type Section = GrowthSendrPublicPagePayload["sections"][number]

type TrackFn = (
  events: Array<{ eventType: string; eventValue?: Record<string, unknown> }>,
) => void

function sectionPlayback(content: Section["content"]): PresentationVideoPlayback | null {
  if (!content.videoPlayback || typeof content.videoPlayback !== "object") return null
  const playback = content.videoPlayback as Record<string, unknown>
  return {
    sourceUrl: typeof playback.sourceUrl === "string" ? playback.sourceUrl : null,
    posterUrl: typeof playback.posterUrl === "string" ? playback.posterUrl : null,
    durationSeconds: typeof playback.durationSeconds === "number" ? playback.durationSeconds : null,
    videoAssetId: typeof playback.videoAssetId === "string" ? playback.videoAssetId : null,
  }
}

function hasPlayableVideo(playback: PresentationVideoPlayback | null): boolean {
  return Boolean(playback?.sourceUrl)
}

function resolvePreparedFor(heroContent: Record<string, unknown>, personalized: boolean): string | null {
  if (typeof heroContent.personalizationLabel === "string") {
    const label = heroContent.personalizationLabel.replace(/^personalized\s+for\s+/i, "").trim()
    if (label) return label
  }
  if (typeof heroContent.companyName === "string" && heroContent.companyName.trim()) {
    return heroContent.companyName.trim()
  }
  const headline = typeof heroContent.headline === "string" ? heroContent.headline : ""
  const forMatch = headline.match(/\bfor\s+(.+?)(?:[.!?]|$)/i)
  if (forMatch?.[1]) return forMatch[1].trim()
  return personalized ? "your team" : null
}

function CtaSectionBlock({
  section,
  booking,
  onTrack,
  compact = false,
}: {
  section: Section
  booking: GrowthSendrPublicPagePayload["booking"]
  onTrack: TrackFn
  compact?: boolean
}) {
  const content = section.content
  const label =
    typeof content.label === "string"
      ? content.label
      : section.type === "calendar"
        ? "Schedule Demo"
        : "Get started"
  const href = typeof content.href === "string" ? content.href : booking?.meetingLink ?? undefined

  if (!href) {
    return (
      <PresentationSection
        title={label}
        description="This action is not linked yet."
        icon={section.type === "calendar" ? CalendarDays : MousePointerClick}
        variant="muted"
      >
        <p className="text-sm" style={{ color: "color-mix(in srgb, var(--sendr-page-text) 55%, transparent)" }}>
          Ask your rep to connect a booking or destination link.
        </p>
      </PresentationSection>
    )
  }

  if (compact) {
    return (
      <PresentationCtaButton
        href={href}
        size="large"
        fullWidth
        className="sm:w-auto"
        onClick={() => {
          const events = [{ eventType: "cta_click", eventValue: { label } }]
          if (section.type === "calendar" || booking?.meetingLink) {
            events.push({ eventType: "calendar_open" }, { eventType: "booking_started" })
          }
          onTrack(events)
        }}
      >
        {label}
      </PresentationCtaButton>
    )
  }

  return (
    <PresentationSection
      title={section.type === "calendar" ? "Schedule next steps" : "Take action"}
      description={
        section.type === "calendar" ? "Pick a time that works for your team." : "Continue when you are ready."
      }
      icon={section.type === "calendar" ? CalendarDays : MousePointerClick}
      variant="elevated"
    >
      <PresentationCtaButton
        href={href}
        size="large"
        fullWidth
        className="sm:w-auto"
        onClick={() => {
          const events = [{ eventType: "cta_click", eventValue: { label } }]
          if (section.type === "calendar" || booking?.meetingLink) {
            events.push({ eventType: "calendar_open" }, { eventType: "booking_started" })
          }
          onTrack(events)
        }}
      >
        {label}
      </PresentationCtaButton>
    </PresentationSection>
  )
}

function FaqSectionBlock({ section }: { section: Section }) {
  const items = Array.isArray(section.content.items) ? section.content.items : []
  return (
    <PresentationSection
      title={typeof section.content.headline === "string" ? section.content.headline : "Questions"}
      description="Quick answers before you book."
      icon={CircleHelp}
      variant="muted"
    >
      <div className="space-y-3">
        {items.map((item, index) => {
          const row = item as Record<string, unknown>
          return (
            <div
              key={index}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: "var(--sendr-surface)",
                borderColor: "color-mix(in srgb, var(--sendr-page-text) 12%, transparent)",
              }}
            >
              <p className="font-medium" style={{ color: "var(--sendr-page-text)" }}>
                {String(row.question ?? "")}
              </p>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "color-mix(in srgb, var(--sendr-page-text) 70%, transparent)" }}
              >
                {String(row.answer ?? "")}
              </p>
            </div>
          )
        })}
      </div>
    </PresentationSection>
  )
}

function BenefitsSectionBlock({ section }: { section: Section }) {
  const content = section.content
  const items = Array.isArray(content.items) ? content.items : []
  return (
    <PresentationSection
      title={typeof content.headline === "string" ? content.headline : "Why teams choose Equipify"}
      description={typeof content.body === "string" ? content.body : "Built for service businesses that need to scale."}
      icon={Sparkles}
      variant="default"
    >
      {items.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => {
            const row = item as Record<string, unknown>
            const label = String(row.title ?? row.label ?? row.text ?? "").trim()
            if (!label) return null
            return (
              <li
                key={index}
                className="rounded-xl border px-4 py-3 text-sm font-medium"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--sendr-page-bg) 55%, var(--sendr-surface))",
                  borderColor: "color-mix(in srgb, var(--sendr-page-text) 12%, transparent)",
                  color: "var(--sendr-page-text)",
                }}
              >
                {label}
              </li>
            )
          })}
        </ul>
      ) : typeof content.body === "string" ? (
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: "color-mix(in srgb, var(--sendr-page-text) 70%, transparent)" }}
        >
          {content.body}
        </p>
      ) : null}
    </PresentationSection>
  )
}

function TextSectionBlock({ section }: { section: Section }) {
  const content = section.content
  const testimonials = parsePresentationTestimonials(content)
  const resources = parsePresentationResources(content)

  if (testimonials.length > 0) {
    return (
      <PresentationSection
        title={typeof content.headline === "string" ? content.headline : "What customers say"}
        icon={MessageSquareQuote}
        variant="default"
        unstyled
        className="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {testimonials.map((item, index) => (
            <PresentationTestimonialCard key={index} item={item} />
          ))}
        </div>
      </PresentationSection>
    )
  }

  if (resources.length > 0) {
    return (
      <PresentationSection
        title={typeof content.headline === "string" ? content.headline : "Resources"}
        description="Download guides and explore more about Equipify."
        icon={Download}
        variant="default"
        unstyled
        className="space-y-3"
      >
        {resources.map((item, index) => (
          <PresentationResourceCard key={index} item={item} />
        ))}
      </PresentationSection>
    )
  }

  if (isPresentationBenefitsSection(content)) {
    return <BenefitsSectionBlock section={section} />
  }

  return (
    <PresentationSection
      title={typeof content.headline === "string" ? content.headline : "More information"}
      variant="muted"
    >
      {typeof content.body === "string" ? (
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: "color-mix(in srgb, var(--sendr-page-text) 70%, transparent)" }}
        >
          {content.body}
        </p>
      ) : null}
    </PresentationSection>
  )
}

function ResourcesHtmlBlock({ section }: { section: Section }) {
  const resources = parsePresentationResources(section.content)
  if (resources.length > 0) {
    return (
      <PresentationSection
        title={typeof section.content.headline === "string" ? section.content.headline : "Resources"}
        icon={Download}
        unstyled
        className="space-y-3"
      >
        {resources.map((item, index) => (
          <PresentationResourceCard key={index} item={item} />
        ))}
      </PresentationSection>
    )
  }

  return (
    <PresentationSection title="Resources" variant="muted">
      {typeof section.content.html === "string" ? (
        <div
          className="prose prose-sm max-w-none text-slate-600 dark:prose-invert dark:text-slate-300"
          dangerouslySetInnerHTML={{ __html: section.content.html }}
        />
      ) : null}
    </PresentationSection>
  )
}

export function SendrPublicPresentationLayout({
  page,
  onTrack,
  previewMode = false,
}: {
  page: GrowthSendrPublicPagePayload
  onTrack: TrackFn
  previewMode?: boolean
}) {
  const theme = usePresentationTheme()
  const personalized = page.personalization?.applied === true
  const heroSection = page.sections.find((s) => s.type === "hero")
  const videoSections = page.sections.filter((s) => s.type === "video" || s.type === "avatar_video")
  const ctaSections = page.sections.filter((s) => s.type === "cta" || s.type === "calendar")
  const textSections = page.sections.filter((s) => s.type === "text")
  const faqSections = page.sections.filter((s) => s.type === "faq")
  const customSections = page.sections.filter((s) => s.type === "custom_html")

  const heroContent = heroSection?.content ?? {}
  const preparedFor = resolvePreparedFor(heroContent, personalized)

  const primaryCtaSection = ctaSections[0] ?? null
  const primaryCtaHref =
    primaryCtaSection && typeof primaryCtaSection.content.href === "string"
      ? primaryCtaSection.content.href
      : page.booking?.meetingLink ?? null
  const primaryCtaLabel =
    primaryCtaSection && typeof primaryCtaSection.content.label === "string"
      ? primaryCtaSection.content.label
      : primaryCtaSection?.type === "calendar"
        ? "Schedule Demo"
        : "Schedule a call"

  const firstVideoSection = videoSections[0]
  const firstVideoPlayback: PresentationVideoPlayback | null =
    (firstVideoSection ? sectionPlayback(firstVideoSection.content) : null) ??
    (page.video
      ? {
          sourceUrl: page.video.sourceUrl,
          posterUrl: page.video.posterUrl,
          durationSeconds: page.video.durationSeconds,
          videoAssetId: null,
        }
      : null)

  const trackVideo = (playback: PresentationVideoPlayback) => ({
    onVideoStart: () =>
      previewMode
        ? undefined
        : onTrack([
            {
              eventType: "video_start",
              eventValue: playback.videoAssetId ? { videoAssetId: playback.videoAssetId } : undefined,
            },
          ]),
    onVideoProgress: (progressPct: number) =>
      previewMode
        ? undefined
        : onTrack([
            {
              eventType: "video_progress",
              eventValue: {
                progressPct,
                ...(playback.videoAssetId ? { videoAssetId: playback.videoAssetId } : {}),
              },
            },
          ]),
    onVideoComplete: () =>
      previewMode
        ? undefined
        : onTrack([
            {
              eventType: "video_complete",
              eventValue: playback.videoAssetId ? { videoAssetId: playback.videoAssetId } : undefined,
            },
          ]),
  })

  const benefitsSections = textSections.filter((s) => isPresentationBenefitsSection(s.content))
  const testimonialSections = textSections.filter(
    (s) => parsePresentationTestimonials(s.content).length > 0 && !isPresentationBenefitsSection(s.content),
  )
  const resourceTextSections = textSections.filter(
    (s) =>
      parsePresentationResources(s.content).length > 0 &&
      parsePresentationTestimonials(s.content).length === 0 &&
      !isPresentationBenefitsSection(s.content),
  )
  const plainTextSections = textSections.filter(
    (s) =>
      !isPresentationBenefitsSection(s.content) &&
      parsePresentationTestimonials(s.content).length === 0 &&
      parsePresentationResources(s.content).length === 0,
  )

  const secondaryCtas = ctaSections.slice(primaryCtaSection ? 1 : 0)

  return (
    <div className="grid lg:grid-cols-[38%_62%]">
      <PresentationSidebarBrand
        pageTitle={page.title}
        hero={{
          headline: typeof heroContent.headline === "string" ? heroContent.headline : page.title,
          body: typeof heroContent.body === "string" ? heroContent.body : undefined,
          personalizationLabel:
            typeof heroContent.personalizationLabel === "string" ? heroContent.personalizationLabel : undefined,
          trustLine: typeof heroContent.trustLine === "string" ? heroContent.trustLine : undefined,
        }}
        booking={page.booking}
        personalized={personalized}
        primaryCta={
          primaryCtaHref
            ? {
                label: primaryCtaLabel,
                href: primaryCtaHref,
                onClick: previewMode
                  ? undefined
                  : () => {
                      onTrack([
                        { eventType: "cta_click", eventValue: { label: primaryCtaLabel } },
                        { eventType: "booking_started" },
                      ])
                    },
              }
            : null
        }
      />

      <section
        className="flex flex-col gap-8 p-6 sm:gap-10 sm:p-8 lg:min-h-[720px] lg:p-10 xl:gap-12 xl:p-12"
        style={{ backgroundColor: "var(--sendr-page-bg)", color: "var(--sendr-page-text)" }}
      >
        {hasPlayableVideo(firstVideoPlayback) && firstVideoPlayback ? (
          <PresentationVideoHero
            title={
              firstVideoSection && typeof firstVideoSection.content.headline === "string"
                ? firstVideoSection.content.headline
                : "Your personalized walkthrough"
            }
            preparedFor={preparedFor}
            personalized={personalized}
            playback={firstVideoPlayback}
            {...trackVideo(firstVideoPlayback)}
          />
        ) : (
          <PresentationVideoEmptyState
            personalized={personalized}
            bookingHref={primaryCtaHref}
            bookingLabel={primaryCtaLabel}
            onBookingClick={
              previewMode
                ? undefined
                : () => {
                    onTrack([
                      { eventType: "cta_click", eventValue: { label: primaryCtaLabel } },
                      { eventType: "booking_started" },
                    ])
                  }
            }
          />
        )}

        {primaryCtaHref ? (
          <div className="hidden lg:block">
            <PresentationFinaleCta
              title="Ready for the next step?"
              description="Book time with our team for a live walkthrough and Q&amp;A."
            >
              <PresentationCtaButton
                href={primaryCtaHref}
                size="large"
                onClick={
                  previewMode
                    ? undefined
                    : () => {
                        onTrack([
                          { eventType: "cta_click", eventValue: { label: primaryCtaLabel } },
                          { eventType: "booking_started" },
                        ])
                      }
                }
              >
                {primaryCtaLabel}
              </PresentationCtaButton>
            </PresentationFinaleCta>
          </div>
        ) : null}

        {videoSections.slice(firstVideoSection ? 1 : 0).map((section, index) => {
          const playback = sectionPlayback(section.content)
          if (!playback || !hasPlayableVideo(playback)) return null
          return (
            <PresentationVideoHero
              key={`video-${section.sortOrder}-${index}`}
              title={typeof section.content.headline === "string" ? section.content.headline : "Watch next"}
              subtitle="Additional walkthrough for your team."
              personalized={personalized}
              playback={playback}
              {...trackVideo(playback)}
            />
          )
        })}

        {benefitsSections.length > 0 ? (
          <>
            <PresentationDeckDivider label="Benefits" />
            {benefitsSections.map((section, index) => (
              <BenefitsSectionBlock key={`benefits-${section.sortOrder}-${index}`} section={section} />
            ))}
          </>
        ) : null}

        {resourceTextSections.length > 0 || customSections.length > 0 ? (
          <>
            <PresentationDeckDivider label="Resources" />
            {resourceTextSections.map((section, index) => (
              <TextSectionBlock key={`resources-text-${section.sortOrder}-${index}`} section={section} />
            ))}
            {customSections.map((section, index) => (
              <ResourcesHtmlBlock key={`custom-${section.sortOrder}-${index}`} section={section} />
            ))}
          </>
        ) : null}

        {plainTextSections.length > 0 ? (
          <>
            {benefitsSections.length === 0 && resourceTextSections.length === 0 ? null : <PresentationDeckGap />}
            {plainTextSections.map((section, index) => (
              <TextSectionBlock key={`text-${section.sortOrder}-${index}`} section={section} />
            ))}
          </>
        ) : null}

        {faqSections.length > 0 ? (
          <>
            <PresentationDeckDivider label="FAQ" />
            {faqSections.map((section, index) => (
              <FaqSectionBlock key={`faq-${section.sortOrder}-${index}`} section={section} />
            ))}
          </>
        ) : null}

        {testimonialSections.length > 0 ? (
          <>
            <PresentationDeckDivider label="Testimonials" />
            {testimonialSections.map((section, index) => (
              <TextSectionBlock key={`testimonial-${section.sortOrder}-${index}`} section={section} />
            ))}
          </>
        ) : null}

        {secondaryCtas.length > 0 ? (
          <>
            <PresentationDeckDivider label="Next steps" />
            {secondaryCtas.map((section, index) => (
              <CtaSectionBlock
                key={`cta-${section.sortOrder}-${index}`}
                section={section}
                booking={page.booking}
                onTrack={onTrack}
              />
            ))}
          </>
        ) : null}

        {primaryCtaHref ? (
          <PresentationFinaleCta
            title="Let's talk about your operations"
            description="Schedule a demo, visit our site, or download resources — whatever works best for your team."
            className={cn(previewMode && "pointer-events-none opacity-95")}
          >
            <CtaSectionBlock
              section={
                primaryCtaSection ?? {
                  type: "calendar",
                  sortOrder: 0,
                  content: { label: primaryCtaLabel, href: primaryCtaHref },
                }
              }
              booking={page.booking}
              onTrack={onTrack}
              compact
            />
          </PresentationFinaleCta>
        ) : null}

        <footer
          className="mt-auto border-t pt-6 text-xs"
          style={{
            borderColor: "color-mix(in srgb, var(--sendr-page-text) 12%, transparent)",
            color: "color-mix(in srgb, var(--sendr-page-text) 45%, transparent)",
          }}
        >
          {theme.footerText ?? "Personalized video experience · Secure viewing"}
        </footer>
      </section>
    </div>
  )
}
