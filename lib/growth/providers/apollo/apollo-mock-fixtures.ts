/** Apollo mock people fixtures — no API credits. Client-safe. */

import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"

export function buildApolloMockPeople(input: {
  company_name: string
  domain: string | null
  limit?: number
}): ApolloPersonRecord[] {
  const orgName = input.company_name.trim() || "Example Co"
  const domain = input.domain ?? "example.com"
  const orgId = `mock-org-${domain.replace(/\W/g, "-")}`

  const fixtures: ApolloPersonRecord[] = [
    {
      id: `mock-apollo-person-1-${domain}`,
      first_name: "Alex",
      last_name: "Rivera",
      name: "Alex Rivera",
      title: "Director of Operations",
      linkedin_url: "https://www.linkedin.com/in/mock-alex-rivera",
      email: `alex.rivera@${domain}`,
      email_status: "verified",
      sanitized_phone: "+15551234001",
      seniority: "director",
      departments: ["operations"],
      functions: ["operations"],
      organization: {
        id: orgId,
        name: orgName,
        primary_domain: domain,
        website_url: `https://${domain}`,
      },
      organization_id: orgId,
    },
    {
      id: `mock-apollo-person-2-${domain}`,
      first_name: "Jordan",
      last_name: "Chen",
      name: "Jordan Chen",
      title: "Biomedical Equipment Manager",
      linkedin_url: "https://www.linkedin.com/in/mock-jordan-chen",
      email: `j.chen@${domain}`,
      email_status: "guessed",
      seniority: "manager",
      departments: ["clinical engineering"],
      functions: ["operations"],
      organization: {
        id: orgId,
        name: orgName,
        primary_domain: domain,
      },
      organization_id: orgId,
    },
    {
      id: `mock-apollo-person-3-${domain}`,
      first_name: "Support",
      last_name: "",
      name: "Support",
      title: "Help Desk",
      email: `support@${domain}`,
      email_status: "verified",
      organization: { id: orgId, name: orgName, primary_domain: domain },
    },
  ]

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 25)
  return fixtures.slice(0, limit)
}
