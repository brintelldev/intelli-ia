import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isRole, type Role } from "@/lib/rbac";
import { getSession } from "@/lib/session";

// Barreira de página (defesa em profundidade além do proxy). Ler a sessão é leitura de
// requisição, então com Cache Components precisa ficar dentro de <Suspense>.
export function RoleGate({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  return (
    <Suspense fallback={<GateFallback />}>
      <Check roles={roles}>{children}</Check>
    </Suspense>
  );
}

async function Check({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const role = session.user.role;
  if (!isRole(role) || !roles.includes(role)) redirect("/403");
  return children;
}

function GateFallback() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-8" role="status" aria-label="Carregando">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
