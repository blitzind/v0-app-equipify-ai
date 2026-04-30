"use client"

/**
 * Equipify AI Component Library
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable AI-branded UI primitives built on top of the Equipify design system.
 * All accent colours come exclusively from the primary brand blue (--primary /
 * --ds-info-* tokens) — no purple or external palette colours are used.
 *
 * Exported components:
 *   AIBadge              — small "AI" label chip used inline next to text
 *   AIActionButton       — call-to-action button that triggers an AI operation
 *   AISummaryCard        — standalone card showing an AI-generated text summary
 *   AIRecommendationPanel — ordered list of AI recommendations with accept/dismiss
 *   AIDrawerSection      — drop-in drawer section for AI context inside DetailDrawer
 */

import { useState } from "react"
import {
  Sparkles,
  Wand2,
  ChevronRight,
  CheckCircle2,
  X,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Shared style constants ────────────────────────────────────────────────────

/** Base tint using the design system info/primary blue tokens */
const AI_BG     = "bg-[color:var(--ds-info-bg)]"
const AI_BORDER = "border-[color:var(--ds-info-border)]"
const AI_TEXT   = "text-[color:var(--ds-info-text)]"
const AI_SUBTLE = "text-[color:var(--ds-info-subtle)]"
const AI_ICON   = "text-[color:var(--ds-info-subtle)]"

// ─────────────────────────────────────────────────────────────────────────────
// 1. AI Badge
// ─────────────────────────────────────────────────────────────────────────────

export interface AIBadgeProps {
  /** Label text. Defaults to "AI" */
  label?: string
  /** Compact mode: no text, icon only */
  iconOnly?: boolean
  /** Size scale */
  size?: "xs" | "sm" | "md"
  className?: string
}

/**
 * AIBadge
 *
 * A small inline chip used to mark AI-generated content or AI-powered features.
 * Drop it next to a column heading, section title, or inside a card header.
 *
 * @example
 * <AIBadge />
 * <AIBadge label="AI Summary" size="sm" />
 * <AIBadge iconOnly />
 */
export function AIBadge({ label = "AI", iconOnly = false, size = "xs", className }: AIBadgeProps) {
  const sizeMap = {
    xs: { wrap: "gap-0.5 px-1.5 py-0.5 text-[10px]", icon: "w-2.5 h-2.5" },
    sm: { wrap: "gap-1   px-2   py-0.5 text-xs",      icon: "w-3   h-3"   },
    md: { wrap: "gap-1   px-2.5 py-1   text-xs",      icon: "w-3.5 h-3.5" },
  }

  const s = sizeMap[size]

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border select-none",
        AI_BG, AI_BORDER, AI_TEXT,
        s.wrap,
        className,
      )}
      aria-label={iconOnly ? `${label} powered` : undefined}
    >
      <Sparkles className={cn(s.icon, AI_ICON)} aria-hidden="true" />
      {!iconOnly && <span>{label}</span>}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AI Action Button
// ─────────────────────────────────────────────────────────────────────────────

export type AIActionButtonVariant = "default" | "outline" | "ghost"

export interface AIActionButtonProps {
  label: string
  onClick?: () => void | Promise<void>
  /** Shows a spinning indicator while true */
  loading?: boolean
  /** Locks the button after a successful action */
  done?: boolean
  doneLabel?: string
  variant?: AIActionButtonVariant
  size?: "sm" | "md"
  disabled?: boolean
  className?: string
  icon?: React.ReactNode
}

/**
 * AIActionButton
 *
 * A clearly-branded button for triggering AI operations (generate summary,
 * auto-schedule, suggest priority, etc.). Handles loading + done states.
 *
 * @example
 * <AIActionButton label="Generate Summary" onClick={handleGenerate} loading={isLoading} />
 * <AIActionButton label="Auto-Schedule" variant="outline" done={done} doneLabel="Scheduled" />
 */
