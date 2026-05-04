import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Surface & typography (enabled editable fields)
        'min-h-9 h-9 w-full min-w-0 rounded-md border border-border bg-white px-3 py-1 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]',
        'dark:bg-card',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'hover:border-foreground/15 dark:hover:border-foreground/25',
        'focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20',
        'focus-visible:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
        'read-only:bg-zinc-50 read-only:text-foreground dark:read-only:bg-muted/30',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
