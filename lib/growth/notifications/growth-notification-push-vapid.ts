import "server-only"

import webpush from "web-push"

export type GrowthOperatorPushVapidConfig = {
  publicKey: string
  privateKey: string
  subject: string
}

export function resolveGrowthOperatorPushVapidConfig():
  | GrowthOperatorPushVapidConfig
  | null {
  const publicKey = process.env.GROWTH_OPERATOR_PUSH_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.GROWTH_OPERATOR_PUSH_VAPID_PRIVATE_KEY?.trim()
  const subject =
    process.env.GROWTH_OPERATOR_PUSH_VAPID_SUBJECT?.trim() ||
    process.env.GROWTH_OPERATOR_PUSH_VAPID_CONTACT?.trim() ||
    "mailto:support@equipify.com"

  if (!publicKey || !privateKey) return null

  return { publicKey, privateKey, subject }
}

export function configureGrowthOperatorWebPush(): GrowthOperatorPushVapidConfig | null {
  const config = resolveGrowthOperatorPushVapidConfig()
  if (!config) return null
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  return config
}
