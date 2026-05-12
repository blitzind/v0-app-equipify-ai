"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Bot, ClipboardList, Clock3, Loader2, MessageSquarePlus, Send, User } from "lucide-react"
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
import { AidenFeatureRequestFlow, type AidenFrFormValues } from "@/components/aiden/aiden-feature-request-flow"
import { PreparedActionCard } from "@/components/aiden/prepared-actions/PreparedActionCard"
import type { SerializedPreparedAction } from "@/components/aiden/prepared-actions/types"
import {
  aidenCapabilityBadgeLabel,
  buildAidenIdlePanelHint,
  buildAidenPreparedWorkspaceTierChatPrefix,
  buildAidenWelcomeContent,
  PREPARED_WORKSPACE_ACTION_INTRO,
  resolveAidenCapabilityBadge,
  type AidenEligibilityForMessaging,
} from "@/lib/aiden/aiden-capability-messaging"
import { buildWorkspacePrepareContext } from "@/lib/aiden/aiden-workspace-page-context"
import { moduleFromPath, type AidenModuleId } from "@/lib/aiden/module-context"
import {
  clearAidenChatSession,
  loadAidenChatSession,
  messagesFromPayload,
  serializeAidenChatSession,
} from "@/lib/aiden/aiden-chat-session-storage"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { SAFE_ACTIONS_SCALE_ONLY_MESSAGE } from "@/lib/aiden/safe-actions/messages"
import type { AidenChatMessage, AidenFeatureRequestDraft } from "@/lib/aiden/aiden-response-rules"
import type { AidenSupportPhase2Answer } from "@/lib/aiden/aiden-support-phase2-schema"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  answer?: AidenSupportPhase2Answer
  /** Inline prepared workspace action (billing) after successful prepare. */
  preparedAction?: SerializedPreparedAction
  /** Prepare endpoint failed; user can retry the same utterance. */
  prepareFailure?: boolean
  retryUserText?: string
  createdAt: Date
}

function createWelcomeMessage(moduleId: AidenModuleId, eligibility: AidenEligibilityForMessaging | null): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: buildAidenWelcomeContent({ moduleId, eligibility }),
    createdAt: new Date(),
  }
}

type AidenChatPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PendingSafeActionPreview = {
  id: string
  title: string
  explanation: string
  action_type: string
  risk_level: string
  expires_at: string
  proposed_payload: Record<string, unknown>
  affected_record_ids: unknown
}

const TRIAL_ACTION_PREVIEW_ID = "00000000-0000-4000-8000-000000000001"

function defaultFrValues(moduleLabel: string): AidenFrFormValues {
  return {
    title: "",
    description: "",
    moduleContext: moduleLabel,
    priority: "medium",
    userNotes: "",
  }
}

function draftToFrValues(draft: AidenFeatureRequestDraft, moduleLabel: string): AidenFrFormValues {
  return {
    title: draft.title,
    description: [draft.originalQuestion, draft.suggestedImprovement].filter(Boolean).join("\n\n"),
    moduleContext: draft.module?.trim() || moduleLabel,
    priority: "medium",
    userNotes: draft.businessValue?.trim() ?? "",
  }
}

