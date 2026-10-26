// Precisa do Postgres do dev. Rodar com: npm run test:db
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { createTemplate, deleteTemplate, getUsableTemplate, listTemplates, MAX_OWN_TEMPLATES } from "./templates-store";
import { DEFAULT_FORMAT } from "./templates";
import type { HttpError } from "./http-error";

const A = `tpl-a-${randomUUID()}`;
const B = `tpl-b-${randomUUID()}`;
const tpl = { sections: [{ title: "Contexto" }, { title: "Impactos para RH", instructions: "foque em pessoas" }, { title: "Próximos passos" }], format: DEFAULT_FORMAT };

after(async () => {
  await prisma.reportTemplate.deleteMany({ where: { ownerId: { in: [A, B] } } });
  await prisma.$disconnect();
});

const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as HttpError | null)?.code ?? (await p.then(() => null, (e: HttpError) => e.status));

test("lista os 3 modelos do sistema e o salvo reaparece (seções, instruções e formato intactos)", async () => {
  const before = await listTemplates(A, "demo2_report");
  assert.ok(before.length >= 1 && before.every((t) => t.system), "só os do sistema no começo");
  assert.equal(before[0].name, "Relatório de pesquisa");
  assert.equal(before[0].sections.length, 6);

  const saved = await createTemplate(A, "demo2_report", "Meu modelo de RH", tpl);
  const again = await listTemplates(A, "demo2_report");
  const mine = again.find((t) => t.id === saved.id)!;
  assert.equal(mine.system, false);
  assert.deepEqual(mine.sections, tpl.sections);
  assert.deepEqual(mine.format, tpl.format);
  assert.equal(again.findIndex((t) => t.id === saved.id), again.length - 1, "os próprios vêm depois dos do sistema");
  assert.deepEqual((await listTemplates(A, "demo1_summary")).map((t) => t.id).includes(saved.id), false, "não vaza para o outro módulo");
});

test("isolamento: outra pessoa não vê, não usa e não apaga; o do sistema não se apaga", async () => {
  const saved = await createTemplate(A, "demo1_summary", "Só meu", tpl);
  assert.ok(!(await listTemplates(B, "demo1_summary")).some((t) => t.id === saved.id));
  assert.equal(await getUsableTemplate(saved.id, B), null);
  assert.ok(await getUsableTemplate(saved.id, A));
  assert.equal(await code(deleteTemplate(saved.id, B)), 404);
  assert.ok(await getUsableTemplate(saved.id, A), "continua existindo");
  const system = (await listTemplates(A, "demo1_summary"))[0];
  assert.equal(await code(deleteTemplate(system.id, A)), 403);
  await deleteTemplate(saved.id, A);
  assert.equal(await getUsableTemplate(saved.id, A), null);
  assert.equal(await code(deleteTemplate(saved.id, A)), 404);
});

test("nome repetido (do usuário ou do sistema) e limite de modelos próprios", async () => {
  await createTemplate(B, "demo2_report", "Repetido", tpl);
  assert.equal(await code(createTemplate(B, "demo2_report", "Repetido", tpl)), "template_name_taken");
  assert.equal(await code(createTemplate(B, "demo2_report", "Relatório de pesquisa", tpl)), "template_name_taken");
  await createTemplate(A, "demo2_report", "Repetido", tpl); // outra pessoa pode usar o mesmo nome
  for (let i = 0; i < MAX_OWN_TEMPLATES; i++) {
    await createTemplate(B, "demo1_summary", `n${i}`, tpl).catch(() => {});
  }
  assert.equal(await code(createTemplate(B, "demo1_summary", "uma a mais", tpl)), "template_limit");
});
