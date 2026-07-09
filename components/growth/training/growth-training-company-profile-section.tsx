"use client"

import Link from "next/link"
import { GrowthHomeBusinessProfileSection } from "@/components/growth/workspace/executive-briefing/growth-home-business-profile-section"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"
import { GROWTH_TRAINING_COMPANY_PROFILE_TITLE } from "@/lib/growth/training/growth-training-workspace-types"

export function GrowthTrainingCompanyProfileSection() {
  return (
    <GrowthTrainingSectionCard
      title={GROWTH_TRAINING_COMPANY_PROFILE_TITLE}
      description="Who are we? Facts about your company, ideal customers, and market — no philosophy or messaging."
      qaSection="training-company-profile"
    >
      <GrowthHomeBusinessProfileSection embedded />
    </GrowthTrainingSectionCard>
  )
}
