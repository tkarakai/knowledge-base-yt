import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const textareaVariants = cva(
  "flex w-full rounded-md border bg-muted/50 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
  {
    variants: {
      variant: {
        default: "border-input",
        error: "border-destructive focus-visible:ring-destructive",
      },
      textareaSize: {
        sm: "min-h-[60px] px-2.5 py-1.5 text-xs",
        md: "min-h-[90px] px-3 py-2",
        lg: "min-h-[130px] px-4 py-3 text-base",
      },
    },
    defaultVariants: { variant: "default", textareaSize: "md" },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

function Textarea({
  className,
  variant,
  textareaSize,
  ref,
  ...props
}: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(textareaVariants({ variant, textareaSize, className }))}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
