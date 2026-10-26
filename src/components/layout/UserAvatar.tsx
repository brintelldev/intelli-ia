import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-xs font-semibold text-accent-primary ring-1 ring-accent-primary/30",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
