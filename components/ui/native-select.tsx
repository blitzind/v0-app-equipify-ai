import * as React from "react"

import { formControlClassName } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Native `<select>` with the same surface tokens as {@link Input} (modals, legacy forms). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(formControlClassName, "cursor-pointer pr-9", className)}
      {...props}
    >
      {children}
    </select>
  )
}

export { NativeSelect }
