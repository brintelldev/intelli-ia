import * as XLSX from "xlsx";
import { stripMarkdown } from "./markdown";
import type { ExportData } from "./types";

// ponytail: SheetJS Community não aplica estilo (largura de coluna é o que dá); estilo exigiria a versão Pro.
export async function toXlsx(data: ExportData): Promise<Blob> {
  const wb = XLSX.utils.book_new();
  const sheet = (rows: unknown[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    return ws;
  };
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [["Título", data.title], ...Object.entries(data.metadata).map(([k, v]) => [k, String(v)]), [], ["Seção", "Conteúdo"], ...data.sections.map((s) => [s.heading, stripMarkdown(s.content)])],
      [28, 110],
    ),
    "Resumo",
  );
  if (data.table) XLSX.utils.book_append_sheet(wb, sheet([data.table.columns, ...data.table.rows], data.table.columns.map(() => 28)), "Achados");
  if (data.citations?.length) {
    XLSX.utils.book_append_sheet(
      wb,
      sheet([["#", "Fonte", "URL", "Relevância"], ...data.citations.map((c, i) => [i + 1, c.label, c.url ?? "", c.score ?? ""])], [5, 60, 70, 12]),
      "Fontes",
    );
  }
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
