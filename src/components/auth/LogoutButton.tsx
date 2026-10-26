"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** `labelClassName` permite esconder o texto em telas estreitas (fica só o ícone, com aria-label). */
export function LogoutButton({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await authClient.signOut().catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={logout} disabled={pending} className={className} aria-label="Sair">
      <LogOutIcon aria-hidden="true" />
      <span className={cn(labelClassName)}>{pending ? "Saindo…" : "Sair"}</span>
    </Button>
  );
}
