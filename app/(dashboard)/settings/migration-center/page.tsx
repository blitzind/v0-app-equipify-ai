import { redirect } from "next/navigation"

/** Bookmark-friendly alias for the Migration center hub. */
export default function MigrationCenterRedirectPage() {
  redirect("/settings/imports")
}
