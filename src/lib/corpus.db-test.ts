import{test,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{prisma}from'./prisma';import{addCorpusSource,corpusSourceId}from'../../prisma/corpus-source';
const userId=`qa-corpus-${randomUUID()}`;const doc={collectionId:userId,title:'Documento sintético para recuperação do seed',url:'',topics:['QA'],text:'Norma fictícia: a entrega será realizada em dez dias. Este conteúdo é apenas um teste.',license:'Documento sintético',provenance:{textSha256:'versao1',rawSha256:'ficticio',edition:'QA',fetchedAt:new Date().toISOString(),robotsAllowed:true}};
const vectors=async(texts:string[])=>texts.map(()=>[1,...Array(383).fill(0)] as number[]);
after(async()=>{await prisma.documentChunk.deleteMany({where:{userId}});await prisma.documentSource.deleteMany({where:{userId}});await prisma.$disconnect();});
test('seed repara fonte interrompida, não duplica e reverte falha de substituição',async()=>{
 const id=corpusSourceId(doc);await prisma.documentSource.create({data:{id,userId,collectionId:userId,filename:doc.title,sourceType:'base',topics:[],chunkCount:42}});
 assert.equal(await addCorpusSource(doc,userId,vectors),'repaired');
 assert.equal(await addCorpusSource(doc,userId,async()=>{throw Error('não deve recalcular');}),'existing');
 assert.equal(await prisma.documentSource.count({where:{id}}),1);
 const before=await prisma.documentChunk.findMany({where:{sourceId:id},select:{content:true,metadata:true}});assert.ok(before.length>0);
 const changed={...doc,text:'Conteúdo sintético novo que não deve persistir após falha na gravação dos vetores.',provenance:{...doc.provenance,textSha256:'versao2'}};
 await assert.rejects(addCorpusSource(changed,userId,async()=>[[1,2]]));
 const after=await prisma.documentChunk.findMany({where:{sourceId:id},select:{content:true,metadata:true}});assert.deepEqual(after,before);
 assert.equal((await prisma.documentSource.findUniqueOrThrow({where:{id}})).chunkCount,before.length);
});
test('referência explícita recupera artigo selecionado sem atravessar autorização',async()=>{
 const {insertChunks,similaritySearch}=await import('./vector-store');const sourceId=`qa-ref-${randomUUID()}`;
 const v=[1,...Array(383).fill(0)],q=[0,1,...Array(382).fill(0)];
 try{
  await insertChunks([{sourceId,userId,sourceType:'base',content:'Art. 922. Este é o dispositivo específico pretendido.',embedding:v,metadata:{index:0,startPage:1}},{sourceId,userId,sourceType:'base',content:'Art. 9220. Outro artigo com assunto semanticamente idêntico à pergunta.',embedding:q,metadata:{index:1,startPage:1}}]);
  const p={embedding:q,query:'O que diz o art. 922?',topK:1,sourceId,access:{userId,isAdmin:false,collectionIds:[]}};
  assert.match((await similaritySearch(p))[0].content,/Art. 922\./);
  assert.deepEqual(await similaritySearch({...p,access:{userId:userId+'-sem-acesso',isAdmin:false,collectionIds:[]}}),[]);
 }finally{await prisma.documentChunk.deleteMany({where:{sourceId}});}
});
