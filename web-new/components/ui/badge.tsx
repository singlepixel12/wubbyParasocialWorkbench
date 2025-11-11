import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Platform-specific variants
        kick:
          "border-transparent bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 [a&]:hover:bg-green-100 dark:[a&]:hover:bg-green-500/20",
        "kick-solid":
          "border-transparent bg-[#1e7e34] text-white [a&]:hover:bg-[#1e7e34]/90",
        twitch:
          "border-transparent bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 [a&]:hover:bg-purple-100 dark:[a&]:hover:bg-purple-500/20",
        "twitch-solid":
          "border-transparent bg-[#6441A5] text-white [a&]:hover:bg-[#6441A5]/90",
        tag:
          "border-transparent bg-gray-50 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400 [a&]:hover:bg-gray-100 dark:[a&]:hover:bg-gray-500/20",
        "tag-solid":
          "border-transparent bg-[#666] text-white [a&]:hover:bg-[#666]/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
