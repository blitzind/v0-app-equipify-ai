import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  Bell,
  CalendarClock,
  Mail,
  MessageSquare,
  Receipt,
  FileText,
  Radio,
  Wrench,
} from "lucide-react"

/** Icon + accent class for lists (top bar + communications center). */
export function communicationEventPresentation(eventType: string, channel: string): {
  Icon: LucideIcon
  iconColor: string
} {
  if (channel === "email") return { Icon: Mail, iconColor: "text-primary" }
  if (channel === "sms") return { Icon: MessageSquare, iconColor: "text-emerald-600" }
  if (channel === "push") return { Icon: Radio, iconColor: "text-violet-600" }

  switch (eventType) {
    case "work_order_reminder":
      return { Icon: Wrench, iconColor: "text-[color:var(--status-warning)]" }
    case "maintenance_reminder":
      return { Icon: CalendarClock, iconColor: "text-primary" }
    case "quote_follow_up":
      return { Icon: FileText, iconColor: "text-[color:var(--status-info)]" }
    case "invoice_reminder":
      return { Icon: Receipt, iconColor: "text-amber-700" }
    case "invoice_email":
    case "quote_email":
    case "work_order_summary_email":
      return { Icon: Mail, iconColor: "text-primary" }
    default:
      return { Icon: channel === "system" ? Bell : AlertCircle, iconColor: "text-muted-foreground" }
  }
}