function answerToContent(answer: AidenSupportPhase2Answer): string {
  const sections = [answer.answer]
  if (answer.steps.length > 0) sections.push(answer.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"))
  if (answer.permissionNote) sections.push(`Permission note: ${answer.permissionNote}`)
  if (answer.limitation) sections.push(`Note: ${answer.limitation}`)
  return sections.join("\n\n")
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/** Short outcome copy for the pending-action preview (Phase 7 clarity). */
function safeActionOutcomeHint(actionType: string): string {
  switch (actionType) {
    case "create_follow_up_task":
      return "Creates a follow-up task in your queue. Nothing is emailed, invoiced, or sent to the customer automatically."
    case "schedule_maintenance_visit":
      return "Creates a scheduled work order for the visit. Customer email is not sent automatically from this step."
    case "create_maintenance_plan_from_equipment":
      return "Creates a recurring maintenance plan on the asset. Confirming inserts the plan; auto work orders follow your plan settings."
    case "create_parts_reorder_request":
      return "Creates an internal draft PO or inventory restock signals from the preview. Purchase orders are not emailed or transmitted to vendors from this step."
    case "create_internal_note":
      return "Appends an internal note or staff-visible timeline entry only—no email or SMS."
    case "create_reminder":
      return "Creates an in-app reminder for your team. Customers are not contacted automatically."
    case "create_communication_draft":
      return "Saves an unsent draft in Communications. Confirming does not send messages."
    default:
      return "Runs once if you confirm. Nothing sends automatically."
  }
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { toast } = useToast()
  const currentModule = useMemo(() => moduleFromPath(pathname), [pathname])
  const quickPrompts = useMemo(() => currentModule.quickPrompts.slice(0, 4), [currentModule])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionReady, setSessionReady] = useState(false)
  const sessionStartedAtRef = useRef<Date>(new Date())
  const messagesRef = useRef<ChatMessage[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [frOpen, setFrOpen] = useState(false)
  const [frNonce, setFrNonce] = useState(0)
  const [frInitial, setFrInitial] = useState<AidenFrFormValues>(() => defaultFrValues(""))

  const [aidenEligibility, setAidenEligibility] = useState<AidenEligibilityForMessaging | null>(null)
  const [actionIntent, setActionIntent] = useState("")
  const [actionBusy, setActionBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingSafeActionPreview | null>(null)
  const [trialActionPreview, setTrialActionPreview] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  /** Restore from localStorage when the panel mounts (launcher unmounts panel when closed). */
  useEffect(() => {
    if (!open) return

    let cancelled = false
    setSessionReady(false)

    ;(async () => {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      if (!cancelled) setUserId(uid)

      if (!organizationId || orgStatus !== "ready") {
        if (!cancelled) {
          sessionStartedAtRef.current = new Date()
          setMessages([createWelcomeMessage(currentModule.id, null)])
          setSessionReady(true)
        }
        return
      }

      const stored = loadAidenChatSession(organizationId, uid)
      if (cancelled) return

      if (stored?.messages?.length) {
        sessionStartedAtRef.current = new Date(stored.createdAt)
        setMessages(messagesFromPayload(stored.messages))
      } else {
        sessionStartedAtRef.current = new Date()
        setMessages([createWelcomeMessage(currentModule.id, null)])
      }
      setSessionReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [open, organizationId, orgStatus])

  useEffect(() => {
    if (!open || !organizationId || orgStatus !== "ready") {
      setAidenEligibility(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/aiden/productivity/eligibility`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          safeActionsEnabled?: boolean
          safeActionsGrowthHint?: boolean
          productivityEnabled?: boolean
          operationalCopilotEnabled?: boolean
          preparedWorkspaceActionsEnabled?: boolean
          planTier?: string
          preparedWorkspaceTierGatingEnabled?: boolean
          preparedWorkspaceActionAccess?: Array<{ actionId: string; allowed: boolean; minPlan: string }>
        }
        if (cancelled) return
        if (res.ok && data.ok) {
          setAidenEligibility({
            safeActionsEnabled: Boolean(data.safeActionsEnabled),
            safeActionsGrowthHint: Boolean(data.safeActionsGrowthHint),
            productivityEnabled: Boolean(data.productivityEnabled),
            operationalCopilotEnabled: Boolean(data.operationalCopilotEnabled),
            preparedWorkspaceActionsEnabled: Boolean(data.preparedWorkspaceActionsEnabled),
            planTier: typeof data.planTier === "string" ? data.planTier : undefined,
            preparedWorkspaceTierGatingEnabled: Boolean(data.preparedWorkspaceTierGatingEnabled),
            preparedWorkspaceActionAccess: Array.isArray(data.preparedWorkspaceActionAccess)
              ? data.preparedWorkspaceActionAccess
              : undefined,
          })
        } else {
          setAidenEligibility(null)
        }
      } catch {
        if (!cancelled) setAidenEligibility(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, orgStatus])

  /** Keep the welcome bubble aligned with path + plan when the user has not started a conversation yet. */
  useEffect(() => {
    if (!open || !sessionReady) return
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.id !== "welcome") return prev
      const nextContent = buildAidenWelcomeContent({
        moduleId: currentModule.id,
        eligibility: aidenEligibility,
      })
      if (prev[0].content === nextContent) return prev
      return [{ ...prev[0], content: nextContent }]
    })
  }, [
    open,
    sessionReady,
    currentModule.id,
    aidenEligibility?.safeActionsEnabled,
    aidenEligibility?.safeActionsGrowthHint,
    aidenEligibility?.productivityEnabled,
    aidenEligibility?.operationalCopilotEnabled,
    aidenEligibility?.preparedWorkspaceActionsEnabled,
    aidenEligibility?.preparedWorkspaceTierGatingEnabled,
    aidenEligibility?.planTier,
  ])

  /** Persist session (best-effort). */
  useEffect(() => {
    if (!open || !sessionReady || !organizationId || orgStatus !== "ready") return

    serializeAidenChatSession({
      organizationId,
      userId,
      messages,
      path: pathname || "/",
      moduleLabel: currentModule.label,
      sessionCreatedAt: sessionStartedAtRef.current,
    })
  }, [
    messages,
    open,
    sessionReady,
    organizationId,
    orgStatus,
    userId,
    pathname,
    currentModule.label,
  ])

  const chatMessagesForContext = useMemo((): AidenChatMessage[] => {
    return messages
      .filter((m) => m.id !== "welcome" && !m.prepareFailure)
      .map((m) => ({ role: m.role, content: m.content }))
  }, [messages])

  function openFeatureRequest(draft?: AidenFeatureRequestDraft | null) {
    setFrInitial(draft ? draftToFrValues(draft, currentModule.label) : defaultFrValues(currentModule.label))
    setFrNonce((n) => n + 1)
    setFrOpen(true)
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  function startNewChat() {
    if (
      !confirm(
        "Start a new chat? Your current conversation will be cleared on this browser (this device only).",
      )
    ) {
      return
    }
    if (organizationId) {
      clearAidenChatSession(organizationId, userId)
    }
    sessionStartedAtRef.current = new Date()
    setMessages([createWelcomeMessage(currentModule.id, aidenEligibility)])
    setError(null)
    setFrOpen(false)
    setPendingAction(null)
    setTrialActionPreview(false)
    setActionIntent("")
    setActionError(null)
    toast({ title: "New chat started" })
  }

  async function prepareWorkspaceAction() {
    const intent = actionIntent.trim()
    if (!intent || actionBusy || !organizationId || orgStatus !== "ready") return
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/actions/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          currentPath: pathname || "/",
          currentModule: currentModule.label,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        trialAiPreview?: boolean
        proposal?: {
          title: string
          explanation: string
          action_type: string
          risk_level: string
          proposed_payload: Record<string, unknown>
        }
        pending?: PendingSafeActionPreview
        notice?: string
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not prepare an action.")
      }
      if (data.trialAiPreview && data.proposal) {
        setTrialActionPreview(true)
        setPendingAction({
          id: TRIAL_ACTION_PREVIEW_ID,
          title: data.proposal.title,
          explanation: data.proposal.explanation,
          action_type: data.proposal.action_type,
          risk_level: data.proposal.risk_level,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          proposed_payload: data.proposal.proposed_payload,
          affected_record_ids: [],
        })
        setActionIntent("")
        toast({
          title: "Trial AI preview",
          description:
            data.notice ??
            "This workspace action is preview-only during trial. Upgrade to save pending actions.",
        })
        return
      }
      if (!data.pending) {
        throw new Error(data.message ?? data.error ?? "Could not prepare an action.")
      }
      setTrialActionPreview(false)
      setPendingAction(data.pending)
      setActionIntent("")
      toast({
        title: "Review required",
        description: "Confirm or cancel this prepared workspace action — nothing runs until you confirm.",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not prepare an action."
      setActionError(msg)
      toast({ title: "Prepare failed", description: msg, variant: "destructive" })
    } finally {
      setActionBusy(false)
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction || actionBusy || !organizationId || orgStatus !== "ready") return
    if (trialActionPreview || pendingAction.id === TRIAL_ACTION_PREVIEW_ID) {
      toast({
        title: "Trial AI preview",
        description:
          "Confirming workspace actions that update records requires an active paid subscription. You can still copy details manually.",
      })
      return
    }
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/actions/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_action_id: pendingAction.id }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        summary?: string
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not complete the action.")
      }
      setPendingAction(null)
      setTrialActionPreview(false)
      toast({
        title: "Action saved",
        description: data.summary ?? "Your workspace was updated.",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not complete the action."
      setActionError(msg)
      toast({ title: "Action failed", description: msg, variant: "destructive" })
    } finally {
      setActionBusy(false)
    }
  }

  async function cancelPendingAction() {
    if (!pendingAction || actionBusy || !organizationId || orgStatus !== "ready") return
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/aiden/actions/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pending_action_id: pendingAction.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Could not cancel.")
      }
      setPendingAction(null)
      setTrialActionPreview(false)
      toast({ title: "Canceled", description: "No changes were made." })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not cancel."
      setActionError(msg)
      toast({ title: "Cancel failed", description: msg, variant: "destructive" })
    } finally {
      setActionBusy(false)
    }
  }

  async function runSupportChat(thread: ChatMessage[], options?: { tierChatPrefix?: string | null }) {
    const apiMessages: AidenChatMessage[] = thread
      .filter((m) => m.id !== "welcome" && !m.prepareFailure)
      .map((m) => ({ role: m.role, content: m.content }))

    const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId!)}/aiden/chat`, {
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
      answer?: AidenSupportPhase2Answer
      message?: string
      error?: string
    }
    if (!res.ok || !data.ok || !data.answer) {
      throw new Error(data.message ?? data.error ?? "AIden could not answer right now.")
    }
    const answer = data.answer
    const tier = options?.tierChatPrefix?.trim() ?? ""
    const answerForStore: AidenSupportPhase2Answer = tier ? { ...answer, answer: `${tier}${answer.answer}` } : answer
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answerToContent(answerForStore),
        answer: answerForStore,
        createdAt: new Date(),
      },
    ])
  }

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
    const prev = messagesRef.current
    const nextMessages = [...prev, userMessage]
    setMessages(nextMessages)
    setInput("")
    setError(null)
    setLoading(true)

    const tierChatPrefix = buildAidenPreparedWorkspaceTierChatPrefix(content, aidenEligibility)

    try {
      const shouldTryPrepare = aidenEligibility?.preparedWorkspaceActionsEnabled === true

      if (shouldTryPrepare) {
        try {
          const context = buildWorkspacePrepareContext({
            pathname,
            drawerOpenId: searchParams.get("open"),
            currentModuleLabel: currentModule.label,
          })
          const prepRes = await fetch(
            `/api/organizations/${encodeURIComponent(organizationId)}/aiden/prepared-actions/prepare`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: content, context }),
            },
          )
          const pdata = (await prepRes.json().catch(() => ({}))) as {
            preparedAction?: SerializedPreparedAction
            message?: string
            error?: string
            requiredPlan?: string
            actionId?: string
          }

          if (prepRes.ok && pdata.preparedAction) {
            const pa = pdata.preparedAction
            const intro =
              pa.status === "needs_clarification"
                ? "I need a bit more detail before I can show a billing preview. Use the card below, then reply in chat with specifics (for example which customer or work order)."
                : pa.status === "failed"
                  ? "I matched that to a billing action, but the preview could not be built. Details are in the card — you can dismiss it and try again with more context."
                  : pa.actionId === "prepare_invoice_payment_link"
                    ? "I parsed that as preparing a BlitzPay payment link. Review the preview below — nothing is sent or charged until you confirm and copy the link yourself."
                    : pa.actionId === "prepare_quickbooks_invoice_sync"
                      ? "I matched that to preparing a QuickBooks invoice sync. Review the preview — nothing is sent to QuickBooks until you confirm sync in the card."
                      : pa.actionId === "create_quote_from_work_order"
                        ? "I parsed that as creating a draft quote from a work order. Review the preview below — nothing is emailed or sent to the customer until you confirm and later send from Quotes if you choose."
                        : pa.actionId === "draft_customer_message"
                          ? "I drafted customer-facing message copy for you to review. Nothing is sent until you save it to Communications and use your normal send flow later."
                          : pa.actionId === "create_follow_up_task"
                            ? "I parsed that as creating an internal follow-up task. Review and edit the card below — confirming adds it to your follow-up queue only; customers are not contacted automatically."
                            : pa.actionId === "create_maintenance_plan_from_equipment"
                              ? "I parsed that as creating a recurring maintenance plan for this equipment. Review the card — confirming saves an active plan (billing and maintenance plan entitlements apply)."
                              : pa.actionId === "create_parts_reorder_request"
                                ? "I parsed that as a parts reorder or low-stock request. Review the card — confirming saves an internal draft PO or inventory restock signals only; nothing is sent to vendors automatically."
                                : pa.actionId === "schedule_maintenance_visit"
                                ? "I parsed that as scheduling a maintenance or service visit. Review the card — confirming creates a scheduled work order (dispatch or work order permissions required)."
                                : pa.actionId === "summarize_customer_history"
                                  ? "Here is a read-only snapshot of this customer’s recent work, equipment, maintenance, and open items. Review the card below — no records were changed."
                                  : "I parsed that as a billing action. Review the preview below — nothing saves until you create a draft invoice."

            setMessages((p) => [
              ...p,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: intro,
                preparedAction: pa,
                createdAt: new Date(),
              },
            ])
            return
          }

          if (prepRes.status === 422) {
            const amb =
              typeof pdata.message === "string" && pdata.message.trim()
                ? pdata.message.trim()
                : "That request matches more than one action. Please say exactly what you want (for example only creating a draft invoice from one work order)."
            setMessages((p) => [
              ...p,
              { id: crypto.randomUUID(), role: "assistant", content: amb, createdAt: new Date() },
            ])
            return
          }

          if (prepRes.status === 403) {
            const err = pdata.error
            let explain =
              typeof pdata.message === "string" && pdata.message.trim()
                ? pdata.message.trim()
                : "That request is not allowed for this workspace."
            if (err === "plan_upgrade_required") {
              const tier = typeof pdata.requiredPlan === "string" && pdata.requiredPlan.trim() ? pdata.requiredPlan.trim() : "the right plan"
              explain = `${explain}\n\nUpgrade to ${tier} (or higher) under Settings → Billing to use this prepared workspace action. I can still help with general how-to questions below.`
            } else if (err === "insufficient_permissions") {
              explain = `${explain}\n\nThis billing action requires invoice and work order editing access. Ask an owner or admin if you need it. I can still answer general questions below.`
            } else if (err === "aiden_actions_disabled") {
              explain = `${explain}\n\nYour subscription or workspace may need AIden Actions enabled for prepared billing. I can still help with how-to guidance below.`
            } else if (err === "aiden_actions_denied") {
              explain = `${explain}\n\nFor technician-style roles, an owner or manager may need to run this kind of billing step. General guidance follows.`
            }
            const explMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: explain,
              createdAt: new Date(),
            }
            setMessages((p) => [...p, explMsg])
            await runSupportChat([...nextMessages, explMsg], {})
            return
          }

          const unsupported = prepRes.status === 400 && pdata.error === "unsupported_intent"
          const okWithoutPrepared = prepRes.ok && !pdata.preparedAction
          if (!unsupported && !okWithoutPrepared) {
            const failMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content:
                prepRes.status >= 500
                  ? "The billing preview service had a server problem. You can retry in a moment."
                  : "AIden could not prepare a billing preview from that message. Check your connection or retry.",
              prepareFailure: true,
              retryUserText: content,
              createdAt: new Date(),
            }
            setMessages((p) => [...p, failMsg])
            return
          }
        } catch {
          setMessages((p) => [
            ...p,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Something went wrong while contacting the billing preview service.",
              prepareFailure: true,
              retryUserText: content,
              createdAt: new Date(),
            },
          ])
          return
        }
      }

      await runSupportChat(nextMessages, { tierChatPrefix })
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

  const capabilityBadgeId = resolveAidenCapabilityBadge(aidenEligibility)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b border-border bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-400">
                <Bot size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-1.5 text-left">
                  Ask <AidenWordmark size="md" />
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground text-left">
                  Help for <strong>{currentModule.label}</strong> — you&apos;re on{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{pathname || "/"}</code>
                  {orgStatus === "ready" && organizationId ? (
                    <span className="mt-1.5 block">
                      <span className="inline-flex max-w-full items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {aidenCapabilityBadgeLabel(capabilityBadgeId)}
                      </span>
                    </span>
                  ) : null}
                </SheetDescription>
              </div>
            </div>
            {sessionReady ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
                onClick={startNewChat}
                disabled={loading}
                aria-label="Start a new chat"
              >
                <MessageSquarePlus className="size-3.5" aria-hidden />
                New chat
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/30 to-background px-4 py-4"
        >
          {!sessionReady ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              Loading conversation…
            </div>
          ) : null}
          {sessionReady && messages.length <= 1 ? (
            <div className="mb-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-foreground">
              <p className="font-medium">
                Context: <span className="text-muted-foreground">{currentModule.label}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {buildAidenIdlePanelHint({ moduleId: currentModule.id, eligibility: aidenEligibility })}
              </p>
            </div>
          ) : null}

          {sessionReady ? (
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
                    "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-xs",
                    message.preparedAction ? "max-w-[96%] w-full min-w-0" : "max-w-[85%]",
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
                  {message.prepareFailure ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        disabled={loading}
                        onClick={() => void sendMessage(message.retryUserText ?? "")}
                      >
                        Retry billing preview
                      </Button>
                    </div>
                  ) : null}
                  {message.preparedAction && organizationId ? (
                    <div className="mt-3 w-full min-w-0 space-y-2">
                      <PreparedActionCard
                        organizationId={organizationId}
                        preparedAction={message.preparedAction}
                        onPreparedActionUpdated={(next) =>
                          setMessages((prev) =>
                            prev.map((m) => (m.id === message.id ? { ...m, preparedAction: next } : m)),
                          )
                        }
                        onDismiss={() =>
                          setMessages((prev) =>
                            prev.map((m) =>
                              m.id === message.id
                                ? {
                                    ...m,
                                    preparedAction: undefined,
                                    content: `${m.content}\n\n_(Preview dismissed.)_`,
                                  }
                                : m,
                            ),
                          )
                        }
                        onEditBeforeCreating={(ctx) => {
                          const q = new URLSearchParams()
                          q.set("action", "new-invoice")
                          if (ctx.workOrderId) q.set("workOrderId", ctx.workOrderId)
                          router.push(`/invoices?${q.toString()}`)
                        }}
                        onPrefillChat={(text) => setInput(text)}
                      />
                    </div>
                  ) : null}
                  {message.role === "assistant" &&
                  message.answer?.classification === "not_built_feature_candidate" &&
                  message.answer.featureRequestDraft ? (
                    <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-foreground">
                      <p className="font-medium text-sky-950 dark:text-sky-50">This capability isn&apos;t in Equipify yet.</p>
                      <p className="mt-1 text-muted-foreground">
                        You can send your idea to our product team — it won&apos;t change anything in your workspace.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2 h-8 bg-background text-xs"
                        onClick={() => openFeatureRequest(message.answer!.featureRequestDraft)}
                      >
                        Submit feature request
                      </Button>
                    </div>
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
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
          {frOpen && organizationId && orgStatus === "ready" ? (
            <div className="mb-3">
              <AidenFeatureRequestFlow
                organizationId={organizationId}
                sessionNonce={frNonce}
                initialValues={frInitial}
                currentPath={pathname || "/"}
                chatMessagesForContext={chatMessagesForContext}
                onCancel={() => setFrOpen(false)}
                onSuccess={({ duplicate, requestId }) => {
                  if (duplicate) {
                    toast({
                      title: "Similar request on file",
                      description: requestId ? `Reference: ${requestId}` : undefined,
                    })
                  } else {
                    toast({
                      title: "Feature request sent",
                      description: "The Equipify team will review your feedback.",
                    })
                  }
                }}
              />
            </div>
          ) : null}
          {messages.length <= 1 && !frOpen ? (
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
          {!frOpen ? (
            <div className="mb-3">
              <button
                type="button"
                className="text-left text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                onClick={() => openFeatureRequest()}
                disabled={!organizationId || orgStatus !== "ready" || loading}
              >
                Submit a feature request
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
          {actionError ? (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{actionError}</span>
            </div>
          ) : null}
          {aidenEligibility?.safeActionsGrowthHint ? (
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{SAFE_ACTIONS_SCALE_ONLY_MESSAGE}</p>
          ) : null}
          {aidenEligibility?.safeActionsEnabled && !frOpen ? (
            <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <ClipboardList size={14} className="shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                Prepared workspace action
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{PREPARED_WORKSPACE_ACTION_INTRO}</p>
              {!pendingAction ? (
                <div className="space-y-2">
                  <Textarea
                    value={actionIntent}
                    onChange={(e) => setActionIntent(e.target.value)}
                    placeholder="Example: Add a follow-up task on today’s job to call the customer about parts."
                    className="max-h-28 min-h-[4.5rem] resize-none text-xs"
                    disabled={actionBusy || loading || !organizationId || orgStatus !== "ready"}
                    aria-label="Describe an action for AIden to prepare"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={
                      actionBusy ||
                      loading ||
                      !actionIntent.trim() ||
                      !organizationId ||
                      orgStatus !== "ready"
                    }
                    onClick={() => void prepareWorkspaceAction()}
                  >
                    {actionBusy ? (
                      <>
                        <Loader2 size={14} className="mr-2 animate-spin" aria-hidden />
                        Preparing…
                      </>
                    ) : (
                      "Prepare action"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {pendingAction.action_type}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        pendingAction.risk_level === "high"
                          ? "bg-red-500/15 text-red-800 dark:text-red-200"
                          : pendingAction.risk_level === "medium"
                            ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                            : "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
                      )}
                    >
                      Risk: {pendingAction.risk_level}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pendingAction.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pendingAction.explanation}</p>
                    <p className="mt-2 text-[11px] leading-snug text-foreground/90">{safeActionOutcomeHint(pendingAction.action_type)}</p>
                  </div>
                  <pre className="max-h-28 overflow-auto rounded-lg bg-muted/60 p-2 text-[10px] leading-snug text-muted-foreground">
                    {JSON.stringify(pendingAction.proposed_payload, null, 2)}
                  </pre>
                  <p className="text-[10px] text-muted-foreground">
                    Expires {new Date(pendingAction.expires_at).toLocaleString()}
                  </p>
                  {trialActionPreview ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                      Trial AI experience — review only. Saving workspace actions requires an active paid subscription.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      disabled={actionBusy || trialActionPreview}
                      onClick={() => void confirmPendingAction()}
                    >
                      {actionBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "Confirm"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={actionBusy}
                      onClick={() => void cancelPendingAction()}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
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
              placeholder={
                aidenEligibility?.preparedWorkspaceActionsEnabled
                  ? `Ask about ${currentModule.label.toLowerCase()}, or e.g. draft an invoice from a work order…`
                  : `Ask about ${currentModule.label.toLowerCase()}…`
              }
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
