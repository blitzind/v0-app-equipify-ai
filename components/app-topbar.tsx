"use client"

import { useState } from "react"
import { Bell, Search, ChevronDown, Settings, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const notifications = [
  { id: 1, title: "Overdue: WO-2038", desc: "Crane #CR-02 repair past due", time: "5m ago", unread: true },
  { id: 2, title: "Repeat Repair Alert", desc: "CNC Machine #CNC-3 flagged (4 repairs)", time: "1h ago", unread: true },
  { id: 3, title: "Warranty Expiring", desc: "Excavator #EX-4 expires in 15 days", time: "3h ago", unread: true },
  { id: 4, title: "WO-2039 Completed", desc: "Tyler Oakes closed HVAC inspection", time: "5h ago", unread: false },
]

export function AppTopbar({ title }: { title: string }) {
  const [searchFocused, setSearchFocused] = useState(false)
  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <header className="flex items-center h-16 px-6 bg-card border-b border-border gap-4 shrink-0">
      {/* Page title */}
      <h1 className="text-base font-semibold text-foreground mr-4 shrink-0">{title}</h1>

      {/* Search */}
      <div
        className={cn(
          "flex items-center gap-2 flex-1 max-w-sm rounded-md border px-3 py-1.5 transition-colors bg-background",
          searchFocused ? "border-primary ring-1 ring-primary/30" : "border-border"
        )}
      >
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search equipment, work orders, customers..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-muted transition-colors" aria-label="Notifications">
              <Bell className="w-4 h-4 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <Badge variant="secondary" className="text-xs">{unreadCount} new</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2 w-full">
                  {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <span className={cn("text-sm font-medium flex-1", !n.unread && "pl-3.5")}>{n.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{n.time}</span>
                </div>
                <p className={cn("text-xs text-muted-foreground", n.unread ? "pl-3.5" : "pl-3.5")}>{n.desc}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors" aria-label="User menu">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                AJ
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight">Alex Johnson</p>
                <p className="text-xs text-muted-foreground leading-tight">Admin</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <User className="w-4 h-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <Settings className="w-4 h-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
