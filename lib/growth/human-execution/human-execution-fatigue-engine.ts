import type { HumanExecutionSequenceRules } from "@/lib/growth/human-execution/human-execution-types"

export type HumanExecutionFatigueInput = {
  recentTouchCount7d: number
  recentTouchCount24h: number
  lastTouchAt: string | null
  rules: HumanExecutionSequenceRules
}

export type HumanExecutionFatigueResult = {
  blocked: boolean
  reason: string | null
  nextEligibleAt: string | null
  fatiguePrevented: boolean
}

export function evaluateHumanExecutionFatigue(input: HumanExecutionFatigueInput): HumanExecutionFatigueResult {
  if (!input.rules.fatigueProtection) {
    return { blocked: false, reason: null, nextEligibleAt: null, fatiguePrevented: false }
  }

  if (input.recentTouchCount24h >= 2) {
    const next = new Date()
    next.setHours(next.getHours() + input.rules.minCooldownHours)
    return {
      blocked: true,
      reason: "Fatigue protection: max 2 touches in 24 hours.",
      nextEligibleAt: next.toISOString(),
      fatiguePrevented: true,
    }
  }

  if (input.recentTouchCount7d >= input.rules.maxTouchesPerWeek) {
    const next = new Date()
    next.setDate(next.getDate() + 2)
    return {
      blocked: true,
      reason: `Fatigue protection: max ${input.rules.maxTouchesPerWeek} touches per week.`,
      nextEligibleAt: next.toISOString(),
      fatiguePrevented: true,
    }
  }

  if (input.lastTouchAt) {
    const elapsedHours = (Date.now() - Date.parse(input.lastTouchAt)) / 3600000
    if (elapsedHours < input.rules.minCooldownHours) {
      const next = new Date(Date.parse(input.lastTouchAt))
      next.setHours(next.getHours() + input.rules.minCooldownHours)
      return {
        blocked: true,
        reason: `Cooldown window: wait ${input.rules.minCooldownHours}h between touches.`,
        nextEligibleAt: next.toISOString(),
        fatiguePrevented: true,
      }
    }
  }

  return { blocked: false, reason: null, nextEligibleAt: null, fatiguePrevented: false }
}
