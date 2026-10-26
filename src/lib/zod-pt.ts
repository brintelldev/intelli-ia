import { z } from "zod";

// Mensagens de validação do zod em português (as que o usuário vê num 400). Efeito colateral de importação:
// toda rota que valida corpo com zod faz `import "@/lib/zod-pt"`. Mensagens escritas à mão no schema (ex.:
// "Dê um nome ao modelo") continuam valendo; isto só cobre as geradas pelo zod.
z.config(z.locales.ptBR());
