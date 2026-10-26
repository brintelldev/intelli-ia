import type { ExportData, ExportFormat } from "./types";

export type { ExportData, ExportFormat } from "./types";

export const EXPORT_EXTENSION: Record<ExportFormat, string> = { pdf: "pdf", docx: "docx", xlsx: "xlsx", json: "json", md: "md" };

/** Tudo no navegador. Cada formato é um import dinâmico: nenhuma biblioteca pesada entra no bundle inicial. */
export async function exportData(format: ExportFormat, data: ExportData): Promise<Blob> {
  switch (format) {
    case "pdf":
      return (await import("./pdf")).toPdf(data);
    case "docx":
      return (await import("./docx")).toDocx(data);
    case "xlsx":
      return (await import("./xlsx")).toXlsx(data);
    case "json":
      return (await import("./simple")).toJson(data);
    case "md":
      return (await import("./simple")).toMarkdown(data);
  }
}

/** Nome de arquivo seguro a partir do título: sem acento, espaço nem caractere de caminho. */
export function exportFilename(title: string, format: ExportFormat): string {
  const base = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "documento"}.${EXPORT_EXTENSION[format]}`;
}

/** Dispara o download no navegador. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
