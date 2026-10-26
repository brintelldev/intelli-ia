import { HttpError } from "@/lib/http-error";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";
import { track } from "@/lib/usage";

// Direito de exclusão (LGPD, art. 18): apagar de verdade o que o usuário enviou ou gerou.
// As rotas e os botões da interface chamam estas funções; a autorização está AQUI, não na tela.
//
// Fora do alcance (limites que a página /privacidade informa): o que os provedores de IA já
// receberam segue a política de retenção deles, e cópias de segurança do banco guardam o dado até
// o backup antigo ser descartado.

export type Actor = { userId: string; role: Role };

const notFound = () => new HttpError(404, "Não encontrado.", "not_found");

/**
 * Respostas em cache do chat podem repetir trechos do que acabou de ser apagado. Esse cache é
 * regenerável e a chave dele inclui o usuário, então não dá para selecionar só o que é do dono:
 * limpa o do chat inteiro. (O cache da pesquisa web não é privado: vem de fontes públicas.)
 */
export async function purgeChatCache(): Promise<number> {
  return (await prisma.responseCache.deleteMany({ where: { module: "demo3" } })).count;
}

function audit(actor: Actor, kind: string, counts: Record<string, number>) {
  void track({ module: "demo4", action: "data_deleted", userId: actor.userId, status: "success", metadata: { kind, ...counts } });
}

/** Documento + trechos indexados. Dono apaga o seu; documento de coleção é institucional e só o Admin apaga. */
export async function deleteDocument(sourceId: string, actor: Actor) {
  const src = await prisma.documentSource.findUnique({ where: { id: sourceId } });
  const admin = actor.role === "Admin";
  if (!src || (!admin && src.userId !== actor.userId)) throw notFound(); // não revela que o documento existe
  if (!admin && src.collectionId) {
    throw new HttpError(403, "Documentos de coleções só podem ser excluídos pelo administrador.", "collection_document");
  }

  const [chunks] = await prisma.$transaction([
    prisma.documentChunk.deleteMany({ where: { sourceId } }),
    prisma.documentSource.delete({ where: { id: sourceId } }),
  ]);
  await purgeChatCache();
  audit(actor, "document", { documents: 1, chunks: chunks.count });
  return { documents: 1, chunks: chunks.count };
}

/** Conversa, mensagens e links de compartilhamento dela. */
export async function deleteChatSession(sessionId: string, actor: Actor) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (!session || (actor.role !== "Admin" && session.userId !== actor.userId)) throw notFound();

  const messages = await prisma.chatMessage.count({ where: { sessionId } });
  const [links] = await prisma.$transaction([
    prisma.shareLink.deleteMany({ where: { kind: "chat", targetId: sessionId } }),
    prisma.chatSession.delete({ where: { id: sessionId } }), // as mensagens saem em cascata
  ]);
  await purgeChatCache();
  audit(actor, "chat", { chats: 1, messages, shareLinks: links.count });
  return { chats: 1, messages, shareLinks: links.count };
}

/** Relatório de pesquisa e seus links; conversas que o usavam de contexto só perdem a ligação. */
export async function deleteResearchReport(reportId: string, actor: Actor) {
  const report = await prisma.researchReport.findUnique({ where: { id: reportId }, select: { userId: true } });
  if (!report || (actor.role !== "Admin" && report.userId !== actor.userId)) throw notFound();

  const [links] = await prisma.$transaction([
    prisma.shareLink.deleteMany({ where: { kind: "report", targetId: reportId } }),
    prisma.chatSession.updateMany({ where: { threadId: reportId }, data: { threadId: null } }),
    prisma.researchReport.delete({ where: { id: reportId } }),
  ]);
  audit(actor, "report", { reports: 1, shareLinks: links.count });
  return { reports: 1, shareLinks: links.count };
}

/**
 * Exclui a conta e tudo que é pessoal dela: sessões, documentos e trechos, conversas, relatórios,
 * links, modelos de seção e pedidos de aprovação. Só Admin. Decisões:
 *  - documentos que a conta colocou em COLEÇÕES são patrimônio da organização: passam para o Admin
 *    que está excluindo, não são apagados;
 *  - os eventos de uso ficam (são a contabilidade de custo), mas sem o `title`, que pode ter nome
 *    de arquivo ou texto de consulta, e sem a ligação com a pessoa;
 *  - ninguém exclui a si mesmo nem o último administrador.
 */
export async function deleteUserData(userId: string, actor: Actor) {
  if (actor.role !== "Admin") throw new HttpError(403, "Só o administrador pode excluir contas.", "forbidden");
  if (userId === actor.userId) {
    throw new HttpError(400, "Você não pode excluir a própria conta. Peça a outro administrador.", "self_delete");
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) throw notFound();
  if (target.role === "Admin" && (await prisma.user.count({ where: { role: "Admin", id: { not: userId } } })) === 0) {
    throw new HttpError(409, "Não é possível excluir o último administrador.", "last_admin");
  }

  const result = await prisma.$transaction(async (tx) => {
    const chats = await tx.chatSession.count({ where: { userId } });
    const messages = await tx.chatMessage.count({ where: { session: { userId } } });
    const scrubbed = await tx.$executeRaw`UPDATE "UsageEvent" SET metadata = metadata - 'title' WHERE "userId" = ${userId} AND metadata ? 'title'`;
    const reassigned = await tx.documentSource.updateMany({
      where: { userId, collectionId: { not: null } },
      data: { userId: actor.userId },
    });
    await tx.documentChunk.updateMany({ where: { userId, collectionId: { not: null } }, data: { userId: actor.userId } });
    const chunks = await tx.documentChunk.deleteMany({ where: { userId } });
    const documents = await tx.documentSource.deleteMany({ where: { userId } });
    const reports = await tx.researchReport.deleteMany({ where: { userId } });
    const shareLinks = await tx.shareLink.deleteMany({ where: { createdById: userId } });
    const templates = await tx.reportTemplate.deleteMany({ where: { ownerId: userId } });
    const approvals = await tx.approvalQueue.deleteMany({ where: { requesterId: userId } });
    await tx.user.delete({ where: { id: userId } }); // sessões, contas e conversas saem em cascata; eventos ficam com userId nulo
    return {
      documents: documents.count,
      chunks: chunks.count,
      chats,
      messages,
      reports: reports.count,
      shareLinks: shareLinks.count,
      templates: templates.count,
      approvals: approvals.count,
      collectionDocumentsReassigned: reassigned.count,
      eventsScrubbed: Number(scrubbed),
    };
  });
  await purgeChatCache();
  audit(actor, "user", result);
  return result;
}
