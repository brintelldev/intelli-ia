"use client";

import { useState } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBlob, exportData, exportFilename, type ExportData, type ExportFormat } from "@/lib/export";
import { cn } from "@/lib/utils";

const LABEL: Record<ExportFormat, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", json: "JSON", md: "Markdown" };
const ALL: ExportFormat[] = ["pdf", "docx", "xlsx", "json", "md"];

/**
 * Um botão por formato. O arquivo é gerado no navegador (nada do conteúdo sai da máquina por causa da
 * exportação); só o fato de ter exportado é registrado em /api/track, sem o conteúdo.
 *
 * `beforeExport` é o gancho de aprovação (item 134, T-37/T-41): se devolver `false`, nada é baixado.
 */
export function ExportButtons({
  getData,
  module,
  formats = ALL,
  beforeExport,
  disabled,
  className,
}: {
  getData: () => ExportData | Promise<ExportData>;
  module: "demo1" | "demo2" | "demo3";
  formats?: ExportFormat[];
  beforeExport?: (format: ExportFormat) => boolean | Promise<boolean>;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function run(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    try {
      if (beforeExport && !(await beforeExport(format))) return;
      const data = await getData();
      const filename = exportFilename(data.title, format);
      downloadBlob(await exportData(format, data), filename);
      toast.success(`${LABEL[format]} baixado`, { description: filename });
      // Falha no registro não é problema de quem exportou: o arquivo já foi entregue.
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, action: "document_export", metadata: { format, title: data.title.slice(0, 120) } }),
      }).catch(() => {});
    } catch (e) {
      console.error("export:", e);
      toast.error(`Não foi possível gerar o ${LABEL[format]}`, { description: "Tente de novo em instantes." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div role="group" aria-label="Exportar" className={cn("flex flex-wrap items-center gap-2", className)}>
      {formats.map((f) => (
        <Button key={f} type="button" variant="outline" size="sm" disabled={disabled || busy !== null} onClick={() => run(f)} aria-busy={busy === f}>
          {busy === f ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
          {LABEL[f]}
        </Button>
      ))}
    </div>
  );
}
