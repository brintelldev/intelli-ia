import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { roles } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Sem cadastro público: contas só nascem pelo Admin (plugin admin) ou pelo seed.
  emailAndPassword: { enabled: true, disableSignUp: true },

  // 8h (PRD 4). A sessão fica no banco e NÃO usamos cookieCache: assim a troca de role ou o
  // banimento vale já na próxima requisição (com cache de cookie valeria só depois de expirar).
  session: { expiresIn: 60 * 60 * 8 },

  user: {
    additionalFields: {
      modelOverride: { type: "string", required: false, input: false },
      costLimitDay: { type: "number", required: false, input: false },
      lastAccessAt: { type: "date", required: false, input: false },
    },
  },

  // Força bruta no login: 5 tentativas por minuto por IP (T-06b). Ligado também em dev.
  // ponytail: contador em memória, vale para 1 instância (é o nosso caso). Com várias réplicas
  // trocar para storage: "database". Atrás do Nginx o IP vem de X-Forwarded-For (já repassado).
  rateLimit: { enabled: true, customRules: { "/sign-in/email": { window: 60, max: 5 } } },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // lastAccessAt é só informativo: falhar aqui nunca pode impedir o login.
          await prisma.user
            .update({ where: { id: session.userId }, data: { lastAccessAt: new Date() } })
            .catch(() => {});
        },
      },
    },
  },

  // Perfis: Admin | Analista | Leitor. Os 3 PRECISAM estar em `roles` (ver lib/auth-roles.ts).
  plugins: [admin({ roles, defaultRole: "Leitor", adminRoles: ["Admin"] }), nextCookies()],
});

export type Auth = typeof auth;
