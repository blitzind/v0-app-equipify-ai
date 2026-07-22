/**
 * FUZOR-ADOPTION-1B — Identity actor catalog delegation parity.
 * Run: pnpm test:fuzor-adoption-1b-identity-actor-catalog
 */
import assert from "node:assert/strict"

import {
  PLATFORM_ACTOR_AGENTS,
  isPlatformActorAgent,
  isPlatformExecutiveBrainAgent,
  type PlatformActorAgent,
} from "@fuzor/identity"

import {
  AI_WORK_ORDER_AGENTS,
  isAiWorkOrderAgent,
  isExecutiveBrainAgent,
  type AiWorkOrderAgent,
} from "../lib/growth/aios/ai-work-order-types"

function assertTypeCompatibility(): void {
  const fromEquipify: AiWorkOrderAgent = "research"
  const fromFuzor: PlatformActorAgent = fromEquipify
  const backToEquipify: AiWorkOrderAgent = fromFuzor
  assert.equal(backToEquipify, "research")
}

console.log("[FUZOR-ADOPTION-1B] Identity actor catalog delegation parity")

assert.strictEqual(AI_WORK_ORDER_AGENTS, PLATFORM_ACTOR_AGENTS)
assert.deepEqual([...AI_WORK_ORDER_AGENTS], [...PLATFORM_ACTOR_AGENTS])
assert.equal(AI_WORK_ORDER_AGENTS.length, 17)
assert.equal(new Set(AI_WORK_ORDER_AGENTS).size, 17)
assert.equal(AI_WORK_ORDER_AGENTS.at(-1), "executive_brain")
assert.equal(JSON.stringify([...AI_WORK_ORDER_AGENTS]), JSON.stringify([...PLATFORM_ACTOR_AGENTS]))

for (const agent of PLATFORM_ACTOR_AGENTS) {
  assert.equal(isAiWorkOrderAgent(agent), true, `expected valid agent: ${agent}`)
  assert.equal(isPlatformActorAgent(agent), true, `expected valid platform agent: ${agent}`)
}

const invalidValues: unknown[] = ["", "invalid", "Executive_Brain", null, undefined, 0, {}, []]
for (const value of invalidValues) {
  assert.equal(isAiWorkOrderAgent(value), false)
  assert.equal(isPlatformActorAgent(value), false)
}

for (const agent of PLATFORM_ACTOR_AGENTS) {
  assert.equal(
    isExecutiveBrainAgent(agent),
    isPlatformExecutiveBrainAgent(agent),
    `executive-brain mismatch for ${agent}`,
  )
}

assertTypeCompatibility()

console.log("[FUZOR-ADOPTION-1B] PASS")
