/** GE-AI-UX-1A — Human-readable event translations (client-safe). */
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { completedWorkUpdated } from "@/lib/workspace/ai-teammate-voice"

const EXACT_TRANSLATIONS: Record<string, string> = {
  "Growth Communication Plan Generated": "AI prepared a communication strategy.",
  "Growth Revenue Director Snapshot Generated": "Revenue Director reviewed the current pipeline.",
  "Growth Meta Recommender Snapshot Generated": "AI ranked the next best actions.",
  "Growth Priority Binding Snapshot Generated": "AI reprioritized active objectives.",
  "Growth Human Approval Center Snapshot Generated": "Completed work updated.",
  "Growth Bounded Autonomous Outbound Snapshot Generated": "Autonomous outbound scopes reviewed.",
  "Growth Closed Loop Learning Snapshot Generated": "AI analyzed recent outcomes.",
  "Growth Adaptive Calibration Snapshot Generated": "Learning insights reviewed for calibration.",
  "Research completed": "Research completed.",
  "Qualification score increased": "Qualification score increased.",
  "Outreach draft created": "Outreach draft created.",
  "Waiting for approval": "Waiting for your approval.",
}

const PATTERN_TRANSLATIONS: Array<{ pattern: RegExp; template: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /research.*completed.*for\s+(.+)/i,
    template: (m) => `Research completed for ${m[1]?.trim() ?? "a prospect"}.`,
  },
  {
    pattern: /qualification.*(?:score|updated)/i,
    template: () => "Qualification score updated.",
  },
  {
    pattern: /outreach.*draft/i,
    template: () => "Outreach draft created.",
  },
  {
    pattern: /approval.*(?:required|waiting|pending)/i,
    template: () => "Waiting for your approval.",
  },
  {
    pattern: /communication.*plan/i,
    template: () => "AI prepared a communication strategy.",
  },
  {
    pattern: /revenue.*director/i,
    template: () => "Revenue Director reviewed the current pipeline.",
  },
  {
    pattern: /dispatch.*(?:recorded|completed|correlated)/i,
    template: () => "Workflow dispatch completed.",
  },
  {
    pattern: /meeting.*brief/i,
    template: () => "Meeting brief prepared.",
  },
  {
    pattern: /learning.*(?:insight|cycle)/i,
    template: () => "AI learned from recent outcomes.",
  },
  {
    pattern: /calibration.*(?:proposal|approved|applied)/i,
    template: () => "Calibration proposal updated.",
  },
  {
    pattern: /autonomous.*scope/i,
    template: () => "Autonomous outbound scope updated.",
  },
  {
    pattern: /work_order\.(?:created|status_changed)/i,
    template: () => "AI work order progressed.",
  },
  {
    pattern: /agent\.(?:heartbeat|lease_claimed)/i,
    template: () => "An AI agent is actively working.",
  },
]

function humanizeToken(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function translateOperatorActivityHeadline(input: {
  title: string
  summary?: string | null
  eventType?: string | null
  teammateName?: string | null
}): { headline: string; rawTitle: string } {
  const title = input.title.trim()
  const summary = input.summary?.trim() ?? ""
  const eventType = input.eventType?.trim() ?? ""

  if (title === "Growth Human Approval Center Snapshot Generated") {
    return { headline: completedWorkUpdated(resolveAiTeammatePresentation(input.teammateName)), rawTitle: title }
  }
  if (EXACT_TRANSLATIONS[title]) {
    return { headline: EXACT_TRANSLATIONS[title], rawTitle: title }
  }

  const combined = `${title} ${summary} ${eventType}`.trim()
  for (const row of PATTERN_TRANSLATIONS) {
    const match = combined.match(row.pattern)
    if (match) {
      return { headline: row.template(match), rawTitle: title || eventType || null }
    }
  }

  if (summary.length > 0 && summary.length <= 120 && !summary.includes("_")) {
    return { headline: summary.endsWith(".") ? summary : `${summary}.`, rawTitle: title || null }
  }

  if (title.length > 0) {
    const normalized = humanizeToken(title)
    if (!normalized.includes("Snapshot Generated") && !normalized.includes("qa marker")) {
      return {
        headline: normalized.endsWith(".") ? normalized : `${normalized}.`,
        rawTitle: title,
      }
    }
  }

  if (eventType.length > 0) {
    const fromEvent = humanizeToken(eventType.replace(/\./g, " "))
    return { headline: `${fromEvent}.`, rawTitle: eventType }
  }

  return { headline: "AI activity recorded.", rawTitle: title || null }
}

export function formatOperatorTimelineTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
