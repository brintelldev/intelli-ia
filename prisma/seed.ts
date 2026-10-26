// Seed idempotente: roda em todo deploy (container `migrate`) e em `prisma migrate dev`.
// Nunca sobrescreve o que o Admin alterou depois (update: {} nos upserts).
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Credenciais de demonstração (PRD 4, §3). As senhas padrão são PÚBLICAS (estão no README): num
// servidor acessível pela internet defina SEED_ADMIN_PASSWORD, SEED_ANALISTA_PASSWORD e
// SEED_LEITOR_PASSWORD no .env.production ANTES do primeiro deploy. Só valem na criação da
// conta; usuários que já existem nunca têm a senha trocada pelo seed.
const USERS = [
  { name: "Admin", email: "admin@intellisuite.com", envVar: "SEED_ADMIN_PASSWORD", fallback: "Admin@2025", role: "Admin" },
  { name: "Analista", email: "analista@intellisuite.com", envVar: "SEED_ANALISTA_PASSWORD", fallback: "Analista@2025", role: "Analista" },
  { name: "Leitor", email: "leitor@intellisuite.com", envVar: "SEED_LEITOR_PASSWORD", fallback: "Leitor@2025", role: "Leitor" },
] as const;

// Formato "provedor:modelo", chamando cada provedor direto (anthropic, openai, google).
// ⚠ Os IDs do Anthropic seguem os modelos atuais da família 5.5; os de OpenAI/Google vieram do
// catálogo público e AINDA NÃO foram conferidos com as chaves reais: scripts/check-models.ts
// (T-05) lista os modelos de cada API e falha se algum ID daqui não existir.
const PRIMARY_MODEL = "anthropic:claude-sonnet-5-5";
const FALLBACK_MODEL = "google:gemini-3.8-flash"; // barato e com saída estruturada
const MODULES = ["global", "demo1", "demo2", "demo3"] as const;

const DEFAULT_SETTINGS: Record<string, unknown> = {
  disabledProviders: [],
  contentFilters: { Leitor: true },
  globalCostLimitDay: 5,
  approvalRequired: ["brief_export"],
  presentationMode: "off",
  sharingEnabled: true,
};

const FORMAT = { tone: "tecnico", length: "medio", citations: true, detail: "resumido" };
const SYSTEM_TEMPLATES = [
  {
    module: "demo2_report",
    name: "Relatório de pesquisa",
    sections: [
      { title: "Sumário Executivo", instructions: "Visão geral do tema pesquisado." },
      { title: "Principais Achados", instructions: "Por fonte, com citação inline." },
      { title: "Fontes Governamentais", instructions: "Consolidado das fontes governamentais, se houver." },
      { title: "Fontes Acadêmicas", instructions: "Consolidado das fontes acadêmicas, se houver." },
      { title: "Divergências e Controvérsias", instructions: "Onde as fontes se contradizem." },
      { title: "Referências", instructions: "Lista numerada com URL e score de relevância." },
    ],
  },
  {
    module: "demo1_summary",
    name: "Resumo executivo",
    sections: [
      { title: "Visão geral", instructions: "O que é o documento e seu objetivo." },
      { title: "Pontos-chave", instructions: "Os pontos mais relevantes para as palavras-chave." },
      { title: "Recomendações", instructions: "Ações ou atenções sugeridas." },
    ],
  },
  {
    module: "demo1_summary",
    name: "Parecer resumido",
    sections: [
      { title: "Objeto", instructions: "Identificação do documento e escopo." },
      { title: "Metodologia", instructions: "Critérios e palavras-chave utilizados." },
      { title: "Achados", instructions: "Achados por palavra-chave, com página." },
      { title: "Conclusão", instructions: "Síntese e recomendações." },
    ],
  },
] as const;

async function seedUsers() {
  for (const u of USERS) {
    const exists = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (exists) continue; // idempotente: nunca troca senha nem role de quem já existe
    const fromEnv = process.env[u.envVar]?.trim();
    if (!fromEnv && process.env.NODE_ENV === "production") {
      console.warn(`⚠ ${u.email}: usando a senha PADRÃO (pública). Defina ${u.envVar} no .env.production.`);
    }
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: id,
            providerId: "credential",
            password: await hashPassword(fromEnv || u.fallback),
          },
        },
      },
    });
  }
}

async function seedLlmConfig() {
  for (const mod of MODULES) {
    await prisma.llmConfig.upsert({
      where: { module: mod },
      update: {},
      create: { module: mod, primaryModel: PRIMARY_MODEL, fallbackModel: FALLBACK_MODEL },
    });
  }
}

async function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }
}

async function seedTemplates() {
  for (const t of SYSTEM_TEMPLATES) {
    // @@unique com ownerId nulo não protege contra duplicata no Postgres (NULL ≠ NULL).
    const exists = await prisma.reportTemplate.findFirst({
      where: { module: t.module, name: t.name, ownerId: null },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.reportTemplate.create({
      data: { module: t.module, name: t.name, ownerId: null, sections: t.sections as never, format: FORMAT },
    });
  }
}

async function main() {
  await seedUsers();
  await seedLlmConfig();
  await seedSettings();
  await seedTemplates();
  const [users, configs, settings, templates] = await Promise.all([
    prisma.user.count(),
    prisma.llmConfig.count(),
    prisma.appSetting.count(),
    prisma.reportTemplate.count(),
  ]);
  console.log(`seed ok: ${users} usuários, ${configs} LlmConfig, ${settings} AppSetting, ${templates} modelos de seção`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
