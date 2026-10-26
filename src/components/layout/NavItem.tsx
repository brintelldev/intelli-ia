"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ACCENT_CLASS, type Accent } from "@/lib/modules";
import { cn } from "@/lib/utils";

// Barra fina no topo enquanto a navegação não conclui (no lugar de spinner). useLinkStatus só
// funciona dentro de um <Link>, por isso o componente fica dentro do NavItem.
function LinkProgress({ accent }: { accent: Accent }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("nav-progress fixed inset-x-0 top-0 z-50 h-0.5 md:left-16 xl:left-60", ACCENT_CLASS[accent].bg)}
    />
  );
}

type Props = {
  href: string;
  label: string;
  accent: Accent;
  icon: ReactNode;
  /** prefixo que marca o item como ativo (ex.: "/admin" para o link /admin/dashboard) */
  match?: string;
  variant?: "side" | "bottom";
};

export function NavItem({ href, label, accent, icon, match = href, variant = "side" }: Props) {
  const pathname = usePathname();
  const active = pathname === match || pathname.startsWith(match + "/");
  const c = ACCENT_CLASS[accent];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "relative flex items-center transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "side" &&
          cn(
            "h-10 justify-center gap-3 border-l-2 px-3 xl:justify-start",
            active
              ? cn("bg-surface-raised", c.border, c.text)
              : "border-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary",
          ),
        variant === "bottom" &&
          cn(
            "h-16 flex-1 flex-col justify-center gap-1 text-[11px] font-medium",
            active ? cn("border-t-2", c.border, c.text) : "border-t-2 border-transparent text-text-secondary",
          ),
      )}
    >
      {icon}
      <span className={cn(variant === "side" && "hidden xl:inline", "text-sm", variant === "bottom" && "text-[11px]")}>
        {label}
      </span>
      <LinkProgress accent={accent} />
    </Link>
  );
}
