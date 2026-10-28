import{test,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{prisma}from'../prisma';import{sessionPage,sessionMessages}from'./history';
const owner=`qa-history-${randomUUID()}`;
after(async()=>{await prisma.user.deleteMany({where:{id:owner}});await prisma.$disconnect();});
test('21 conversas continuam acessíveis e histórico conserva mensagens posteriores à 2000',async()=>{
 await prisma.user.create({data:{id:owner,email:`${owner}@example.invalid`,name:'Principal fictício sem login',role:'Analista'}});
 await prisma.chatSession.createMany({data:Array.from({length:21},(_,i)=>({id:`${owner}-${i}`,userId:owner,title:`Sessão sintética ${i}`,createdAt:new Date(1700000000000+i*1000)}))});
 const first=await sessionPage(owner,'Analista');assert.equal(first.items.length,20);assert.ok(first.nextCursor);
 const second=await sessionPage(owner,'Analista',first.nextCursor!);assert.equal(second.items.length,1);assert.equal(new Set([...first.items,...second.items].map(s=>s.id)).size,21);assert.equal(second.nextCursor,null);
 await assert.rejects(()=>sessionPage('outro-principal','Leitor',first.nextCursor!));
 const sessionId=first.items[0].id;await prisma.chatMessage.createMany({data:Array.from({length:2002},(_,i)=>({id:`${owner}-message-${i}`,sessionId,role:'user',parts:[{type:'text',text:`Mensagem fictícia ${i}`}],createdAt:new Date(1700000000000+i*1000)}))});
 const messages=await sessionMessages(sessionId,owner,'Analista');assert.equal(messages.length,2002);assert.match(messages.at(-1)!.parts[0].text,/2001/);
});
