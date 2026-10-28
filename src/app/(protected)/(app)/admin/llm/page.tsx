import { RoleGate } from "@/components/auth/RoleGate";
import { LlmPanel } from "@/components/admin/LlmPanel";

export default function Page() {
  return (
    <RoleGate roles={["Admin"]}>
      <LlmPanel />
    </RoleGate>
  );
}
