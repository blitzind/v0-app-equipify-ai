/** Apollo Voice Drop script generation — client-safe, no send. */

import type { ApolloUnifiedPersonalizationContext } from "@/lib/growth/apollo/apollo-unified-personalization-context"
import {
  resolveApolloUnifiedBusinessProblem,
  resolveApolloUnifiedCompanyInsight,
  resolveApolloUnifiedResearchInsight,
  resolveApolloUnifiedRoleInsight,
} from "@/lib/growth/apollo/apollo-unified-personalization-context"
import type {
  ApolloVoiceDropScript,
  ApolloVoiceDropScriptType,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  buildIndustryContextVoiceScript,
  type GrowthIndustryContext,
} from "@/lib/growth/playbooks/growth-industry-context"

export const APOLLO_VOICE_DROP_SCRIPT_GENERATION_QA_MARKER =
  "apollo-voice-drop-script-generation-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function firstName(fullName: string): string {
  return asString(fullName).split(/\s+/)[0] || "there"
}

const SCRIPT_FRAMES: Record<
  ApolloVoiceDropScriptType,
  {
    intro: string
    value: string
    personalization: string
    cta: string
  }
> = {
  cold_introduction: {
    intro: "Hi {{first_name}}, this is {{assigned_rep}} from Equipify.",
    value:
      "We help equipment-intensive operators streamline service workflows and reduce downtime across their fleet.",
    personalization: "I noticed {{company_name}} and thought our approach might be relevant to your team.",
    cta: "If you're open to it, I'd welcome a brief conversation — feel free to call us back or reply by email.",
  },
  referral_style: {
    intro: "Hi {{first_name}}, {{assigned_rep}} from Equipify — quick note for you.",
    value:
      "We work with operators facing similar scale and complexity, helping them unify equipment service coordination.",
    personalization:
      "Given your role at {{company_name}}, I thought a short comparison might be worthwhile.",
    cta: "Would you be open to a 10-minute call this week? You can reach us at {{callback_number}}.",
  },
  equipment_service_focused: {
    intro: "Hi {{first_name}}, this is {{assigned_rep}} with Equipify.",
    value:
      "We specialize in helping field service and equipment teams reduce dispatch friction and missed maintenance windows.",
    personalization:
      "Teams like {{company_name}} often look for better visibility across service requests and asset uptime.",
    cta: "I'd love to share a quick workflow example — callback or email works great.",
  },
  biomedical_specific: {
    intro: "Hi {{first_name}}, {{assigned_rep}} from Equipify calling about biomedical operations support.",
    value:
      "We help biomedical teams maintain compliance while keeping critical equipment available for patient care.",
    personalization:
      "{{company_name}} stood out as an organization where uptime and regulatory readiness both matter.",
    cta: "If a short discovery call makes sense, please call back or reply — happy to tailor the conversation.",
  },
  follow_up: {
    intro: "Hi {{first_name}}, {{assigned_rep}} from Equipify following up on my earlier note.",
    value:
      "I wanted to reconnect in case improving equipment service coordination is still on your radar.",
    personalization: "No pressure — just checking whether {{company_name}} would like to explore next steps.",
    cta: "A quick callback or email reply would be great so we can find a convenient time.",
  },
}

function renderTemplate(
  template: string,
  data: Record<string, string | null>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_full, key: string) => {
    const value = data[key]
    return value && value.trim() ? value.trim() : `[${key}]`
  })
}

export function generateApolloVoiceDropScript(input: {
  script_type: ApolloVoiceDropScriptType
  full_name: string
  company_name: string
  title?: string | null
  assigned_rep?: string | null
  callback_number?: string | null
  research_line?: string | null
}): ApolloVoiceDropScript {
  const frame = SCRIPT_FRAMES[input.script_type]
  const personalization_data: Record<string, string | null> = {
    first_name: firstName(input.full_name),
    company_name: input.company_name,
    assigned_rep: input.assigned_rep ?? "your Equipify team",
    callback_number: input.callback_number ?? "our main line",
    title: input.title ?? null,
    research_line: input.research_line ?? null,
  }

  const intro = renderTemplate(frame.intro, personalization_data)
  let value_proposition = renderTemplate(frame.value, personalization_data)
  let personalization_line = renderTemplate(frame.personalization, personalization_data)
  if (input.research_line) {
    personalization_line = `${personalization_line} ${input.research_line}`.trim()
  }
  const call_to_action = renderTemplate(frame.cta, personalization_data)
  const full_script = [intro, value_proposition, personalization_line, call_to_action].join(" ")

  return {
    script_type: input.script_type,
    intro,
    value_proposition,
    personalization_line,
    call_to_action,
    full_script,
    personalization_data,
  }
}

