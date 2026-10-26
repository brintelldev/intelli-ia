import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";
import { TemplateSchema, type Template, type TemplateModule } from "@/lib/templates";

export const MAX_OWN_TEMPLATES = 20; // por pessoa e módulo

export type StoredTemplate = Template & { id: string; name: string; module: TemplateModule; system: boolean };

type Row = { id: string; name: string; module: string; ownerId: string | null; sections: unknown; format: unknown };

// A linha do banco é JSON livre: revalida na leitura em vez de confiar no formato.
function toStored(r: Row): StoredTemplate | null {
  const parsed = TemplateSchema.safeParse({ sections: r.sections, format: r.format });
  if (!parsed.success) {
    console.error("templates: linha inválida", r.id);
    return null;
  }
  return { id: r.id, name: r.name, module: r.module as TemplateModule, system: r.ownerId === null, ...parsed.data };
}

/** Modelos do sistema + os da própria pessoa (os de outras nunca aparecem). Sistema primeiro, depois por nome. */
export async function listTemplates(userId: string, module: TemplateModule): Promise<StoredTemplate[]> {
  const rows = await prisma.reportTemplate.findMany({
    where: { module, OR: [{ ownerId: null }, { ownerId: userId }] },
    orderBy: [{ createdAt: "asc" }],
  });
  const all = rows.map(toStored).filter((t): t is StoredTemplate => t !== null);
  return [...all.filter((t) => t.system), ...all.filter((t) => !t.system).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))];
}

/** Busca um modelo que a pessoa pode usar (do sistema ou dela); senão `null`. Para as rotas de IA. */
export async function getUsableTemplate(id: string, userId: string): Promise<StoredTemplate | null> {
  const r = await prisma.reportTemplate.findFirst({ where: { id, OR: [{ ownerId: null }, { ownerId: userId }] } });
  return r ? toStored(r) : null;
}

export async function createTemplate(userId: string, module: TemplateModule, name: string, tpl: Template): Promise<StoredTemplate> {
  const own = await prisma.reportTemplate.count({ where: { ownerId: userId, module } });
  if (own >= MAX_OWN_TEMPLATES) throw new HttpError(409, `Limite de ${MAX_OWN_TEMPLATES} modelos próprios. Exclua algum para salvar outro.`, "template_limit");
  const clash = await prisma.reportTemplate.findFirst({ where: { module, name, OR: [{ ownerId: userId }, { ownerId: null }] }, select: { id: true } });
  if (clash) throw new HttpError(409, "Já existe um modelo com este nome.", "template_name_taken");
  const row = await prisma.reportTemplate.create({
    data: { module, name, ownerId: userId, sections: tpl.sections as never, format: tpl.format as never },
  });
  return toStored(row)!;
}

/** Só apaga o que é da própria pessoa. O do sistema dá 403; o de outra pessoa dá 404 (não revela que existe). */
export async function deleteTemplate(id: string, userId: string): Promise<void> {
  const r = await prisma.reportTemplate.findUnique({ where: { id }, select: { ownerId: true } });
  if (!r) throw new HttpError(404, "Modelo não encontrado");
  if (r.ownerId === null) throw new HttpError(403, "Os modelos do sistema não podem ser excluídos.");
  if (r.ownerId !== userId) throw new HttpError(404, "Modelo não encontrado");
  await prisma.reportTemplate.delete({ where: { id } });
}
