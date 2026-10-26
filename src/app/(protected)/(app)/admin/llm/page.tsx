import { RoleGate } from "@/components/auth/RoleGate";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export default function Page() {
  return (
    <RoleGate roles={["Admin"]}>
      <ModulePlaceholder title="Configuração de IA" />
    </RoleGate>
  );
}
