import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip"; // dependência do docx; só para abrir o .docx no teste
import * as XLSX from "xlsx";
import { exportFilename, exportData, type ExportData } from "./index";
import { parseMarkdown, stripMarkdown } from "./markdown";

const data: ExportData = {
  title: "Parecer: contratação — órgão X",
  metadata: { Data: "26/10/2026", "Nº de fontes": 2 },
  sections: [
    { heading: "Resumo", content: "## Conclusão\n\nO contrato é **viável** e _seguro_.\n\n- um\n- dois\n\n1. primeiro\n2. segundo" },
    { heading: "Riscos", content: "Ação, órgão, “aspas” — ok." },
  ],
  citations: [{ label: "Lei 14.133/2021", url: "https://exemplo.gov.br/lei", score: 0.9 }, { label: "Sem link" }],
  table: { columns: ["Achado", "Página"], rows: [["Multa sem teto", 3]] },
};

test("markdown: blocos e formatação inline", () => {
  const b = parseMarkdown("# T\n\nTexto **forte** e _leve_ com `cod`.\n\n- a\n- b\n\n3. c\n\n> cit");
  assert.deepEqual(b.map((x) => x.type), ["heading", "paragraph", "bullet", "bullet", "numbered", "quote"]);
  const p = b[1] as Extract<(typeof b)[number], { type: "paragraph" }>;
  assert.deepEqual(p.spans.filter((s) => s.bold || s.italic || s.code).map((s) => s.text), ["forte", "leve", "cod"]);
  assert.equal((b[4] as { n: number }).n, 3);
});

test("markdown: link vira texto com a URL visível; HTML cru fica como texto; linhas seguidas viram um parágrafo", () => {
  assert.equal(stripMarkdown("veja [LexML](https://lexml.gov.br) <b>x</b>"), "veja LexML (https://lexml.gov.br) <b>x</b>");
  assert.equal(parseMarkdown("linha um\nlinha dois").length, 1);
  assert.equal(stripMarkdown(""), "");
});

test("exportFilename: sem acento, espaço nem caractere de caminho", () => {
  assert.equal(exportFilename("Parecer: contratação — órgão X/2026", "pdf"), "Parecer-contratacao-orgao-X-2026.pdf");
  assert.equal(exportFilename("../../etc/passwd", "md"), "etc-passwd.md");
  assert.equal(exportFilename("???", "json"), "documento.json");
  assert.ok(exportFilename("x".repeat(500), "docx").length <= 65);
});

test("json: volta idêntico; md: título, metadados, seções e fontes numeradas", async () => {
  const json = JSON.parse(await (await exportData("json", data)).text());
  assert.deepEqual(json, data);
  const md = await (await exportData("md", data)).text();
  assert.match(md, /^# Parecer: contratação — órgão X/);
  assert.match(md, /- \*\*Data:\*\* 26\/10\/2026/);
  assert.match(md, /## Resumo\n\n## Conclusão/);
  assert.match(md, /1\. \[Lei 14\.133\/2021\]\(https:\/\/exemplo\.gov\.br\/lei\)\n2\. Sem link/);
});

test("xlsx: abas Resumo, Achados e Fontes; números continuam números", async () => {
  const blob = await exportData("xlsx", data);
  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const wb = XLSX.read(await blob.arrayBuffer());
  assert.deepEqual(wb.SheetNames, ["Resumo", "Achados", "Fontes"]);
  const achados = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Achados"], { header: 1 });
  assert.deepEqual(achados, [["Achado", "Página"], ["Multa sem teto", 3]]);
  const resumo = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Resumo"], { header: 1 });
  assert.ok(resumo.some((r) => r[0] === "Resumo" && r[1].includes("• um") && r[1].includes("viável")), "markdown virou texto puro com marcadores");
});

test("xlsx: sem table nem citations gera só a aba Resumo", async () => {
  const wb = XLSX.read(await (await exportData("xlsx", { ...data, table: undefined, citations: undefined })).arrayBuffer());
  assert.deepEqual(wb.SheetNames, ["Resumo"]);
});

test("docx: é um zip válido com o texto, a formatação e o rodapé de páginas", async () => {
  const blob = await exportData("docx", data);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(xml.includes("Parecer: contratação — órgão X"));
  assert.ok(xml.includes("<w:b/>") && xml.includes("viável"), "negrito aplicado");
  assert.ok(xml.includes("<w:numPr>") || xml.includes("ListParagraph") || xml.includes("<w:numId"), "lista de marcadores");
  assert.ok(xml.includes("Lei 14.133/2021") && xml.includes("https://exemplo.gov.br/lei"));
  const footer = Object.keys(zip.files).find((f) => /word\/footer\d*\.xml/.test(f));
  assert.ok(footer && (await zip.file(footer)!.async("string")).includes("PAGE"), "rodapé com número de página");
});
