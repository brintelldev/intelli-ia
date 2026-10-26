import { RoleGate } from "@/components/auth/RoleGate";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export default function Page() {
  return (
    <RoleGate roles={["Admin", "Analista", "Leitor"]}>
      <ModulePlaceholder title="Chat RAG" />
    </RoleGate>
  );
}
