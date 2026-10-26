// Importado PRIMEIRO pelos scripts: o import hoisting executa módulos na ordem, e src/lib/prisma.ts
// lê DATABASE_URL assim que é carregado. Mesmo critério do prisma.config.ts e do seed.
import { config } from "dotenv";

config({ path: ".env.local" });
config();
