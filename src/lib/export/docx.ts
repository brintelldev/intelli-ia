import { Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, TextRun, AlignmentType } from "docx";
import { parseInline, parseMarkdown, type Span } from "./markdown";
import type { ExportData } from "./types";

const runs = (spans: Span[]) =>
  spans.map((s) => new TextRun({ text: s.text, bold: s.bold, italics: s.italic, font: s.code ? "Courier New" : undefined }));

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

export async function toDocx(data: ExportData): Promise<Blob> {
  const children: Paragraph[] = [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(data.title)] })];
  for (const [k, v] of Object.entries(data.metadata)) {
    children.push(new Paragraph({ children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun(String(v))] }));
  }
  for (const section of data.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.heading)] }));
    for (const b of parseMarkdown(section.content)) {
      if (b.type === "heading") children.push(new Paragraph({ heading: HEADINGS[Math.min(b.level, 2)], children: runs(b.spans) })); // abaixo do título da seção
      else if (b.type === "bullet") children.push(new Paragraph({ bullet: { level: 0 }, children: runs(b.spans) }));
      else if (b.type === "numbered") children.push(new Paragraph({ children: [new TextRun(`${b.n}. `), ...runs(b.spans)], indent: { left: 360 } }));
      else if (b.type === "quote") children.push(new Paragraph({ indent: { left: 540 }, children: runs(b.spans.map((s) => ({ ...s, italic: true }))) }));
      else children.push(new Paragraph({ spacing: { after: 120 }, children: runs(b.spans) }));
    }
  }
  if (data.citations?.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fontes")] }));
    data.citations.forEach((c, i) =>
      children.push(new Paragraph({ children: runs(parseInline(`${i + 1}. ${c.label}${c.url ? ` — ${c.url}` : ""}`)) })),
    );
  }
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 18 })],
      }),
    ],
  });
  const doc = new Document({
    title: data.title,
    creator: "Intelli Insights",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ footers: { default: footer }, children }],
  });
  return Packer.toBlob(doc);
}
