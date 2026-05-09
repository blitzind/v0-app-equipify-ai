"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AlertCircle, Bot, Clock3, Loader2, Send, User } from "lucide-react"
import { AidenWordmark } from "@/components/aiden/aiden-wordmark"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { moduleFromPath } from "@/lib/aiden/module-context"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { AidenChatMessage } from "@/lib/aiden/aiden-response-rules"
import type { AidenSupportPhase1Answer } from "@/lib/aiden/aiden-support-phase1-schema"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  answer?: AidenSupportPhase1Answer
  createdAt: Date
}

type AidenChatPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function answerToContent(answer: AidenSupportPhase1Answer): string {
  const sections = [answer.answer]
  if (answer.steps.length > 0) sections.push(answer.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"))
  if (answer.permissionNote) sections.push(`Permission note: ${answer.permissionNote}`)
  if (answer.limitation) sections.push(`Note: ${answer.limitation}`)
  return sections.join("\n\n")
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((part, idx) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={`${part}-${idx}`} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        ),
      )}
    </>
  )
}

function MarkdownMessage({ text }: { text: string }) {
  const blocks = text.split(/```/g)
  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        const isCode = idx % 2 === 1
        if (isCode) {
          return (
            <pre key={`${block}-${idx}`} className="overflow-x-auto rounded-lg bg-slate-950 p-2 text-xs text-slate-100">
              <code>{block.trim()}</code>
            </pre>
          )
        }
        return block
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .map((line, lineIdx) => (
            <p key={`${line}-${idx}-${lineIdx}`} className="whitespace-pre-wrap">
              <InlineMarkdown text={line} />
            </p>
          ))
      })}
    </div>
  )
}

export function AidenChatPanel({ open, onOpenChange }: AidenChatPanelProps) {
  const pathname = usePathname()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()
  const currentModule = useMemo(() => moduleFromPath(pathname), [pathname])
  const quickPrompts = useMemo(() => currentModule.quickPrompts.slice(0, 4), [currentModule])

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi — I'm AIden, here to help you use Equipify. Ask how to create work orders, manage certificates, billing, the portal, equipment, or anything in the app. I explain steps — I can't perform actions for you.",
      createdAt: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    const content = text.trim()
    if (!content || loading) return
    if (!organizationId || orgStatus !== "ready") {
      setError("Choose a workspace first — AIden needs an active organization.")
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setError(null)
    setLoading(true)

    try {
      const apiMessages: AidenChatMessage[] = nextMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          currentPath: pathname,
          currentModule: currentModule.label,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        answer?: AidenSupportPhase1Answer
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.answer) {
        throw new Error(data.message ?? data.error ?? "AIden could not answer right now.")
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answerToContent(data.answer!),
          answer: data.answer,
          createdAt: new Date(),
        },
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AIden could not answer right now."
      setError(msg)
      toast({ title: "AIden unavailable", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage(input)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-400">
              <Bot size={16} aria-hidden />
            </span>
            <div>
              <SheetTitle className="flex items-center gap-1.5 text-left">
                Ask <AidenWordmark size="md" />
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground text-left">
                Help for <strong>{currentModule.label}</strong> — you&apos;re on{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{pathname || "/"}</code>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/30 to-background px-4 py-4"
        >
          {messages.length <= 1 ? (
            <div className="mb-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-foreground">
              <p className="font-medium">
                Context: <span className="text-muted-foreground">{currentModule.label}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                I only answer how to use Equipify — not general chat. Try a suggested prompt below or ask your own
                question.
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role === "assistant" ? (
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Bot size={13} aria-hidden />
                  </span>
                ) : null}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-xs",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground",
                  )}
                >
                  <MarkdownMessage text={message.answer?.answer ?? message.content} />
                  {message.answer?.steps.length ? (
                    <ol className="mt-2 space-y-1">
                      {message.answer.steps.map((step, idx) => (
                        <li key={`${step}-${idx}`} className="rounded-lg bg-secondary/40 px-2 py-1 text-xs">
                          <span className="font-semibold">Step {idx + 1}: </span>
                          {step.replace(/^step\s+\d+[:.)-]?\s*/i, "")}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {message.answer?.relatedRoutes.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.answer.relatedRoutes.map((route) => (
                        <span
                          key={route}
                          className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {route}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.answer?.permissionNote ? (
                    <p className="mt-2 text-xs text-muted-foreground">{message.answer.permissionNote}</p>
                  ) : null}
                  {message.answer?.limitation ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{message.answer.limitation}</p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock3 size={10} aria-hidden />
                    {formatTime(message.createdAt)}
                  </div>
                </div>
                {message.role === "user" ? (
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <User size={13} aria-hidden />
                  </span>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-xs">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                <AidenWordmark size="sm" /> is thinking…
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
          {messages.length <= 1 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {quickPrompts.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-900 hover:bg-sky-500/15 dark:text-sky-100"
                  onClick={() => void sendMessage(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          ) : null}
          {error ? (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage(input)
                }
              }}
              placeholder={`Ask about ${currentModule.label.toLowerCase()}…`}
              className="max-h-32 min-h-10 resize-none text-sm"
              disabled={loading}
              aria-label="Message to AIden"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} aria-label="Send message">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
