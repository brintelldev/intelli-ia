"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { addKeywords, excerptForPrompt, MAX_KEYWORD_CHIPS, MAX_KEYWORD_CHARS, splitKeywordInput } from "@/lib/documentos/keywords";
import { cn } from "@/lib/utils";

type Suggestions = { forKey: string; keywords: string[]; failed: boolean };

/**
 * Palavras-chave da análise (item 112). Chips removíveis; Enter, vírgula ou ponto e vírgula adicionam; colar uma
 * lista separa em vários. Quando `documentText` chega (PDF lido), busca sugestões em /api/documentos/suggest-keywords;
 * digitar à mão funciona sempre, mesmo que a sugestão falhe.
 */
export function KeywordInput({
  value,
  onChange,
  documentText,
  filename,
  disabled,
  className,
}: {
  value: string[];
  onChange: (keywords: string[]) => void;
  /** texto do documento já extraído; ao mudar, as sugestões são buscadas de novo */
  documentText?: string | null;
  filename?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Suggestions | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });
  const input = useRef<HTMLInputElement>(null);

  // chave da busca: o texto (só o trecho enviado) e o nº da tentativa; resposta de uma busca antiga é descartada
  const excerpt = documentText?.trim() ? excerptForPrompt(documentText) : null;
  const key = excerpt ? `${nonce}:${excerpt.length}:${excerpt.slice(0, 200)}` : null;

  useEffect(() => {
    if (!excerpt || !key) return;
    let alive = true;
    fetch("/api/documentos/suggest-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: excerpt, existing: valueRef.current, filename }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return ((await r.json()) as { keywords: string[] }).keywords;
      })
      .then(
        (keywords) => alive && setResult({ forKey: key, keywords, failed: false }),
        () => alive && setResult({ forKey: key, keywords: [], failed: true }),
      );
    return () => {
      alive = false;
    };
    // `key` já resume excerpt e nonce; filename só rotula o evento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result && result.forKey === key ? result : null;
  const loading = !!key && !current;
  const offered = (current?.keywords ?? []).filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  function add(terms: string[]) {
    const r = addKeywords(value, terms);
    if (r.added.length) onChange(r.keywords);
    setHint(
      r.overflow.length ? `Máximo de ${MAX_KEYWORD_CHIPS} palavras-chave.` : r.tooLong.length ? `Cada termo tem no máximo ${MAX_KEYWORD_CHARS} caracteres.` : r.duplicates.length && !r.added.length ? `"${r.duplicates[0]}" já está na lista.` : null,
    );
    return r;
  }

  function commit() {
    const terms = splitKeywordInput(draft);
    if (!terms.length) return setDraft("");
    const r = add(terms);
    setDraft(r.tooLong.length ? r.tooLong.join(", ") : "");
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 transition-colors",
          "focus-within:border-accent-docs/60 focus-within:ring-[3px] focus-within:ring-accent-docs/20",
          disabled && "opacity-60",
        )}
        onClick={() => input.current?.focus()}
      >
        {value.map((k) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-md border border-accent-docs/30 bg-surface-raised py-0.5 pr-1 pl-2 text-sm text-text-primary" data-testid="keyword-chip">
            {k}
            <button type="button" aria-label={`Remover ${k}`} disabled={disabled} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== k)); setHint(null); }} className="rounded p-0.5 text-text-muted hover:bg-border hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-docs/50 focus-visible:outline-none">
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={draft}
          disabled={disabled}
          aria-label="Palavras-chave"
          placeholder={value.length ? "" : "Ex: rescisão, SLA, responsabilidade civil"}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm text-text-primary outline-none placeholder:text-text-muted"
          onChange={(e) => {
            // vírgula ou ponto e vírgula digitados já fecham o termo
            if (/[,;]/.test(e.target.value)) {
              const r = add(splitKeywordInput(e.target.value));
              setDraft(r.tooLong.length ? r.tooLong.join(", ") : "");
            } else {
              setDraft(e.target.value);
              setHint(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,;\n]/.test(text)) {
              e.preventDefault();
              add(splitKeywordInput(draft + text));
              setDraft("");
            }
          }}
        />
        {draft.trim() && (
          <button type="button" aria-label="Adicionar palavra-chave" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={commit} className="rounded p-1 text-text-secondary hover:text-accent-docs">
            <PlusIcon className="size-4" />
          </button>
        )}
      </div>

      <p className="min-h-4 text-xs text-text-secondary" role={hint ? "alert" : undefined} data-testid="keyword-hint">
        {hint ?? `${value.length} de ${MAX_KEYWORD_CHIPS} · Enter ou vírgula adiciona.`}
      </p>

      {key && (
        <div className="space-y-2" data-testid="keyword-suggestions">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            {loading ? <Loader2Icon className="size-3.5 animate-spin text-accent-docs" /> : <SparklesIcon className="size-3.5 text-accent-docs" />}
            {loading ? "Buscando sugestões a partir do documento…" : current?.failed ? "Sugestões indisponíveis agora; digite as palavras-chave." : offered.length ? "Sugestões do documento" : "Sem outras sugestões."}
            {!loading && (
              <button type="button" disabled={disabled} onClick={() => setNonce((n) => n + 1)} className="ml-auto underline underline-offset-2 hover:text-text-primary disabled:opacity-50">
                {current?.failed ? "Tentar de novo" : "Sugerir de novo"}
              </button>
            )}
          </div>
          {offered.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {offered.map((s) => (
                <button key={s} type="button" disabled={disabled} onClick={() => add([s])} data-testid="keyword-suggestion" className="inline-flex items-center gap-1 rounded-md border border-dashed border-accent-docs/40 px-2 py-0.5 text-sm text-text-secondary transition-colors hover:border-solid hover:bg-accent-docs/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-docs/50 focus-visible:outline-none disabled:opacity-50">
                  <PlusIcon className="size-3 text-accent-docs" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
