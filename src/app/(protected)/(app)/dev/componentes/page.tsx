import { notFound } from "next/navigation";
import { Demo } from "./demo";

// Vitrine dos componentes compartilhados, com dados fictícios: serve de teste visual e de regressão.
// Só existe em desenvolvimento.
export default function ComponentesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Demo />;
}
