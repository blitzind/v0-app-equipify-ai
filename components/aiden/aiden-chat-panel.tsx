"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AlertCircle, Bot, CheckCircle2, Clock3, ExternalLink, Loader2, Send, User, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { buildClientAidenContext } from "@/lib/aiden/context-builders"
import { moduleFromPath } from "@/lib/aiden/module-context"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { AidenAnswer, AidenChatMessage } from "@/lib/aiden/aiden-response-rules"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  answer?: AidenAnswer
  createdAt: Date
}

type AidenChatPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function answerToContent(answer: AidenAnswer): string {
  const sections = [answer.answer]
  if (answer.steps.length > 0) sections.push(answer.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"))
  if (answer.permissionNote) sections.push(`Permission note: ${answer.permissionNote}`)
  if (answer.limitation) sections.push(`Limitation: ${answer.limitation}`)
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
  const { organizationId, organizationName, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const { toast } = useToast()
  const currentModule = useMemo(() => moduleFromPath(pathname), [pathname])
  const quickPrompts = useMemo(() => currentModule.quickPrompts.slice(0, 4), [currentModule])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I'm AIden. Ask me how to do something in Equipify and I'll walk you through it step by step.",
      createdAt: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittingFeatureRequestId, setSubmittingFeatureRequestId] = useState<string | null>(null)
  const [submittedFeatureRequests, setSubmittedFeatureRequests] = useState<Record<string, string>>({})
  const [executingActionId, setExecutingActionId] = useState<string | null>(null)
  const [completedActions, setCompletedActions] = useState<Record<string, { message: string; href?: string }>>({})
  const [canceledActions, setCanceledActions] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    const content = text.trim()
    if (!content || loading) return
    if (!organizationId || orgStatus !== "ready") {
      setError("AIden needs an active workspace before it can answer.")
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
      const search = typeof window !== "undefined" ? window.location.search : ""
      const pageContext = buildClientAidenContext({
        pathname,
        search,
        organizationId,
        organizationName,
        permissions,
      })

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          currentPath: pathname,
          currentModule: currentModule.label,
          pageContext,
          stream: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        answer?: AidenAnswer
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
      setError(e instanceof Error ? e.message : "AIden could not answer right now.")
    } finally {
      setLoading(false)
    }
  }

  async function submitFeatureRequest(message: ChatMessage) {
    const draft = message.answer?.featureRequestDraft
    if (!draft || !organizationId || submittingFeatureRequestId) return

    setSubmittingFeatureRequestId(message.id)
    setError(null)
    try {
      const chatContext: AidenChatMessage[] = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/feature-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          currentPath: pathname,
          module: currentModule.label,
          chatContext,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        requestId?: string
        duplicate?: boolean
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.requestId) {
        throw new Error(data.message ?? data.error ?? "Could not submit this feature request.")
      }
      setSubmittedFeatureRequests((prev) => ({ ...prev, [message.id]: data.requestId! }))
      toast({
        title: "Feature request sent",
        description: data.duplicate
          ? "Thanks, this was already captured and helps us prioritize what to improve."
          : "Feature request sent. Thanks, this helps us prioritize what to improve.",
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit this feature request.")
    } finally {
      setSubmittingFeatureRequestId(null)
    }
  }

  async function executeAidenAction(message: ChatMessage) {
    const proposedAction = message.answer?.proposedAction
    if (!proposedAction || !organizationId || executingActionId) return

    setExecutingActionId(message.id)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedAction, confirmed: true }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: { message?: string; href?: string }
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "AIden could not complete this action.")
      }
      setCompletedActions((prev) => ({
        ...prev,
        [message.id]: {
          message: data.result?.message ?? "AIden action completed.",
          href: data.result?.href,
        },
      }))
      toast({
        title: "AIden action completed",
        description: data.result?.message ?? "The confirmed action was completed.",
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "AIden could not complete this action.")
    } finally {
      setExecutingActionId(null)
    }
  }

  async function cancelAidenAction(message: ChatMessage) {
    const proposedAction = message.answer?.proposedAction
    setCanceledActions((prev) => ({ ...prev, [message.id]: true }))
    if (!proposedAction || !organizationId) return
    await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/actions/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposedAction, confirmed: false }),
    }).catch(() => undefined)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage(input)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b border-slate-800 bg-slate-950 px-4 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-sky-400/15 text-sky-300 ring-1 ring-sky-300/25">
              <Bot size={16} />
            </span>
            <div>
              <SheetTitle>Ask AIden</SheetTitle>
              <SheetDescription className="text-xs text-slate-300">
                Contextual help for {currentModule.label.toLowerCase()} workflows.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-background px-4 py-4 dark:from-slate-950/40">
          {messages.length <= 1 ? (
            <div className="mb-4 rounded-2xl border border-sky-200/70 bg-sky-50 p-3 text-sm text-slate-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-slate-200">
              <p className="font-medium text-slate-900 dark:text-white">I can use this page as context.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask about {currentModule.label.toLowerCase()}, permissions, record workflows, or operational goals.
              </p>
            </div>
          ) : null}
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.role === "assistant" ? (
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sky-600 dark:text-sky-300">
                    <Bot size={13} />
                  </span>
                ) : null}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-xs",
                    message.role === "user"
                      ? "bg-[#f59f1c] text-slate-950"
                      : "border border-border bg-card text-foreground",
                  )}
                >
                  <MarkdownMessage text={message.answer?.answer ?? message.content} />
                  {message.answer?.steps.length ? (
                    <ol className="mt-2 space-y-1">
                      {message.answer.steps.map((step, idx) => (
                        <li key={step} className="rounded-lg bg-secondary/40 px-2 py-1 text-xs">
                          <span className="font-semibold">Step {idx + 1}: </span>
                          {step.replace(/^step\s+\d+[:.)-]?\s*/i, "")}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {message.answer?.actions.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.answer.actions.map((action) => (
                        <Button key={`${action.label}-${action.href}`} asChild size="sm" className="h-7 bg-[#f59f1c] px-2 text-xs text-slate-950 hover:bg-[#e89113]">
                          <Link href={action.href} onClick={() => onOpenChange(false)}>
                            {action.label}
                            <ExternalLink className="ml-1 size-3" />
                          </Link>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {message.answer?.proposedAction ? (
                    <div className="mt-3 rounded-xl border border-sky-200 bg-white p-3 text-xs text-slate-700 shadow-xs dark:border-sky-900 dark:bg-slate-950 dark:text-slate-200">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950">
                          <Bot size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {message.answer.proposedAction.title}
                          </p>
                          <p className="mt-1 text-muted-foreground">{message.answer.proposedAction.summary}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg bg-muted/40 p-2">
                        <p className="mb-1 font-medium">Preview</p>
                        <dl className="grid gap-1">
                          {Object.entries(message.answer.proposedAction.previewData).slice(0, 8).map(([key, value]) => (
                            <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
                              <dt className="truncate text-muted-foreground">{key}</dt>
                              <dd className="truncate font-medium">
                                {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                                  ? String(value)
                                  : JSON.stringify(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      {completedActions[message.id] ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                          <p className="flex items-center gap-1 font-medium">
                            <CheckCircle2 className="size-3.5" />
                            {completedActions[message.id].message}
                          </p>
                          {completedActions[message.id].href ? (
                            <Link href={completedActions[message.id].href!} className="mt-1 inline-flex items-center gap-1 underline" onClick={() => onOpenChange(false)}>
                              Open result <ExternalLink className="size-3" />
                            </Link>
                          ) : null}
                        </div>
                      ) : canceledActions[message.id] ? (
                        <p className="mt-3 flex items-center gap-1 text-muted-foreground">
                          <XCircle className="size-3.5" />
                          Action canceled.
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-[#f59f1c] px-2 text-xs text-slate-950 hover:bg-[#e89113]"
                            disabled={executingActionId === message.id}
                            onClick={() => void executeAidenAction(message)}
                          >
                            {executingActionId === message.id ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                            Confirm & Create
                          </Button>
                          <button
                            type="button"
                            className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary"
                            onClick={() => setInput(`Edit this action: ${message.answer?.proposedAction?.summary ?? ""}`)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary"
                            onClick={() => void cancelAidenAction(message)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {message.answer?.relatedRoutes.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.answer.relatedRoutes.map((route) => (
                        <span key={route} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                          {route}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.answer?.permissionNote ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {message.answer.permissionNote}
                    </p>
                  ) : null}
                  {message.answer?.limitation ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      {message.answer.limitation}
                    </p>
                  ) : null}
                  {message.answer?.classification === "not_built_feature_candidate" &&
                  message.answer.featureRequestDraft ? (
                    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-xs text-slate-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-slate-200">
                      {submittedFeatureRequests[message.id] ? (
                        <p className="font-medium text-sky-800 dark:text-sky-200">
                          Feature request sent. Thanks, this helps us prioritize what to improve.
                        </p>
                      ) : (
                        <>
                          <p className="font-medium text-slate-900 dark:text-white">
                            Want us to consider adding this?
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            I can send this as a feature request for review.
                          </p>
                          <div className="mt-2 rounded-lg bg-white/70 p-2 dark:bg-slate-950/50">
                            <p className="font-medium">{message.answer.featureRequestDraft.title}</p>
                            {message.answer.featureRequestDraft.currentLimitation ? (
                              <p className="mt-1 text-muted-foreground">
                                {message.answer.featureRequestDraft.currentLimitation}
                              </p>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 bg-[#f59f1c] px-2 text-xs text-slate-950 hover:bg-[#e89113]"
                              disabled={submittingFeatureRequestId === message.id}
                              onClick={() => void submitFeatureRequest(message)}
                            >
                              {submittingFeatureRequestId === message.id ? (
                                <Loader2 className="mr-1 size-3 animate-spin" />
                              ) : null}
                              Submit Feature Request
                            </Button>
                            <button
                              type="button"
                              className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary"
                              onClick={() => setInput(message.answer?.featureRequestDraft?.suggestedImprovement ?? "")}
                            >
                              Edit request
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock3 size={10} />
                    {formatTime(message.createdAt)}
                  </div>
                </div>
                {message.role === "user" ? (
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <User size={13} />
                  </span>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-2 text-xs text-muted-foreground shadow-xs dark:border-sky-900 dark:bg-slate-950/80">
                <Loader2 size={14} className="animate-spin" />
                AIden is reading this page context...
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
                  className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200"
                  onClick={() => void sendMessage(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          ) : null}
          {error ? (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
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
              placeholder={`Ask about ${currentModule.label.toLowerCase()}...`}
              className="max-h-32 min-h-10 resize-none text-sm"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
