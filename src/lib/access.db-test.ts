import{test,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{prisma}from'./prisma';import{getAccessScope,canSeeSource}from'./access';import{embed}from'./embeddings';import{insertChunks,similaritySearch}from'./vector-store';
const tag=`access-${randomUUID()}`;let collectionId='';
after(async()=>{await prisma.documentChunk.deleteMany({where:{userId:tag}});await prisma.documentSource.deleteMany({where:{userId:tag}});if(collectionId)await prisma.collection.deleteMany({where:{id:collectionId}});await prisma.$disconnect();});
test('revogação/adição em allowedUserIds muda escopo e resultado vetorial na próxima busca',async()=>{
 const c=await prisma.collection.create({data:{name:tag,kind:'normativa',allowedRoles:['Analista'],allowedUserIds:[],createdById:tag}});collectionId=c.id;
 const vec=await embed('Norma interna sobre aprovação de projetos.');const src=await prisma.documentSource.create({data:{userId:tag,filename:'Norma sintética',sourceType:'base',collectionId:c.id,topics:['Projetos'],chunkCount:1}});await insertChunks([{sourceId:src.id,userId:tag,collectionId:c.id,sourceType:'base',content:'Norma interna sobre aprovação de projetos.',embedding:vec,metadata:{index:0,startPage:1}}]);
 const reader=await getAccessScope(`${tag}-reader`,'Leitor');assert.equal(canSeeSource(reader,src),false);assert.equal((await similaritySearch({embedding:vec,topK:5,minScore:0.9,access:reader,sourceId:src.id})).length,0);
 const analyst=await getAccessScope(`${tag}-analyst`,'Analista');assert.equal((await similaritySearch({embedding:vec,topK:5,minScore:0.9,access:analyst,sourceId:src.id})).length,1);
 await prisma.collection.update({where:{id:c.id},data:{allowedUserIds:[`${tag}-reader`]}});const expanded=await getAccessScope(`${tag}-reader`,'Leitor');assert.equal((await similaritySearch({embedding:vec,topK:5,minScore:0.9,access:expanded,sourceId:src.id})).length,1);
 await prisma.collection.update({where:{id:c.id},data:{allowedUserIds:[]}});assert.equal(canSeeSource(await getAccessScope(`${tag}-reader`,'Leitor'),src),false);
});
