export type ExportFormat = "pdf" | "docx" | "xlsx" | "json" | "md";

export type ExportData = {
  title: string;
  /** `content` é markdown (saída do modelo): títulos, listas, negrito e itálico viram formatação real. */
  sections: { heading: string; content: string }[];
  /** data, modelo, nº de fontes… */
  metadata: Record<string, unknown>;
  citations?: { label: string; url?: string; score?: number }[];
  /** Dados estruturados adicionais, preservados no JSON e ignorados na apresentação dos demais formatos. */
  structured?: unknown;
  /** aba de achados do XLSX */
  table?: { columns: string[]; rows: (string | number)[][] };
};
