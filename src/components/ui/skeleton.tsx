import { cn } from "cn"

// Loading states usam shimmer (ver @utility skeleton-shimmer em globals.css), não spinners.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-surface-raised", className)}
      {...props}
    />
  )
}

export { Skeleton }
