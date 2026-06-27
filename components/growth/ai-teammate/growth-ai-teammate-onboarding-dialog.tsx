"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, Sparkles } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  AI_TEAMMATE_DEFAULT_ROLE,
  AI_TEAMMATE_SUGGESTED_NAMES,
  isValidAiTeammateName,
  normalizeAiTeammateName,
} from "@/lib/workspace/ai-teammate-identity"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { AI_OS_WORKSPACE_LABEL } from "@/lib/workspace/ai-os-workspace-branding"

type Step = "welcome" | "meet" | "rename" | "role" | "begin"

export function GrowthAiTeammateOnboardingDialog() {
  const { onboardingOpen, completeOnboarding, closeOnboarding, teammate } = useAiTeammateIdentity()
  const [step, setStep] = useState<Step>("welcome")
  const [draftName, setDraftName] = useState(AI_TEAMMATE_DEFAULT_NAME)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (onboardingOpen) {
      setStep("welcome")
      setDraftName(teammate.name)
      setNameError(null)
    }
  }, [onboardingOpen, teammate.name])

  async function advance() {
    if (step === "welcome") setStep("meet")
    else if (step === "meet") setStep("rename")
    else if (step === "rename") {
      const normalized = normalizeAiTeammateName(draftName)
      if (!isValidAiTeammateName(normalized)) {
        setNameError("Enter a valid name between 2 and 32 characters.")
        return
      }
      setNameError(null)
      setDraftName(normalized)
      setStep("role")
    } else if (step === "role") setStep("begin")
    else await completeOnboarding(draftName)
  }

  function skipRename() {
    setDraftName(AI_TEAMMATE_DEFAULT_NAME)
    setStep("role")
  }

  return (
    <Dialog open={onboardingOpen} onOpenChange={(open) => !open && closeOnboarding()}>
      <DialogContent className="sm:max-w-lg" data-qa-section="ai-teammate-onboarding">
        {step === "welcome" ? (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to {AI_OS_WORKSPACE_LABEL}</DialogTitle>
              <DialogDescription>
                Equipify {AI_OS_WORKSPACE_LABEL} runs revenue work in the background. You review exceptions — not tools.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <p className="text-sm text-muted-foreground">
                Next, meet the AI teammate who represents every capability inside {AI_OS_WORKSPACE_LABEL}.
              </p>
            </div>
          </>
        ) : null}

        {step === "meet" ? (
          <>
            <DialogHeader>
              <DialogTitle>Meet your AI teammate</DialogTitle>
              <DialogDescription>
                We&apos;ve named your AI teammate {AI_TEAMMATE_DEFAULT_NAME}. You can rename {AI_TEAMMATE_DEFAULT_NAME} at any time.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-5">
              <span className="flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <Bot className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-semibold">{AI_TEAMMATE_DEFAULT_NAME}</p>
                <p className="text-sm text-muted-foreground">{AI_TEAMMATE_DEFAULT_ROLE}</p>
              </div>
            </div>
          </>
        ) : null}

        {step === "rename" ? (
          <>
            <DialogHeader>
              <DialogTitle>Rename your AI teammate</DialogTitle>
              <DialogDescription>Optional — keep {AI_TEAMMATE_DEFAULT_NAME} or choose a name your team will recognize.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ai-teammate-name">AI name</Label>
                <Input
                  id="ai-teammate-name"
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value)
                    setNameError(null)
                  }}
                  placeholder={AI_TEAMMATE_DEFAULT_NAME}
                  autoComplete="off"
                />
                {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {AI_TEAMMATE_SUGGESTED_NAMES.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant={draftName === name ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDraftName(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {step === "role" ? (
          <>
            <DialogHeader>
              <DialogTitle>{normalizeAiTeammateName(draftName)}&apos;s role</DialogTitle>
              <DialogDescription>
                {normalizeAiTeammateName(draftName)} is your AI teammate — not a chatbot. {normalizeAiTeammateName(draftName)} represents prospecting, outreach, meetings, learning, and every autonomous capability inside {AI_OS_WORKSPACE_LABEL}.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                Researches accounts and prepares outreach while you focus elsewhere.
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                Books meetings and advances opportunities — then brings you only the exceptions.
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                Engineering systems stay invisible unless you open Advanced.
              </li>
            </ul>
            <p className="text-sm font-medium text-foreground">Role · {AI_TEAMMATE_DEFAULT_ROLE}</p>
          </>
        ) : null}

        {step === "begin" ? (
          <>
            <DialogHeader>
              <DialogTitle>Begin your first objective</DialogTitle>
              <DialogDescription>
                {normalizeAiTeammateName(draftName)} is ready. Review what {normalizeAiTeammateName(draftName)} handled on Home, then clear any exceptions waiting on you.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              You can change {normalizeAiTeammateName(draftName)}&apos;s name anytime under Settings → AI Teammate.
            </div>
          </>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === "rename" ? (
            <Button type="button" variant="ghost" onClick={skipRename}>
              Keep {AI_TEAMMATE_DEFAULT_NAME}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {step === "begin" ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/objectives`}>View objectives</Link>
              </Button>
            ) : null}
            <Button type="button" onClick={advance}>
              {step === "begin" ? "Go to Home" : "Continue"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
