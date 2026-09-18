"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "../../lib/utils"

function Label({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    />
  )
}

export { Label }
