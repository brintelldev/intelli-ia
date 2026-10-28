import { RoleGate } from "@/components/auth/RoleGate";
import { MetricsDashboard } from "@/components/admin/MetricsDashboard";

export default function Page() {
  return (
    <RoleGate roles={["Admin", "Analista"]}>
      <MetricsDashboard />
    </RoleGate>
  );
}
