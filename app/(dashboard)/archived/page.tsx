import { redirect } from "next/navigation"

/** Legacy URL — Archived Center lives under Settings. */
export default function ArchivedLegacyRedirectPage() {
  redirect("/settings/archived")
}
