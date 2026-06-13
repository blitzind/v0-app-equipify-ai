"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Bot, Loader2, Send } from "lucide-react"
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
        className="pointer-events-auto fixed bottom-6 right-4 z-[94] sm:right-5"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex h-12 items-center gap-2 rounded-full border border-indigo-200 bg-indigo-600 px-4 text-sm font-medium text-white shadow-lg",
            "transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Ask Aiden — Growth operator guide"
        >
          <Bot className="size-4" aria-hidden />
          Ask Aiden
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md" data-aiden-ask-engine={AIDEN_ASK_ENGINE_QA_MARKER}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bot className="size-5 text-indigo-600" />
              Ask Aiden
            </SheetTitle>
            <SheetDescription>
              Rule-based Growth operator coach. Read-only guidance — no LLM, no sends, no approvals.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden">
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
