"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// Mensagens genéricas de propósito: não revelam se o e-mail existe.
function messageFor(error: { status: number; code?: string }): string {
  if (error.status === 429) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  if (error.code === "BANNED_USER") return "Conta desativada. Fale com o administrador.";
  if (error.status === 401 || error.status === 400) return "E-mail ou senha incorretos.";
  return "Não foi possível entrar agora. Tente novamente.";
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { error } = await authClient.signIn.email({
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
      });
      if (error) {
        setError(messageFor({ status: error.status, code: error.code }));
        return;
      }
      router.replace("/home");
      router.refresh();
    } catch {
      setError("Não foi possível entrar agora. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="animate-enter w-full max-w-sm" accent="primary">
      <CardHeader>
        <CardTitle className="text-lg">Entrar</CardTitle>
        <CardDescription>Use seu e-mail e senha corporativos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5 text-sm">
            E-mail
            <Input name="email" type="email" autoComplete="username" required aria-invalid={!!error} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Senha
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={!!error}
            />
          </label>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
            {error}
          </p>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
