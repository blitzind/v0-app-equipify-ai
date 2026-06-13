"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"
import { AidenWordmark } from "@/components/aiden/aiden-wordmark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAidenBriefing } from "@/components/growth/use-aiden-briefing"
import {
  AIDEN_ASK_ENGINE_QA_MARKER,
  AIDEN_ASK_SUGGESTED_QUESTIONS,
  answerAidenQuestion,
  type AidenAskAnswer,
} from "@/lib/growth/aiden/aiden-ask-engine"
import { cn } from "@/lib/utils"

export function AidenAskLauncher() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answers, setAnswers] = useState<AidenAskAnswer[]>([])
  const { briefing, loading } = useAidenBriefing(open)

  const ask = useCallback(
    (rawQuestion: string) => {
      const trimmed = rawQuestion.trim()
      if (!trimmed || !briefing) return
      setAnswers((prev) => [...prev, answerAidenQuestion(trimmed, briefing)])
      setQuestion("")
    },
    [briefing],
  )

  const suggested = useMemo(() => [...AIDEN_ASK_SUGGESTED_QUESTIONS], [])

  return (
    <>
      <div
        data-aiden-ask-launcher="growth-v1"
        data-screenshot-chrome="hide"
        className="pointer-events-auto fixed bottom-24 right-4 z-[95] sm:right-5 lg:bottom-6 lg:right-6"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group relative inline-flex h-12 shrink-0 items-center gap-2 rounded-full pl-3 pr-4",
            "bg-gradient-to-br from-sky-500 via-[color:var(--primary)] to-blue-700",
            "text-white shadow-lg",
            "border border-white/25",
            "ring-2 ring-sky-400/55 ring-offset-2 ring-offset-background",
            "shadow-[0_4px_22px_-4px_rgba(14,165,233,0.65),0_2px_12px_-2px_rgba(37,99,235,0.45),0_0_36px_-8px_rgba(56,189,248,0.55)]",
            "transition-all duration-200 hover:brightness-[1.06] hover:shadow-[0_6px_28px_-4px_rgba(14,165,233,0.72),0_4px_16px_-2px_rgba(37,99,235,0.5),0_0_44px_-6px_rgba(56,189,248,0.6)]",
            "active:scale-[0.97] active:brightness-[0.98]",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--primary)]",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Aiden — Your Growth Operations Coach"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/35 backdrop-blur-[2px] transition-colors group-hover:bg-white/22">
            <Sparkles className="size-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" aria-hidden strokeWidth={2} />
          </span>
          <span className="flex flex-col items-start pr-0.5 text-left leading-tight text-white drop-shadow-sm">
            <AidenWordmark size="sm" tone="inverse" className="text-[15px]" />
            <span className="text-[10px] font-normal text-white/90">Your Growth Operations Coach</span>
          </span>
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-[30rem]"
          data-aiden-ask-engine={AIDEN_ASK_ENGINE_QA_MARKER}
        >
          <SheetHeader className="border-b border-border bg-card px-4 py-4">
            <SheetTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col items-start gap-0.5">
                <AidenWordmark size="sm" />
                <span className="text-xs font-normal text-muted-foreground">Your Growth Operations Coach</span>
              </span>
            </SheetTitle>
            <SheetDescription>
              Rule-based Growth operator coach. Read-only guidance — no LLM, no sends, no approvals.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 py-4">
            {loading && !briefing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading operator context…
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {suggested.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={!briefing}
                  onClick={() => ask(item)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                ask(question)
              }}
            >
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about next steps, blockers, launch…"
                disabled={!briefing}
                aria-label="Ask Aiden a question"
              />
              <Button type="submit" size="icon" disabled={!briefing || !question.trim()} aria-label="Submit question">
                <Send className="size-4" />
              </Button>
            </form>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {answers.map((entry, index) => (
                <div key={`${entry.source}-${index}`} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{entry.question}</p>
                  <p className="mt-2 leading-relaxed">{entry.answer}</p>
                  {entry.links.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="text-xs font-medium text-indigo-600 hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