export function AIActionButton({
  label,
  onClick,
  loading = false,
  done = false,
  doneLabel = "Done",
  variant = "default",
  size = "sm",
  disabled = false,
  className,
  icon,
}: AIActionButtonProps) {
  const isDisabled = disabled || loading || done

  const baseSize = size === "md"
    ? "h-9 px-4 text-sm gap-2"
    : "h-8 px-3 text-xs gap-1.5"

  const iconSize = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"

  const variantMap: Record<AIActionButtonVariant, string> = {
    default: cn(
      "bg-[color:var(--ds-info-subtle)] text-white border-transparent",
      "hover:opacity-90 active:opacity-100",
    ),
    outline: cn(
      "bg-[color:var(--ds-info-bg)] border border-[color:var(--ds-info-border)]",
      AI_TEXT,
      "hover:bg-[color:var(--ds-info-border)]/40",
    ),
    ghost: cn(
      "bg-transparent border-transparent",
      AI_TEXT,
      "hover:bg-[color:var(--ds-info-bg)]",
    ),
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center font-medium rounded-lg border transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        baseSize,
        variantMap[variant],
        className,
      )}
      aria-busy={loading}
    >
      {done ? (
        <CheckCircle2 className={cn(iconSize, "shrink-0")} aria-hidden="true" />
      ) : loading ? (
        <RefreshCw className={cn(iconSize, "shrink-0 animate-spin")} aria-hidden="true" />
      ) : icon ? (
        <span className={cn(iconSize, "shrink-0")} aria-hidden="true">{icon}</span>
      ) : (
        <Sparkles className={cn(iconSize, "shrink-0")} aria-hidden="true" />
      )}
      <span>{done ? doneLabel : loading ? "Working…" : label}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI Summary Card
// ─────────────────────────────────────────────────────────────────────────────

export interface AISummaryCardProps {
  /** Main summary text (supports multi-paragraph via newlines) */
  summary: string
  /** Optional shorter heading above the text */
  title?: string
  /** Timestamp or model info shown in the footer */
  meta?: string
  /** Fired when user clicks "Regenerate" */
  onRegenerate?: () => void
  /** Fired when user thumbs up */
  onThumbsUp?: () => void
  /** Fired when user thumbs down */
  onThumbsDown?: () => void
  /** Replace body with a skeleton if true */
  loading?: boolean
  className?: string
}

/**
 * AISummaryCard
 *
 * A standalone card rendering an AI-generated text summary with regenerate
 * and feedback controls. Displays a skeleton shimmer while loading.
 *
 * @example
 * <AISummaryCard
 *   title="Equipment Health Summary"
 *   summary="The HVAC unit at Site A is due for a filter replacement within 14 days."
 *   meta="Generated just now"
 *   onRegenerate={handleRegen}
 * />
 */
