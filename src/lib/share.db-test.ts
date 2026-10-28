import{test,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{prisma}from'./prisma';import{createShare,resolveShared,sharingEnabled}from'./share';
// IDs de principais FICTÍCIOS sem User/Account/Session: ninguém pode fazer login como eles.
// Somente relatório descartável com texto sintético; não altera acesso de nenhuma conta existente.
const owner=`share-fixture-owner-${randomUUID()}`,viewer=`share-fixture-viewer-${randomUUID()}`;let reportId='';
after(async()=>{await prisma.shareLink.deleteMany({where:{createdById:owner}});if(reportId)await prisma.researchReport.deleteMany({where:{id:reportId}});await prisma.$disconnect();});
test('link de fixture:32bytes aleatórios,owner obrigatório,expiração/revogação imediatas',async()=>{
 const report=await prisma.researchReport.create({data:{userId:owner,query:'RELATÓRIO TOTALMENTE FICTÍCIO PARA TESTE',optimizedQueries:[],sources:[],report:{sections:[{heading:'Teste',content:'Texto sintético sem dados pessoais.'}],references:[],sourceIndex:[]},modelUsed:'fixture',sourceFilter:'all'}});reportId=report.id;
 if(!await sharingEnabled()){await assert.rejects(()=>createShare('report',reportId,owner));return;}
 await assert.rejects(()=>createShare('report',reportId,viewer));const link=await createShare('report',reportId,owner);assert.equal(Buffer.from(link.token,'base64url').length,32);assert.equal((await resolveShared(link.token,viewer,'Leitor'))?.kind,'report');
 await prisma.shareLink.update({where:{token:link.token},data:{revokedAt:new Date()}});assert.equal(await resolveShared(link.token,viewer,'Leitor'),null);
 await prisma.shareLink.update({where:{token:link.token},data:{revokedAt:null,expiresAt:new Date(Date.now()-1000)}});assert.equal(await resolveShared(link.token,viewer,'Leitor'),null);
});

test('chat de principal sem login: compartilhamento não revela texto de fonte privada ao visualizador fictício',async()=>{
 if(!await sharingEnabled())return;
 const id=`share-no-login-${randomUUID()}`;let chatId='',sourceId='';
 try{
  await prisma.user.create({data:{id,email:`${id}@example.invalid`,name:'Principal fictício sem credenciais',role:'Analista'}});
  // Não cria Account nem Session: não é possível autenticar esta identidade.
  const source=await prisma.documentSource.create({data:{userId:id,filename:'Fonte privada sintética',sourceType:'chat_upload',topics:[]}});sourceId=source.id;
  const chat=await prisma.chatSession.create({data:{userId:id,title:'Conversa fictícia de teste'}});chatId=chat.id;
  await prisma.chatMessage.create({data:{id:`msg-${randomUUID()}`,sessionId:chatId,role:'assistant',parts:[{type:'text',text:'FONTE-FICTICIA-RESTRITA-4826'}],citations:[{n:1,sourceId,filename:'Fonte privada sintética',snippet:'FONTE-FICTICIA-RESTRITA-4826',score:1}]}});
  const link=await createShare('chat',chatId,id);const result=await resolveShared(link.token,viewer,'Leitor');assert.equal(result?.kind,'chat');assert.ok(!JSON.stringify(result).includes('FONTE-FICTICIA-RESTRITA-4826'));assert.ok(JSON.stringify(result).includes('fonte restrita'));
 }finally{await prisma.shareLink.deleteMany({where:{createdById:id}});if(sourceId)await prisma.documentSource.deleteMany({where:{id:sourceId}});await prisma.user.deleteMany({where:{id}});}
});
