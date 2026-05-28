import { redirect } from 'next/navigation'

/** Canonical app home is `/`; keep `/dashboard` for bookmarks and Tag Assistant QA. */
export default function DashboardAliasPage() {
  redirect('/')
}
