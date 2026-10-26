import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Entrar · Intelli AI" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo className="text-2xl" />
      <LoginForm />
      <p className="max-w-sm text-center text-xs text-text-muted">
        O acesso é concedido pelo administrador. Não há cadastro público.
      </p>
    </main>
  );
}
