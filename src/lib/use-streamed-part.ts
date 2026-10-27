"use client";

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
export function useStreamedPart<M extends UIMessage, D>(api: string, type: `data-${string}`) {
  const transport = useMemo(() => new DefaultChatTransport({ api }), [api]);
  const chat = useChat<M>({ transport });
  const last = [...chat.messages].reverse().find((m) => m.role === "assistant");
  const part = (last?.parts.find((p) => p.type === type) as { data: D } | undefined)?.data;
  const steps: StepData[] = last ? stepsOf(last) : [];
  const busy = chat.status === "submitted" || chat.status === "streaming";
  const error: ApiError | null = chat.error ? parseApiError(chat.error) : null;

  const { setMessages, clearError, sendMessage, stop } = chat;
  const reset = useCallback(() => {
    stop();
    setMessages([]);
    clearError();
  }, [stop, setMessages, clearError]);
  const run = useCallback(
    (body: object) => {
      setMessages([]);
      clearError();
      return sendMessage({ text: "executar" }, { body });
    },
    [setMessages, clearError, sendMessage],
  );

  return { part, steps, busy, error, run, reset, stop };
}
