import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-border bg-white px-3 py-2 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]',
        'dark:bg-card',
        'placeholder:text-muted-foreground',
        'hover:border-foreground/15 dark:hover:border-foreground/25',
        'focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20',
        'focus-visible:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
        'read-only:bg-zinc-50 read-only:text-foreground dark:read-only:bg-muted/30',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
