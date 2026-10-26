"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Menu `...` de cada item: aparece no hover ou quando recebe foco do teclado.
export function ActivityMenu({ href, label }: { href: string; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Mais ações: ${label}`}
            className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href={href} />}>Abrir módulo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
