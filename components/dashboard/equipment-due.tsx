import { CalendarClock, ChevronRight } from "lucide-react"
import { equipmentDueSoon } from "@/lib/mock-data"

export function EquipmentDue() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Equipment Due This Month</h2>
        <button className="text-xs font-medium text-primary hover:underline">View schedule</button>
      </div>
      <ul className="divide-y divide-border">
        {equipmentDueSoon.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 shrink-0">
              <CalendarClock className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground truncate">{item.customer} &middot; {item.type}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-foreground">{item.nextService}</p>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
