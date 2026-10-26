import type { UIMessage, UIMessageStreamWriter } from "ai";
import { HttpError } from "@/lib/http-error";

// Etapas de uma operação longa (Demo 2: raciocínio do agente; Demo 1: progresso da análise), enviadas no
// mesmo stream da resposta como "data parts". Reusar o `id` ATUALIZA a etapa no cliente (o SDK reconcilia
// por id): a etapa nasce "running" e depois vira "done" ou "error", sem duplicar a linha.

export type StepStatus = "running" | "done" | "error";
export type StepExtra = Record<string, string | number | boolean | null>;
export type StepData = { id: string; label: string; status: StepStatus; ms: number } & StepExtra;

/** Tipo de mensagem com a etapa; cada módulo estende com seus outros data parts (fontes, relatório…). */
export type StepMessage = UIMessage<never, { step: StepData }>;

// Início de cada etapa por writer: o `ms` é o tempo desde o "running" da MESMA etapa.
const started = new WeakMap<object, Map<string, number>>();

/**
 * Escreve (ou atualiza, se o `id` já existe) uma etapa. `extra` carrega o que a tela quiser mostrar ao lado
 * (ex.: `{ sources: 3 }`, `{ cacheHit: true }`); só valores simples, e não pode sobrescrever os campos fixos.
 * Nunca ponha aqui conteúdo de documento ou erro cru: o texto vai para a tela de quem está logado.
 */
export function step(
  writer: Pick<UIMessageStreamWriter<StepMessage>, "write">,
  id: string,
  label: string,
  status: StepStatus,
  extra: StepExtra = {},
): void {
  const starts = started.get(writer) ?? started.set(writer, new Map()).get(writer)!;
  const now = performance.now();
  if (status === "running") starts.set(id, now);
  const t0 = starts.get(id);
  const ms = status === "running" || t0 === undefined ? 0 : Math.round(now - t0);
  const data: StepData = { ...extra, id, label, status, ms };
  writer.write({ type: "data-step", id, data });
}

/** As etapas de uma mensagem, na ordem em que apareceram (cada `id` uma vez, no estado mais recente). */
export function stepsOf(message: Pick<UIMessage, "parts">): StepData[] {
  return message.parts.flatMap((p) => (p.type === "data-step" ? [(p as { data: StepData }).data] : []));
}

export const STREAM_ERROR_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";

/**
 * `onError` do `createUIMessageStream`: o que vai para o navegador. Erros do tipo `HttpError` (limite de custo,
 * permissão…) têm mensagem escrita para a pessoa e passam; qualquer outro vai só para o log do servidor, porque
 * mensagens de provedor e de banco podem trazer chave, SQL ou trecho de documento.
 */
export function streamError(e: unknown): string {
  if (e instanceof HttpError) return e.message;
  console.error("stream:", e instanceof Error ? e.message.split("\n").at(-1) : e);
  return STREAM_ERROR_MESSAGE;
}
