"use client"

import { CalendarClock, ChevronRight } from "lucide-react"
import { equipmentDueSoon } from "@/lib/mock-data"

export function EquipmentDue() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Equipment Due This Month</h2>
        <button className="text-xs font-medium text-primary hover:underline transition-colors">View schedule</button>
      </div>
      {equipmentDueSoon.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <CalendarClock className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No services due this month</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {equipmentDueSoon.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-colors duration-100"
              style={{ backgroundColor: "var(--card)" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--primary) 3%, var(--card))")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 shrink-0 transition-transform duration-150 group-hover:scale-105">
                <CalendarClock className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.customer} &middot; {item.type}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <p className="text-xs font-medium text-foreground ds-tabular">{item.nextService}</p>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
