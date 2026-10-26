import { isRole } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { UserMenuClient } from "./UserMenuClient";

// Wrapper de servidor: lê a sessão (por isso deve ficar dentro de <Suspense>) e entrega ao menu.
export async function UserMenu({ className }: { className?: string }) {
  const session = await getSession();
  const role = session?.user.role;
  if (!session || !isRole(role)) return null;
  return <UserMenuClient name={session.user.name} role={role} className={className} />;
}
