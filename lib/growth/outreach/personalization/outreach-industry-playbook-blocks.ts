/** GS-AI-PLAYBOOK-1C — Apply industry playbook blocks to outreach strategy (client-safe). */

import {
  buildIndustryContextEmailParagraphs,
  type GrowthIndustryContext,
} from "@/lib/growth/playbooks/growth-industry-context"
import type {
  OutreachContextPacket,
  SelectedMessageBlock,
} from "@/lib/growth/outreach/personalization/personalization-types"

function minimalPlaybookOpening(packet: OutreachContextPacket): string {
  const contact = packet.decisionMakerName?.trim()
  if (contact) return `Hi ${contact.split(/\s+/)[0] ?? contact},`
  return "Hi there,"
}

export function applyPlaybookIndustryBlocksToStrategy(input: {
  blocks: SelectedMessageBlock[]
  context: GrowthIndustryContext
  packet: OutreachContextPacket
  usedMemoryOpener: boolean
  usedResearchOpener: boolean
}): SelectedMessageBlock[] {
  if (!input.context.playbookApplied || !input.context.playbook) return input.blocks

  const paragraphs = buildIndustryContextEmailParagraphs(input.context, input.packet.companyName)
  let blocks = [...input.blocks]

  if (!input.usedMemoryOpener && !input.usedResearchOpener) {
    const openingIndex = blocks.findIndex((block) => block.key === "opening")
    if (openingIndex >= 0) {
      blocks[openingIndex] = {
        ...blocks[openingIndex],
        blockId: "opening_playbook_minimal",
        label: "Playbook greeting",
        text: minimalPlaybookOpening(input.packet),
      }
    }
  }

  blocks = blocks.map((block) => {
    if (block.key === "pain" && paragraphs.industryParagraph) {
      return {
        ...block,
        blockId: "industry_playbook_context",
        label: "Industry context",
        text: paragraphs.industryParagraph,
      }
    }
    if (block.key === "industry" && paragraphs.companyParagraph) {
      return {
        ...block,
        blockId: "industry_playbook_verified_company",
        label: "Verified company context",
        text: paragraphs.companyParagraph,
      }
    }
    if (block.key === "proof" && paragraphs.capabilityParagraph) {
      return {
        ...block,
        blockId: "industry_playbook_capability",
        label: "Capability mapping",
        text: paragraphs.capabilityParagraph,
      }
    }
    if (block.key === "cta" && input.context.recommendedCtas.length > 0 && paragraphs.ctaParagraph) {
      return {
        ...block,
        blockId: "industry_playbook_cta",
        label: "Playbook CTA",
        text: paragraphs.ctaParagraph,
      }
    }
    return block
  })

  return blocks
}

export function industryPlaybookUsedInBlocks(blocks: SelectedMessageBlock[]): boolean {
  return blocks.some((block) => block.blockId.startsWith("industry_playbook_") || block.blockId === "opening_playbook_minimal")
}
