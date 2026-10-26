import { DatabaseIcon, FileTextIcon, GlobeIcon, ShieldIcon, type LucideIcon } from "lucide-react";
import type { AppModule } from "@/lib/modules";

// Ícones por módulo (documento, globo, banco de dados, escudo), conforme o Bloco 0 do prompt.
export const MODULE_ICON: Record<AppModule["key"], LucideIcon> = {
  documentos: FileTextIcon,
  pesquisa: GlobeIcon,
  chat: DatabaseIcon,
  admin: ShieldIcon,
};
