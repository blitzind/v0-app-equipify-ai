import "server-only"

import { qbFetchJson } from "@/lib/integrations/quickbooks/api"

type QueryResp = {
  QueryResponse?: {
    Account?: Array<{ Id?: string; Name?: string }>
  }
  Fault?: { Error?: Array<{ Message?: string }> }
}

/**
 * Picks a revenue/income account for Item IncomeAccountRef (required for Products/Services).
 */
export async function resolveDefaultIncomeAccountId(params: {
  realmId: string
  accessToken: string
  onUnauthorized?: () => Promise<string | null>
}): Promise<string | null> {
  const attempts = [
    "select Id from Account where AccountType = 'Income' and Active = true STARTPOSITION 1 MAXRESULTS 1",
    "select Id from Account where Classification = 'Revenue' and Active = true STARTPOSITION 1 MAXRESULTS 1",
  ]

  for (const sql of attempts) {
    const r = await qbFetchJson<QueryResp>({
      realmId: params.realmId,
      accessToken: params.accessToken,
      method: "GET",
      resourcePath: "query",
      searchParams: { query: sql },
      onUnauthorized: params.onUnauthorized,
    })
    const id = r.data?.QueryResponse?.Account?.[0]?.Id
    if (id) return String(id)
  }

  return null
}
