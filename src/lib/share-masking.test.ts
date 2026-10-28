import{test}from'node:test';import assert from'node:assert/strict';import{prisma}from'./prisma';import{resolveShared}from'./share';
test('compartilhamento mascara título e todos os campos de relatório conforme perfil receptor',async()=>{
 const undo:(()=>void)[]=[];const stub=(target:object,key:string,fn:unknown)=>{const obj=target as Record<string,unknown>,old=obj[key];obj[key]=fn;undo.push(()=>{obj[key]=old;});};
 const pii='Contato teste@example.invalid CPF 529.982.247-25';let kind='report';
 stub(prisma.shareLink,'findUnique',async()=>({kind,targetId:'fixture',expiresAt:new Date(Date.now()+60000),revokedAt:null}) as never);
 stub(prisma.appSetting,'findUnique',async({where}:{where:{key:string}})=>({value:where.key==='contentFilters'?{Leitor:true,Admin:false}:true}) as never);
 stub(prisma.researchReport,'findUnique',async()=>({query:pii,report:{sections:[{heading:pii,content:pii}],references:[{title:pii,url:'https://example.invalid/?email=teste@example.invalid'}]},modelUsed:'fixture',createdAt:new Date()}) as never);
 stub(prisma.chatSession,'findUnique',async()=>({id:'fixture',title:pii}) as never);
 stub(prisma.chatMessage,'findMany',async()=>[] as never);stub(prisma.documentSource,'findMany',async()=>[] as never);stub(prisma.researchReport,'findMany',async()=>[] as never);stub(prisma.collection,'findMany',async()=>[] as never);
 try{
  const report=await resolveShared('A'.repeat(43),'viewer','Leitor');assert.ok(report);assert.doesNotMatch(JSON.stringify(report),/teste@example\.invalid|529\.982\.247-25/);assert.match(JSON.stringify(report),/ocultado/);
  const admin=await resolveShared('A'.repeat(43),'viewer','Admin');assert.match(JSON.stringify(admin),/teste@example\.invalid/);
  kind='chat';const chat=await resolveShared('A'.repeat(43),'viewer','Leitor');assert.doesNotMatch(JSON.stringify(chat),/teste@example\.invalid|529\.982\.247-25/);
 }finally{for(const restore of undo.reverse())restore();}
});