/** Generate voice drop script from unified personalization context — evidence only. */
export function generateApolloVoiceDropScriptFromUnifiedContext(input: {
  script_type: ApolloVoiceDropScriptType
  unified_context: ApolloUnifiedPersonalizationContext
  assigned_rep?: string | null
  callback_number?: string | null
}): ApolloVoiceDropScript {
  const ctx = input.unified_context
  const companyInsight = resolveApolloUnifiedCompanyInsight(ctx)
  const roleInsight = resolveApolloUnifiedRoleInsight(ctx)
  const researchInsight = resolveApolloUnifiedResearchInsight(ctx)
  const businessProblem = resolveApolloUnifiedBusinessProblem(ctx)

  const researchLine = [
    companyInsight,
    roleInsight,
    researchInsight,
    businessProblem ? `Focus area: ${businessProblem}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 200)

  const script = generateApolloVoiceDropScript({
    script_type: input.script_type,
    full_name: ctx.contact_full_name,
    company_name: ctx.contact_company_name,
    title: ctx.contact_title,
    assigned_rep: input.assigned_rep,
    callback_number: input.callback_number,
    research_line: researchLine || null,
  })

  const ctaRationale = ctx.outreach_packet.researchRecommendedNextAction?.trim()
  if (ctaRationale && !script.call_to_action.includes(ctaRationale.slice(0, 40))) {
    const call_to_action = `${script.call_to_action} ${ctaRationale}`.trim()
    const full_script = [script.intro, script.value_proposition, script.personalization_line, call_to_action].join(
      " ",
    )
    return { ...script, call_to_action, full_script }
  }

  return script
}

/** GS-AI-PLAYBOOK-1C — Industry playbook voice script overlay (evidence-only, no send). */
export function generateApolloVoiceDropScriptFromIndustryContext(input: {
  script_type: ApolloVoiceDropScriptType
  full_name: string
  company_name: string
  title?: string | null
  industryContext: GrowthIndustryContext
  assigned_rep?: string | null
  callback_number?: string | null
  research_line?: string | null
}): ApolloVoiceDropScript {
  const playbookLine = buildIndustryContextVoiceScript(input.industryContext, input.company_name)
  const base = generateApolloVoiceDropScript({
    script_type: input.script_type,
    full_name: input.full_name,
    company_name: input.company_name,
    title: input.title,
    assigned_rep: input.assigned_rep,
    callback_number: input.callback_number,
    research_line: input.research_line ?? null,
  })

  if (!playbookLine || !input.industryContext.playbookApplied) return base

  const mapping = input.industryContext.capabilityMappings[0]
  const value_proposition = mapping
    ? `Equipify helps with ${mapping.capability.toLowerCase()} and ${mapping.equipifyModule.toLowerCase()}.`
    : base.value_proposition
  const industryChallenge = input.industryContext.industryFacts[0] ?? base.value_proposition
  const personalization_line = input.industryContext.verifiedFacts[0]
    ? `We noticed ${input.company_name} ${input.industryContext.verifiedFacts[0]!.replace(/^(Summary|Observed|Service focus):\s*/i, "")}.`
    : base.personalization_line
  const call_to_action = input.industryContext.recommendedCtas[0] ?? base.call_to_action
  const full_script = [base.intro, industryChallenge, value_proposition, personalization_line, call_to_action]
    .filter(Boolean)
    .join(" ")

  return {
    ...base,
    value_proposition,
    personalization_line,
    call_to_action,
    full_script,
  }
}
