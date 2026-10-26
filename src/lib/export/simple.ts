import type { ExportData } from "./types";

export function toJson(data: ExportData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

export function toMarkdown(data: ExportData): Blob {
  const meta = Object.entries(data.metadata).map(([k, v]) => `- **${k}:** ${String(v)}`);
  const parts = [`# ${data.title}`, meta.join("\n"), ...data.sections.map((s) => `## ${s.heading}\n\n${s.content.trim()}`)];
  if (data.citations?.length) {
    parts.push("## Fontes\n\n" + data.citations.map((c, i) => `${i + 1}. ${c.url ? `[${c.label}](${c.url})` : c.label}`).join("\n"));
  }
  return new Blob([parts.filter(Boolean).join("\n\n") + "\n"], { type: "text/markdown;charset=utf-8" });
}
