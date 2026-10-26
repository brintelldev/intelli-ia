"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

const ROLE_BADGE = { Admin: "admin", Analista: "search", Leitor: "secondary" } as const;

export function UserMenuClient({ name, role, className }: { name: string; role: Role; className?: string }) {
  const router = useRouter();

  async function logout() {
    await authClient.signOut().catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu de ${name}`}
        className={cn(
          "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <UserAvatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col items-start gap-1.5 py-2">
            <span className="text-sm font-medium text-text-primary">{name}</span>
            <Badge variant={ROLE_BADGE[role]}>{role}</Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
