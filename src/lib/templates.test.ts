import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  buildSectionsSchema, DEFAULT_FORMAT, formatInstructions, normalizeSections, NO_INFO, normTitle, templateHash, TemplateSchema, withMandatory,
  type Template,
} from "./templates";

const t = (titles: string[], format: Partial<Template["format"]> = {}): Template => ({
  sections: titles.map((title) => ({ title })),
  format: { ...DEFAULT_FORMAT, ...format },
});

test("withMandatory: acrescenta Referências (pesquisa) e Metodologia (resumo) no fim quando faltam", () => {
  assert.deepEqual(withMandatory(t(["Contexto", "Impactos"]), "demo2_report").sections.map((s) => s.title), ["Contexto", "Impactos", "Referências"]);
  assert.deepEqual(withMandatory(t(["Visão geral"]), "demo1_summary").sections.map((s) => s.title), ["Visão geral", "Metodologia"]);
});

test("withMandatory: não duplica (ignora caixa, acento e espaços) nem mexe no que já está", () => {
  const already = t(["Contexto", "  referencias "]);
  assert.equal(withMandatory(already, "demo2_report"), already);
  assert.equal(withMandatory(t(["METODOLOGIA", "x"]), "demo1_summary").sections.length, 2);
  // Referências é obrigatória só na pesquisa; no resumo não é exigida
  assert.equal(withMandatory(t(["Referências"]), "demo1_summary").sections.length, 2);
});

test("normalizeSections: ordem e títulos do modelo, faltante vira aviso, inventada some", () => {
  const tpl = t(["Contexto", "Impactos para RH", "Próximos passos"]);
  const out = normalizeSections(tpl, [
    { title: "próximos PASSOS", content: " c3 " },
    { title: "Contexto", content: "c1" },
    { title: "Seção inventada", content: "xxx" },
  ]);
  assert.deepEqual(out, [
    { heading: "Contexto", content: "c1" },
    { heading: "Impactos para RH", content: NO_INFO },
    { heading: "Próximos passos", content: "c3" },
  ]);
});

test("normalizeSections: conteúdo vazio vira aviso; título repetido vale o primeiro", () => {
  const out = normalizeSections(t(["A", "B"]), [{ title: "A", content: "   " }, { title: "B", content: "primeiro" }, { title: "B", content: "segundo" }]);
  assert.equal(out[0].content, NO_INFO);
  assert.equal(out[1].content, "primeiro");
});

test("buildSectionsSchema: valida {sections:[{title,content}]} e a descrição lista os títulos em ordem", () => {
  const schema = buildSectionsSchema(t(["Contexto", "Impactos"]));
  assert.ok(schema.safeParse({ sections: [{ title: "x", content: "y" }] }).success);
  assert.ok(!schema.safeParse({ sections: [{ title: "x" }] }).success);
  const desc = schema.shape.sections.description!;
  assert.ok(desc.indexOf('"Contexto"') >= 0 && desc.indexOf('"Contexto"') < desc.indexOf('"Impactos"'));
  assert.ok(JSON.stringify(z.toJSONSchema(schema)).includes("Exatamente estas seções"), "a descrição chega ao JSON Schema enviado ao provedor");
});

test("formatInstructions: seções numeradas na ordem e critérios; o tom muda o texto de forma visível", () => {
  const tec = formatInstructions(t(["Contexto", "Próximos passos"], { tone: "tecnico" }));
  const exe = formatInstructions(t(["Contexto", "Próximos passos"], { tone: "executivo" }));
  const jur = formatInstructions(t(["Contexto"], { tone: "juridico" }));
  assert.ok(tec.indexOf('1. "Contexto"') < tec.indexOf('2. "Próximos passos"'));
  assert.notEqual(tec, exe);
  assert.match(tec, /técnica e precisa/);
  assert.match(exe, /executiva e direta/);
  assert.match(jur, /jurídica formal/);
});

test("formatInstructions: tamanho, detalhe, citações e instrução por seção", () => {
  const f = (o: Partial<Template["format"]>) => formatInstructions({ sections: [{ title: "A", instructions: "foque em custos" }], format: { ...DEFAULT_FORMAT, ...o } });
  assert.match(f({ length: "curto" }), /no máximo 80 palavras/);
  assert.match(f({ length: "longo" }), /300 e 500 palavras/);
  assert.match(f({ detail: "detalhado" }), /detalhado/);
  assert.match(f({ citations: true }), /\[1\]/);
  assert.match(f({ citations: false }), /Não use marcadores de citação/);
  assert.match(f({}), /"A": foque em custos/);
});

test("TemplateSchema: exige 1 a 12 seções com título, e valores de formato válidos", () => {
  const ok = { sections: [{ title: "A" }], format: DEFAULT_FORMAT };
  assert.ok(TemplateSchema.safeParse(ok).success);
  assert.ok(!TemplateSchema.safeParse({ ...ok, sections: [] }).success);
  assert.ok(!TemplateSchema.safeParse({ ...ok, sections: [{ title: "   " }] }).success);
  assert.ok(!TemplateSchema.safeParse({ ...ok, sections: Array.from({ length: 13 }, (_, i) => ({ title: `S${i}` })) }).success);
  assert.ok(!TemplateSchema.safeParse({ ...ok, format: { ...DEFAULT_FORMAT, tone: "informal" } }).success);
  assert.equal(TemplateSchema.parse({ ...ok, sections: [{ title: "  Contexto  " }] }).sections[0].title, "Contexto");
});

test("templateHash: igual para o mesmo modelo, diferente se a seção, a instrução ou o formato mudam", async () => {
  const a = await templateHash(t(["A", "B"]));
  assert.equal(a, await templateHash(t(["A", "B"])));
  assert.notEqual(a, await templateHash(t(["B", "A"])));
  assert.notEqual(a, await templateHash(t(["A", "B"], { tone: "executivo" })));
  assert.notEqual(a, await templateHash({ sections: [{ title: "A", instructions: "x" }, { title: "B" }], format: DEFAULT_FORMAT }));
  assert.equal(normTitle(" Ação  Rápida "), "acao rapida");
});