export function AISummaryCard({
  summary,
  title,
  meta,
  onRegenerate,
  onThumbsUp,
  onThumbsDown,
  loading = false,
  className,
}: AISummaryCardProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)

  const paragraphs = summary.split("\n").filter(Boolean)

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-3",
        AI_BG, AI_BORDER,
        className,
      )}
      role="region"
      aria-label={title ?? "AI Summary"}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          </div>
          <span className={cn("text-xs font-semibold", AI_TEXT)}>
            {title ?? "AI Summary"}
          </span>
        </div>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-1",
              "border border-[color:var(--ds-info-border)] bg-white/60",
              AI_TEXT,
              "hover:bg-white transition-colors disabled:opacity-50",
            )}
            aria-label="Regenerate AI summary"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} aria-hidden="true" />
            Regenerate
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2" aria-label="Loading AI summary">
          <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
          <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
          <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-4/6" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {paragraphs.map((p, i) => (
            <p key={i} className={cn("text-xs leading-relaxed", AI_TEXT)}>
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Footer */}
      {(meta || onThumbsUp || onThumbsDown) && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[color:var(--ds-info-border)]">
          {meta && (
            <span className="text-[10px] text-[color:var(--ds-info-text)] opacity-60">{meta}</span>
          )}
          {(onThumbsUp || onThumbsDown) && (
            <div className="flex items-center gap-1 ml-auto" role="group" aria-label="Rate this summary">
              <button
                type="button"
                onClick={() => { setFeedback("up"); onThumbsUp?.() }}
                aria-pressed={feedback === "up"}
                aria-label="Helpful"
                className={cn(
                  "p-1 rounded transition-colors",
                  feedback === "up"
                    ? "text-[color:var(--ds-info-subtle)]"
                    : "text-[color:var(--ds-info-text)] opacity-50 hover:opacity-100",
                )}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => { setFeedback("down"); onThumbsDown?.() }}
                aria-pressed={feedback === "down"}
                aria-label="Not helpful"
                className={cn(
                  "p-1 rounded transition-colors",
                  feedback === "down"
                    ? "text-[color:var(--ds-info-subtle)]"
                    : "text-[color:var(--ds-info-text)] opacity-50 hover:opacity-100",
                )}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AI Recommendation Panel
// ─────────────────────────────────────────────────────────────────────────────

export type AIRecommendationSeverity = "info" | "warning" | "critical"

export interface AIRecommendation {
  id: string
  title: string
  description?: string
  severity?: AIRecommendationSeverity
  /** e.g. "Due in 14 days", "3 open work orders" */
  meta?: string
  actionLabel?: string
  onAction?: () => void
}

export interface AIRecommendationPanelProps {
  recommendations: AIRecommendation[]
  title?: string
  /** Maximum number of items to show before collapsing. Default: 3 */
  initialLimit?: number
  onDismiss?: (id: string) => void
  loading?: boolean
  className?: string
}

const SEVERITY_ICON: Record<AIRecommendationSeverity, React.ReactNode> = {
  info:     <Lightbulb className="w-3.5 h-3.5 text-[color:var(--ds-info-subtle)]"    aria-hidden="true" />,
  warning:  <AlertCircle className="w-3.5 h-3.5 text-[color:var(--ds-warning-subtle)]" aria-hidden="true" />,
  critical: <TrendingUp  className="w-3.5 h-3.5 text-[color:var(--ds-danger-subtle)]"  aria-hidden="true" />,
}

const SEVERITY_BORDER: Record<AIRecommendationSeverity, string> = {
  info:     "border-l-[color:var(--ds-info-subtle)]",
  warning:  "border-l-[color:var(--ds-warning-subtle)]",
  critical: "border-l-[color:var(--ds-danger-subtle)]",
}

/**
 * AIRecommendationPanel
 *
 * A vertical list of AI-generated recommendations, each with severity,
 * description, an optional CTA, and a dismiss control.
 * Shows the first `initialLimit` items with a "Show more" toggle.
 *
 * @example
 * <AIRecommendationPanel
 *   title="AI Recommendations"
 *   recommendations={[
 *     { id: "1", title: "Replace filter on Unit A", severity: "warning", meta: "Due in 7 days", actionLabel: "Create Work Order" },
 *     { id: "2", title: "Calibrate sensor on Chiller B", severity: "info" },
 *   ]}
 *   onDismiss={(id) => handleDismiss(id)}
 * />
 */
export function AIRecommendationPanel({
  recommendations,
  title = "AI Recommendations",
  initialLimit = 3,
  onDismiss,
  loading = false,
  className,
}: AIRecommendationPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = recommendations.filter((r) => !dismissed.has(r.id))
  const shown = expanded ? visible : visible.slice(0, initialLimit)
  const hiddenCount = visible.length - initialLimit

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]))
    onDismiss?.(id)
  }

  return (
    <div
      className={cn("rounded-xl border overflow-hidden", AI_BG, AI_BORDER, className)}
      role="region"
      aria-label={title}
    >
      {/* Panel header */}
      <div className={cn("flex items-center justify-between gap-2 px-4 py-3 border-b", AI_BORDER)}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3 text-white" aria-hidden="true" />
          </div>
          <span className={cn("text-xs font-semibold", AI_TEXT)}>{title}</span>
          {!loading && visible.length > 0 && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              AI_BG, AI_BORDER, AI_TEXT, "border",
            )}>
              {visible.length}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-[color:var(--ds-info-border)]">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-3/4" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-1/2" />
            </div>
          ))
        ) : visible.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <CheckCircle2 className={cn("w-6 h-6 mx-auto mb-2 opacity-60", AI_ICON)} />
            <p className={cn("text-xs font-medium", AI_TEXT)}>No recommendations</p>
            <p className={cn("text-[10px] mt-0.5 opacity-60", AI_TEXT)}>All systems are on track.</p>
          </div>
        ) : (
          shown.map((rec) => (
            <div
              key={rec.id}
              className={cn(
                "flex gap-3 px-4 py-3 border-l-2",
                SEVERITY_BORDER[rec.severity ?? "info"],
              )}
            >
              {/* Severity icon */}
              <div className="shrink-0 pt-0.5">
                {SEVERITY_ICON[rec.severity ?? "info"]}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-xs font-medium leading-snug", AI_TEXT)}>{rec.title}</p>
                  {onDismiss && (
                    <button
                      type="button"
                      onClick={() => handleDismiss(rec.id)}
                      aria-label={`Dismiss: ${rec.title}`}
                      className={cn(
                        "shrink-0 p-0.5 rounded opacity-40 hover:opacity-80 transition-opacity",
                        AI_TEXT,
                      )}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {rec.description && (
                  <p className={cn("text-[10px] leading-relaxed opacity-75", AI_TEXT)}>
                    {rec.description}
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap pt-0.5">
                  {rec.meta && (
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium opacity-60", AI_TEXT)}>
                      <Clock className="w-2.5 h-2.5" aria-hidden="true" />
                      {rec.meta}
                    </span>
                  )}
                  {rec.actionLabel && rec.onAction && (
                    <button
                      type="button"
                      onClick={rec.onAction}
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                        "underline underline-offset-2 hover:no-underline transition-all",
                        AI_TEXT,
                      )}
                    >
                      {rec.actionLabel}
                      <ChevronRight className="w-2.5 h-2.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Show more / less toggle */}
      {!loading && hiddenCount > 0 && (
        <div className={cn("border-t px-4 py-2", AI_BORDER)}>
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className={cn(
              "text-[10px] font-semibold w-full text-center",
              AI_TEXT,
              "hover:underline transition-all",
            )}
          >
            {expanded ? "Show less" : `Show ${hiddenCount} more recommendation${hiddenCount > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AI Drawer Section
// ─────────────────────────────────────────────────────────────────────────────

export interface AIDrawerSectionProps {
  /** Section heading */
  title?: string
  /** AI-generated text body */
  content: string
  /** Additional structured insights shown below the main text */
  insights?: { label: string; value: string }[]
  /** Shown in section footer */
  meta?: string
  onRegenerate?: () => void
  loading?: boolean
  /** Collapsed by default — user expands on demand */
  defaultCollapsed?: boolean
  className?: string
}

/**
 * AIDrawerSection
 *
 * A collapsible AI-branded section designed to slot directly inside a
 * DetailDrawer body (between DrawerSection components). Renders an AI-
 * generated text summary and optional key insight rows.
 *
 * @example
 * // Inside a DetailDrawer body:
 * <AIDrawerSection
 *   title="AI Analysis"
 *   content="This equipment has had 4 work orders in the last 90 days, suggesting an elevated failure rate."
 *   insights={[
 *     { label: "Risk level", value: "Moderate" },
 *     { label: "Suggested action", value: "Schedule inspection" },
 *   ]}
 *   meta="Updated just now"
 *   onRegenerate={handleRegen}
 * />
 */
export function AIDrawerSection({
  title = "AI Analysis",
  content,
  insights,
  meta,
  onRegenerate,
  loading = false,
  defaultCollapsed = false,
  className,
}: AIDrawerSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const paragraphs = content.split("\n").filter(Boolean)

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        AI_BG, AI_BORDER,
        className,
      )}
      role="region"
      aria-label={title}
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-3 text-left",
          "hover:bg-[color:var(--ds-info-border)]/20 transition-colors",
        )}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
            <Wand2 className="w-2.5 h-2.5 text-white" aria-hidden="true" />
          </div>
          <span className={cn("text-xs font-semibold", AI_TEXT)}>{title}</span>
          <AIBadge size="xs" />
        </div>
        <ChevronRight
          className={cn("w-3.5 h-3.5 transition-transform", AI_SUBTLE, !collapsed && "rotate-90")}
          aria-hidden="true"
        />
      </button>

      {/* Expandable body */}
      {!collapsed && (
        <div className={cn("border-t px-4 py-3 space-y-3", AI_BORDER)}>
          {/* Text body */}
          {loading ? (
            <div className="space-y-2" aria-label="Loading AI analysis">
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-4/6" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {paragraphs.map((p, i) => (
                <p key={i} className={cn("text-xs leading-relaxed", AI_TEXT)}>
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* Insight rows */}
          {!loading && insights && insights.length > 0 && (
            <div className={cn("rounded-lg border divide-y overflow-hidden", AI_BORDER)}>
              {insights.map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-3 py-2">
                  <span className={cn("text-[10px] font-medium opacity-70", AI_TEXT)}>
                    {row.label}
                  </span>
                  <span className={cn("text-[10px] font-semibold text-right", AI_TEXT)}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {(meta || onRegenerate) && (
            <div className={cn("flex items-center justify-between gap-2 pt-1 border-t", AI_BORDER)}>
              {meta && (
                <span className={cn("text-[10px] opacity-50", AI_TEXT)}>{meta}</span>
              )}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={loading}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-semibold ml-auto",
                    AI_TEXT,
                    "hover:underline disabled:opacity-40 transition-all",
                  )}
                  aria-label="Regenerate AI analysis"
                >
                  <RefreshCw className={cn("w-2.5 h-2.5", loading && "animate-spin")} />
                  Regenerate
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
