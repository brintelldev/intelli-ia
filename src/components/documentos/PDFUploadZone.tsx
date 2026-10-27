"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertTriangleIcon, CheckCircle2Icon, FileTextIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivacyNotice } from "@/components/shared/PrivacyNotice";
import { dropRejectionMessage, processPdf, UploadError, type PdfResult } from "@/lib/documentos/upload-client";
import { MAX_PDF_BYTES } from "@/lib/upload";
import { estimateTokens } from "@/lib/pdf/document";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "reading"; name: string; pages?: number }
  | { kind: "ocr"; name: string; pages?: number }
  | { kind: "done"; result: PdfResult }
  | { kind: "error"; message: string };

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB` : `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`);

/**
 * Envio do PDF (item 111). PDF digital: o texto é extraído AQUI, no navegador, e o arquivo não sai da máquina.
 * Escaneado: o arquivo vai ao servidor para OCR (o aviso de privacidade diz isso). `onChange` recebe o resultado
 * pronto (arquivo, texto por página e o método) ou `null` quando a pessoa troca ou remove o arquivo.
 */
export function PDFUploadZone({
  onChange,
  onBusyChange,
  disabled,
  className,
}: {
  onChange: (result: PdfResult | null) => void;
  /** avisa quando a leitura começa e termina (a página bloqueia "Analisar" enquanto lê) */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [seconds, setSeconds] = useState(0);
  // estado de "arrastando" próprio: o da biblioteca pode ficar preso se a área é desabilitada no meio do arrastar
  const [over, setOver] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const busy = state.kind === "reading" || state.kind === "ocr";

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // cronômetro do OCR (o servidor não informa o andamento: só dá para mostrar que está trabalhando e há quanto tempo)
  useEffect(() => {
    if (state.kind !== "ocr") return;
    const start = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setSeconds(0);
    };
  }, [state.kind]);

  const run = useCallback(
    async (file: File) => {
      abort.current?.abort();
      const ctl = (abort.current = new AbortController());
      onChange(null);
      setState({ kind: "reading", name: file.name });
      try {
        const result = await processPdf(file, {
          signal: ctl.signal,
          onPhase: (p) => setState({ kind: p.phase, name: file.name, pages: p.pages }),
        });
        if (ctl.signal.aborted) return;
        setState({ kind: "done", result });
        onChange(result);
      } catch (e) {
        if (e instanceof UploadError && e.code === "aborted") return setState({ kind: "idle" });
        // erro do tipo UploadError é esperado (arquivo inválido, com senha…): só vai para a tela. Os demais são bugs.
        if (!(e instanceof UploadError)) console.error("upload:", e);
        setState({ kind: "error", message: e instanceof UploadError ? e.message : "Não foi possível ler este PDF." });
      }
    },
    [onChange],
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    onDragEnter: () => setOver(true),
    onDragLeave: () => setOver(false),
    onDrop: () => setOver(false),
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_PDF_BYTES,
    disabled: disabled || busy,
    noClick: state.kind === "done", // com arquivo escolhido, o clique na área não abre o seletor: há o botão "Trocar"
    onDropAccepted: (files) => void run(files[0]),
    onDropRejected: (rej) => setState({ kind: "error", message: dropRejectionMessage(rej[0]?.errors.map((e) => e.code) ?? []) }),
  });

  function reset() {
    abort.current?.abort();
    setState({ kind: "idle" });
    onChange(null);
  }

  const done = state.kind === "done" ? state.result : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        {...getRootProps({
          className: cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 px-6 py-8 text-center transition-all duration-200 outline-none",
            "focus-visible:ring-[3px] focus-visible:ring-accent-docs/40",
            over
              ? "border-solid border-accent-docs bg-accent-docs/8 shadow-[0_0_28px_color-mix(in_srgb,var(--accent-docs)_28%,transparent)]"
              : "border-dashed border-border bg-surface hover:border-accent-docs/50",
            state.kind === "error" && "border-destructive/50",
            (disabled || busy) && "cursor-wait opacity-90",
            !disabled && !busy && state.kind !== "done" && "cursor-pointer",
          ),
          role: "button",
          "aria-label": "Enviar PDF: arraste o arquivo para cá ou pressione Enter para escolher",
          "data-testid": "pdf-dropzone",
          "data-state": over ? "dragging" : state.kind,
        })}
      >
        <input {...getInputProps({ "aria-label": "Arquivo PDF", "data-testid": "pdf-input" })} />

        {state.kind === "idle" || state.kind === "error" ? (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-docs/12 text-accent-docs motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90">
              {over ? <FileTextIcon className="size-6" /> : <UploadCloudIcon className="size-6" />}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">{over ? "Solte o PDF aqui" : "Arraste um PDF ou clique para escolher"}</p>
              <p className="text-xs text-text-secondary">Até {MAX_PDF_BYTES / 1024 / 1024} MB. PDF digital é lido no seu navegador; escaneado passa por OCR.</p>
            </div>
          </>
        ) : null}

        {busy && (
          <div className="w-full max-w-sm space-y-3" role="status">
            <div className="flex items-center justify-center gap-2 text-sm text-text-primary">
              <Loader2Icon className="size-4 animate-spin text-accent-docs" />
              {state.kind === "reading" ? "Lendo o PDF…" : `Reconhecendo o texto (OCR)… ${seconds} s`}
            </div>
            <p className="truncate text-xs text-text-secondary">{state.name}{state.pages ? ` · ${state.pages} ${state.pages === 1 ? "página" : "páginas"}` : ""}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
              <div className="h-full w-1/3 rounded-full bg-accent-docs motion-safe:animate-[indeterminate_1.4s_ease-in-out_infinite]" />
            </div>
            {state.kind === "ocr" && (
              <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); reset(); }}>
                <XIcon data-icon="inline-start" /> Cancelar
              </Button>
            )}
          </div>
        )}

        {done && (
          <div className="w-full space-y-3 text-left" data-testid="pdf-done">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-docs/12 text-accent-docs">
                <CheckCircle2Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary" title={done.file.name}>{done.file.name}</p>
                <p className="text-xs text-text-secondary">
                  {done.doc.pages.length} {done.doc.pages.length === 1 ? "página" : "páginas"} · {size(done.file.size)} · ~{estimateTokens(done.doc.text).toLocaleString("pt-BR")} tokens
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={done.method === "digital" ? "docs" : "admin"} title={done.method === "digital" ? "Texto extraído no seu navegador" : "Texto reconhecido por OCR: pode haver pequenos erros de leitura"}>
                {done.method === "digital" ? "Digital" : "Escaneado"}
              </Badge>
              <span className="flex-1" />
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={(e) => { e.stopPropagation(); open(); }}>
                Trocar
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Remover o arquivo" disabled={disabled} onClick={(e) => { e.stopPropagation(); reset(); }}>
                <XIcon />
              </Button>
            </div>
          </div>
        )}
      </div>

      {state.kind === "error" && (
        <p role="alert" data-testid="pdf-error" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}
      <PrivacyNotice />
    </div>
  );
}
