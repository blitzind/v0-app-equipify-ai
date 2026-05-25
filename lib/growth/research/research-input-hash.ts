import { createHash } from "node:crypto"

export function buildProspectResearchInputHash(input: {
  companyName: string
  website: string | null
  rebuild?: boolean
}): string {
  const payload = `${input.companyName.trim().toLowerCase()}|${(input.website ?? "").trim().toLowerCase()}|${input.rebuild ? "rebuild" : "run"}`
  return createHash("sha256").update(payload).digest("hex").slice(0, 32)
}
