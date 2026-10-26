// Parte pura de lib/usage.ts (sem banco): montagem segura do evento, track que nunca falha,
// mascaramento de dados pessoais e a regra de decisão do orçamento diário. Separada para os
// testes não precisarem do client do Prisma.

export const USAGE_MODULES = ["demo1", "demo2", "demo3", "demo4"] as const;
export type UsageModule = (typeof USAGE_MODULES)[number];

// Valores de UsageEvent.action (TECHSPEC §10). A Home, o dashboard e o limite de custo leem estes nomes.
export const USAGE_ACTIONS = [
  "pdf_parse",
  "keyword_suggest",
  "pdf_analysis",
  "brief_generation",
  "document_export",
  "web_search",
  "search_cache_hit",
  "chat_message",
  "chat_cache_hit",
  "document_ingest",
  "document_summary",
  "llm_config_update",
  "settings_update",
  "user_created",
  "user_updated",
  "approval_requested",
  "approval_reviewed",
  "collection_access_update",
  "share_created",
  "share_opened",
] as const;
export type UsageAction = (typeof USAGE_ACTIONS)[number];

export type UsageMetadata = {
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  /** o modelo não tem preço na tabela: o custo NÃO foi contabilizado (não é "grátis") */
  costUnknown?: boolean;
  cacheHit?: boolean;
  /** nome do arquivo ou consulta, só para a lista de atividade; cortado em 120 caracteres */
  title?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  [key: string]: unknown;
};

export type TrackInput = {
  module: UsageModule;
  action: UsageAction;
  userId?: string | null;
  durationMs?: number;
  status: "success" | "error";
  metadata?: UsageMetadata;
};

export type EventData = {
  module: string;
  action: string;
  userId: string | null;
  durationMs: number | null;
  status: "success" | "error";
  metadata: Record<string, string | number | boolean | null>;
};

const MAX_TITLE = 120;
const MAX_STRING = 200;

/** Última linha da mensagem: os erros do Prisma vêm com várias linhas de código; só a última diz o que houve. */
export function oneLine(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return text.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "erro desconhecido";
}

function cut(value: string, max: number): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

/**
 * Privacidade (LGPD): as métricas guardam contagens, custo e títulos curtos, NUNCA conteúdo.
 * Por isso o metadata só aceita valores simples: texto (cortado), número finito, booleano e null.
 * Objetos e listas são descartados, o que impede que um documento ou uma conversa inteira vá
 * parar na tabela por descuido de quem chama.
 */
export function sanitizeMetadata(meta: UsageMetadata | undefined): EventData["metadata"] {
  const out: EventData["metadata"] = {};
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) continue;
    if (typeof value === "string") out[key] = cut(value, key === "title" ? MAX_TITLE : MAX_STRING);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean" || value === null) out[key] = value;
  }
  return out;
}

export function buildEventData(i: TrackInput): EventData {
  const d = i.durationMs;
  return {
    module: i.module,
    action: i.action,
    userId: i.userId ?? null,
    durationMs: typeof d === "number" && Number.isFinite(d) && d >= 0 ? Math.round(d) : null,
    status: i.status === "error" ? "error" : "success",
    metadata: sanitizeMetadata(i.metadata),
  };
}

/**
 * Fire-and-forget: a função devolvida NUNCA lança nem rejeita, então registrar uma métrica jamais
 * derruba a resposta ao usuário. A promessa só serve para quem quiser esperar a gravação (testes,
 * scripts); nas rotas, chame sem `await`.
 */
export function createTrack(
  write: (data: EventData) => Promise<unknown>,
  onFailure: (e: unknown) => void = (e) => console.error("[usage] falha ao gravar evento:", oneLine(e)),
) {
  return function track(input: TrackInput): Promise<void> {
    try {
      return Promise.resolve(write(buildEventData(input))).then(
        () => undefined,
        (e) => onFailure(e),
      );
    } catch (e) {
      onFailure(e);
      return Promise.resolve();
    }
  };
}

// ── mascaramento de dados pessoais ─────────────────────────────────────────────────────

function validCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[len])) return false;
  }
  return true;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const CPF_FORMATTED = /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/g;
const CPF_PLAIN = /(?<!\d)\d{11}(?!\d)/g;
// celular com DDD (9XXXX-XXXX), com ou sem +55, parênteses e separadores
const PHONE_MOBILE = /(?<![\d])(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9\d{4}[\s.-]?\d{4}(?!\d)/g;
// fixo: DDD entre parênteses, ou DDD separado por espaço/hífen/ponto antes de XXXX-XXXX
const PHONE_LANDLINE = /(?<![\d])(?:\+?55[\s.-]?)?(?:\(\d{2}\)[\s.-]?\d{4}[\s.-]?\d{4}|\d{2}[\s.-]\d{4}-\d{4})(?!\d)/g;

/**
 * CPF, e-mail e telefone brasileiro. Conservador de propósito: um CPF sem pontuação só é mascarado
 * se o dígito verificador conferir (senão qualquer número de 11 dígitos sumiria do texto).
 * Não cobre nomes nem endereços. Para texto em streaming, aplique sobre linhas ou sobre o texto
 * completo: um dado cortado entre dois pedaços não é reconhecido.
 */
export function maskPII(text: string): string {
  return text
    .replace(EMAIL, "[e-mail ocultado]")
    .replace(CPF_FORMATTED, "[CPF ocultado]")
    .replace(CPF_PLAIN, (m) => (validCpf(m) ? "[CPF ocultado]" : m))
    .replace(PHONE_MOBILE, "[telefone ocultado]")
    .replace(PHONE_LANDLINE, "[telefone ocultado]");
}

// ── orçamento diário ───────────────────────────────────────────────────────────────────

export type BudgetScope = "user" | "module" | "global";
export type Spent = Record<BudgetScope, number>;
export type Limits = Record<BudgetScope, number | null>;
export type BudgetBlock = { scope: BudgetScope; spent: number; limit: number };

/** Primeiro limite estourado, na ordem usuário → módulo → global; null se está tudo dentro. */
export function checkBudget(spent: Spent, limits: Limits): BudgetBlock | null {
  for (const scope of ["user", "module", "global"] as const) {
    const limit = limits[scope];
    if (typeof limit === "number" && Number.isFinite(limit) && spent[scope] >= limit) {
      return { scope, spent: spent[scope], limit };
    }
  }
  return null;
}

export const BUDGET_MESSAGES: Record<BudgetScope, { code: string; message: string }> = {
  user: {
    code: "budget_user",
    message: "Você atingiu o seu limite diário de uso de IA. Tente novamente amanhã ou fale com o administrador.",
  },
  module: {
    code: "budget_module",
    message: "O limite diário de uso de IA deste módulo foi atingido. Tente novamente amanhã ou fale com o administrador.",
  },
  global: {
    code: "budget_global",
    message: "O limite diário de uso de IA da plataforma foi atingido. Tente novamente amanhã ou fale com o administrador.",
  },
};

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/** Fuso que define a virada do "dia" do orçamento. Valor inválido cai no padrão (não deixa a consulta quebrar). */
export function resolveTimeZone(value: string | undefined): string {
  if (!value) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
