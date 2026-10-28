"use client";
import { presentationFetch } from "@/lib/presentation-fetch";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useMemo } from "react";
import { stepsOf, type StepData } from "@/lib/stream-steps";
import { parseApiError, type ApiError } from "@/lib/documentos/workspace";

/**
 * Chama uma rota que responde com o stream de mensagens (etapas + um "data part" com o resultado crescendo) e devolve o
 * estado pronto para a tela: o último `data-<type>`, as etapas, se está ocupada e o erro já em português.
 * O corpo da requisição é o objeto que `run` recebe (a rota lê esse JSON; o `useChat` acrescenta campos que ela ignora).
 */
export function useStreamedPart<M extends UIMessage, D extends { phase: string }>(api: string, type: `data-${string}`) {
  const transport = useMemo(() => new DefaultChatTransport({ api, fetch: presentationFetch }), [api]);
  const chat = useChat<M>({ transport });
  const assistants = chat.messages.filter((m) => m.role === "assistant");
  const last = assistants.at(-1);
  const partOf = (m: (typeof assistants)[number] | undefined) => (m?.parts.find((p) => p.type === type) as { data: D } | undefined)?.data;
  const latest = partOf(last);
  const lastFinal = [...assistants].reverse().map(partOf).find((p) => p?.phase === "final");
  const steps: StepData[] = last ? stepsOf(last) : [];
  const busy = chat.status === "submitted" || chat.status === "streaming";
  // Rodar de novo NÃO apaga o resultado anterior: enquanto a nova chamada roda, aparece o que ela já trouxe (ou o resultado
  // anterior, até o 1º pedaço chegar); se ela falhar ou for cancelada antes de terminar, o resultado anterior continua na tela.
  const part = busy ? (latest ?? lastFinal) : (lastFinal ?? latest);
  const error: ApiError | null = chat.error ? parseApiError(chat.error) : null;

  const { setMessages, clearError, sendMessage, stop } = chat;
  const reset = useCallback(() => {
    stop();
    setMessages([]);
    clearError();
  }, [stop, setMessages, clearError]);
  const run = useCallback(
    (body: object) => {
      clearError();
      return sendMessage({ text: "executar" }, { body });
    },
    [clearError, sendMessage],
  );

  return { part, latest, steps, busy, error, run, reset, stop };
}
