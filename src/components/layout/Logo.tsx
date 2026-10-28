import { cn } from "@/lib/utils";

// Marca geométrica inline (sem emoji, sem imagem): hexágono com um núcleo.
export function Logo({ className, textClassName }: { className?: string; textClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5L12 2.5Z"
          stroke="var(--accent-primary)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="var(--accent-primary)" />
      </svg>
      <span className={textClassName}>Intelli Insights</span>
    </span>
  );
}
