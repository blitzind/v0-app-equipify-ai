import { redirect } from "next/navigation"

/** Legacy URL: opens Daily Dispatch drawer on the Technicians page. */
export default function TechnicianDailyRedirectPage() {
  redirect("/technicians?dispatch=1")
}
