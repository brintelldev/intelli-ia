import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Acesso negado · Intelli AI" };

export default function ForbiddenPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" stroke="var(--accent-admin)" strokeWidth="1.6" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="var(--accent-admin)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="15.5" r="1.4" fill="var(--accent-admin)" />
      </svg>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Acesso negado</h1>
        <p className="max-w-sm text-text-secondary">
          Seu perfil não tem permissão para abrir esta página. Se precisar dela, peça acesso ao administrador.
        </p>
      </div>
      <Link href="/home" className={buttonVariants({ size: "lg" })}>
        Voltar ao início
      </Link>
    </main>
  );
}
