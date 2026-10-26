import Link from "next/link";
import { cn } from "@/lib/utils";

// Aviso fixo das zonas de upload (Demo 1 e chat). Texto curto e objetivo; o detalhe está em /privacidade.
export function PrivacyNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-text-muted", className)} data-testid="privacy-notice">
      O conteúdo enviado é processado por provedores de IA externos (Anthropic, OpenAI e Google), que não o usam para
      treinar modelos. Não envie dados pessoais sensíveis.{" "}
      <Link href="/privacidade" className="underline underline-offset-2 hover:text-text-secondary">
        Saiba mais
      </Link>
    </p>
  );
}
