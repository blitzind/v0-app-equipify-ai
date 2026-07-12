/**
 * GE-AIOS-CONTACT-1A — DataMoon email & phone completion certification.
 * Run: pnpm test:ge-aios-contact-1a-datamoon-email-phone-completion
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "path"
import {
  extractDatamoonContactChannels,
  GROWTH_AIOS_CONTACT_1A_QA_MARKER,
  projectContactChannelReadiness,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels"
import { evaluateDecisionMakerContactReadiness } from "../lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import { normalizeDatamoonRecordsToDecisionMakerCandidates } from "../lib/growth/datamoon-decision-maker/datamoon-dm-normalize"
import { evaluateCanonicalPersonEmailPromotion } from "../lib/growth/email-discovery/email-discovery-integrity-rules"
import { evaluateCanonicalPersonPhonePromotion } from "../lib/growth/phone-discovery/phone-discovery-integrity-rules"
import { mapAiOsEventToDraftFactoryWakePlans } from "../lib/growth/draft-factory/draft-factory-wake-event-mapper"
import { isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import { GROWTH_AI_EVENT_QA_MARKER } from "../lib/growth/aios/ai-event-types"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"

const ROOT = process.cwd()
const PHASE = "GE-AIOS-CONTACT-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleEvent(overrides: Partial<AiOsEvent> = {}): AiOsEvent {
  return {
    id: "evt-1",
    eventType: "growth.contact.available",
    eventVersion: 1,
    schemaVersion: "1.0",
    category: "system",
    organizationId: "org-1",
    missionId: null,
    workOrderId: null,
    agentOwner: null,
    entityType: "lead",
    entityId: "lead-1",
    correlationId: "corr-1",
    causationId: null,
    priority: 500,
    producer: "test",
    source: "test",
    payload: {
      lead_id: "lead-1",
      canonical_person_id: "person-1",
      channel: "email",
      verification_status: "unverified",
      source_run_id: "run-1",
    },
    metadata: {},
    auditMetadata: {},
    lifecycle: "published",
    replayable: true,
    replayKey: "contact-available:org-1:lead-1:email:run-1",
    occurredAt: "2026-07-12T22:00:00.000Z",
    createdAt: "2026-07-12T22:00:00.000Z",
    qaMarker: GROWTH_AI_EVENT_QA_MARKER,
    ...overrides,
  }
}

console.log(`[${PHASE}] DataMoon email & phone completion certification`)
assert.equal(GROWTH_AIOS_CONTACT_1A_QA_MARKER, "ge-aios-contact-1a-datamoon-email-phone-completion-v1")

// --- Fixture matrix: email-only / phone-only / switchboard-only / empty ---
{
  const emailOnly = extractDatamoonContactChannels({ business_email: "ops@clinic.example" })
  assert.equal(emailOnly.primaryEmail, "ops@clinic.example")
  assert.equal(emailOnly.primaryPhone, null)
  assert.equal(projectContactChannelReadiness({ emails: emailOnly.emails }).state, "email_available_unverified")

  const mobileOnly = extractDatamoonContactChannels({ mobile_phone: "+1-555-444-3333" })
  assert.equal(mobileOnly.primaryPhone, "5554443333")
  assert.equal(mobileOnly.primaryEmail, null)
  assert.equal(
    projectContactChannelReadiness({ phones: mobileOnly.phones }).state,
    "phone_available_unverified",
  )

  const switchboardOnly = extractDatamoonContactChannels({ company_phone: "5550001111" })
  assert.equal(switchboardOnly.primaryPhone, null)
  assert.equal(
    projectContactChannelReadiness({ phones: switchboardOnly.phones }).state,
    "no_usable_channel",
  )

  const empty = extractDatamoonContactChannels({ first_name: "No", last_name: "Contact" })
  assert.equal(empty.emails.length, 0)
  assert.equal(empty.phones.length, 0)
  assert.equal(projectContactChannelReadiness({}).state, "no_usable_channel")
  console.log("  ✓ fixture matrix: email-only / mobile-only / switchboard-only / empty")
}

// --- Fixture: verified-shaped work email + direct phone ---
{
  const channels = extractDatamoonContactChannels({
    id: "dm-1",
    first_name: "Alex",
    last_name: "Owner",
    business_email: "Alex.Owner@Imaging.Example",
    personal_emails: "alex.personal@gmail.com, other@example.com",
    personal_phone: "+1 (555) 123-4567 ext. 42",
    mobile_phone: "5551234567",
    linkedin_url: "https://www.linkedin.com/in/alex-owner",
    company_name: "Imaging Example",
  })
  assert.equal(channels.emails.length, 3)
  assert.equal(channels.emails[0]?.normalized, "alex.owner@imaging.example")
  assert.equal(channels.emails[0]?.emailType, "work")
  assert.ok(channels.phones.some((phone) => phone.normalized === "5551234567"))
  assert.ok(channels.phones.some((phone) => phone.extension === "42"))
  assert.equal(channels.primaryEmail, "alex.owner@imaging.example")
  assert.equal(channels.rejectedEmails.length, 0)
  console.log("  ✓ work email + phones normalized; extension preserved; emails deduped by normalized form")
}

// --- Multiple phone formats resolve to one ---
{
  const channels = extractDatamoonContactChannels({
    personal_phone: "(555) 987-6543",
    mobile_phone: "+15559876543",
    work_phone: "555-987-6543",
  })
  assert.equal(channels.phones.length, 1)
  assert.equal(channels.phones[0]?.normalized, "5559876543")
  assert.equal(channels.phones[0]?.e164, "+15559876543")
  console.log("  ✓ multiple phone formats resolve to one canonical phone")
}

// --- Company switchboard not person direct ---
{
  const channels = extractDatamoonContactChannels({
    company_phone: "5551112222",
    personal_phone: "5553334444",
  })
  assert.equal(channels.phones.filter((p) => p.isCompanySwitchboard).length, 1)
  assert.equal(channels.primaryPhone, "5553334444")
  console.log("  ✓ company switchboard not selected as person primary phone")
}

// --- Invalid email / malformed phone rejected ---
{
  const channels = extractDatamoonContactChannels({
    business_email: "not-an-email",
    personal_phone: "123",
  })
  assert.equal(channels.emails.length, 0)
  assert.ok(channels.rejectedEmails.includes("not-an-email"))
  assert.equal(channels.phones.length, 0)
  assert.ok(channels.rejectedPhones.length >= 1)
  console.log("  ✓ invalid email/phone rejected — no fabrication")
}

// --- Candidate normalize preserves all channels ---
{
  const ranked = normalizeDatamoonRecordsToDecisionMakerCandidates({
    records: [
      {
        id: "r1",
        first_name: "Sam",
        last_name: "Boss",
        title: "Owner",
        business_email: "sam@clinic.example",
        personal_emails: "sam@clinic.example, sam.alt@clinic.example",
        mobile_phone: "5552223333",
        company_name: "Clinic Example",
        company_domain: "clinic.example",
      },
    ],
    expectedCompanyDomain: "clinic.example",
    expectedCompanyName: "Clinic Example",
  })
  assert.equal(ranked.length, 1)
  assert.ok((ranked[0]?.emails.length ?? 0) >= 2)
  assert.equal(ranked[0]?.email, "sam@clinic.example")
  assert.equal(ranked[0]?.phone, "5552223333")
  assert.ok((ranked[0]?.phones.length ?? 0) >= 1)
  console.log("  ✓ DM candidates retain multi-email/phone channels through ranking")
}

// --- Readiness states ---
{
  const emailReady = projectContactChannelReadiness({
    emails: [{ normalized: "a@b.co", verificationStatus: "unverified" }],
  })
  assert.equal(emailReady.state, "email_available_unverified")
  assert.equal(emailReady.unblocksEmailDrafting, true)
  assert.equal(emailReady.emailVerified, false)

  const phoneOnly = projectContactChannelReadiness({
    phones: [{ normalized: "5551112222", verificationStatus: "unverified" }],
  })
  assert.equal(phoneOnly.state, "phone_available_unverified")
  assert.equal(phoneOnly.unblocksCallPackage, true)
  assert.equal(phoneOnly.unblocksEmailDrafting, false)

  const none = projectContactChannelReadiness({})
  assert.equal(none.state, "no_usable_channel")

  const engine = evaluateDecisionMakerContactReadiness({
    email: "a@b.co",
    phone: null,
  })
  assert.equal(engine.readinessState, "email_available_unverified")
  assert.equal(engine.hasVerifiedEmail, false)
  assert.equal(engine.emailAvailable, true)
  console.log("  ✓ readiness: email-available / phone-only / no-channel (never fake-verified)")
}

// --- Integrity: verified not overwritten by weaker ---
{
  const emailBlock = evaluateCanonicalPersonEmailPromotion({
    existing: {
      person_id: "p1",
      normalized_email: "a@b.co",
      confidence: 0.9,
      verification_status: "verified",
      metadata: {},
    },
    target_person_id: "p1",
    incoming_confidence: 0.4,
    incoming_verification_status: "unverified",
  })
  assert.equal(emailBlock.allowed, false)

  const phoneBlock = evaluateCanonicalPersonPhonePromotion({
    existing: {
      person_id: "p1",
      normalized_phone: "5551112222",
      confidence: 0.9,
      verification_status: "verified",
      metadata: {},
    },
    target_person_id: "p1",
    incoming_confidence: 0.2,
    incoming_verification_status: "unverified",
  })
  assert.equal(phoneBlock.allowed, false)

  const emailUpgrade = evaluateCanonicalPersonEmailPromotion({
    existing: {
      person_id: "p1",
      normalized_email: "a@b.co",
      confidence: 0.3,
      verification_status: "unverified",
      metadata: {},
    },
    target_person_id: "p1",
    incoming_confidence: 0.8,
    incoming_verification_status: "unverified",
  })
  assert.equal(emailUpgrade.allowed, true)
  console.log("  ✓ verified contacts retained; stronger evidence can improve weaker records")
}

// --- Events registered + mapper ---
assert.ok(isRegisteredAiEventType("growth.contact.available"))
assert.ok(isRegisteredAiEventType("growth.contact.verified"))
assert.ok(isRegisteredAiEventType("growth.contact.verification_failed"))
assert.ok(isRegisteredAiEventType("growth.datamoon.person_completed"))

const availablePlans = mapAiOsEventToDraftFactoryWakePlans(sampleEvent())
assert.equal(availablePlans[0]?.kind, "lead")
if (availablePlans[0]?.kind === "lead") {
  assert.equal(availablePlans[0].wakeType, "contact_verified")
  assert.equal(availablePlans[0].leadId, "lead-1")
}
console.log("  ✓ contact events registered; available → one-stage DF wake")

// --- Wiring / no Apollo / reuse ---
const persist = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-canonical-contact-persist.ts")
assert.ok(persist.includes("resolveCanonicalPerson"))
assert.ok(persist.includes("upsertCanonicalPersonEmail"))
assert.ok(persist.includes("upsertCanonicalPersonPhone"))
assert.ok(persist.includes("evaluateCanonicalPersonEmailPromotion"))
assert.ok(persist.includes("evaluateCanonicalPersonPhonePromotion"))
assert.ok(persist.includes("recomputeGrowthLeadDecisionMakerStatus"))
assert.ok(persist.includes("public_web"))
assert.ok(persist.includes("datamoon:person_enrichment"))
assert.ok(!/apollo/i.test(persist))

const service = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-service.ts")
assert.ok(service.includes("persistDatamoonDecisionMakerCanonicalContacts"))
assert.ok(service.includes("publishDraftFactoryContactAvailable"))
assert.ok(!/apollo/i.test(service))

const emitters = readSource("lib/growth/draft-factory/draft-factory-wake-emitters.ts")
assert.ok(emitters.includes("growth.contact.available"))
assert.ok(emitters.includes("canonical_person_id"))

const live = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.ok(live.includes("GE-AIOS-CONTACT-1A"))
assert.ok(live.includes("contactVerifiedForEmail"))

assert.ok(!readSource("lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels.ts").includes("apollo"))
assert.ok(!readSource("vercel.json").includes("draft-factory"))
console.log("  ✓ canonical persist wired; provenance public_web+datamoon detail; no Apollo; no outbound cron")

// --- Docs ---
assert.ok(fs.existsSync(path.join(ROOT, "docs/GE-AIOS-CONTACT-1A_DATAMOON_EMAIL_PHONE_COMPLETION.md")))

console.log(`[${PHASE}] PASS`)
