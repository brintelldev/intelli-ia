import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/RoleGate";
import { DocumentosWorkspace } from "@/components/documentos/DocumentosWorkspace";

export const metadata: Metadata = { title: "Análise de Documentos · Intelli Insights" };

export default function Page() {
  return (
    <RoleGate roles={["Admin", "Analista"]}>
      <DocumentosWorkspace />
    </RoleGate>
  );
}
