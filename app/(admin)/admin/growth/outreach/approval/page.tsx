import { redirect } from "next/navigation"

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Phase 6.30D — legacy outreach approval UI redirects to native sequence execution approvals. */
export default async function AdminGrowthOutreachApprovalRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const entry of value) qs.append(key, entry)
    } else {
      qs.set(key, value)
    }
  }
  const suffix = qs.toString()
  redirect(`/admin/growth/sequences/execution${suffix ? `?${suffix}` : ""}`)
}
