import{test,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{prisma}from'../prisma';import{restoreResearchIndex}from'./cached-index';import type{ResearchSource,ResearchReport}from'./agent';
const users=[`qa-cache-a-${randomUUID()}`,`qa-cache-b-${randomUUID()}`];
after(async()=>{await prisma.documentChunk.deleteMany({where:{userId:{in:users}}});await prisma.documentSource.deleteMany({where:{userId:{in:users}}});await prisma.$disconnect();});
test('cache/replay cria base privada do solicitante e repetição não duplica fontes',async()=>{
 const sources:ResearchSource[]=[{url:'https://example.invalid/norma-sintetica',title:'Documento inteiramente fictício',snippet:'Resumo público de teste',score:1,type:'web',origin:'tavily',n:1,robotsAllowed:true,collected:true}];const report:ResearchReport={sections:[{heading:'Conclusão',content:'Relatório inteiramente fictício: a norma de teste prevê prazo de 35 dias.'}],sourceIndex:[],references:[]};const contents:[string,string][]=[[sources[0].url,'TEXTO COLETADO COMPLETO FICTÍCIO. O prazo de teste é 35 dias.']];
 await restoreResearchIndex(users[0],'Consulta fictícia',sources,report,contents);
 assert.equal(await prisma.documentSource.count({where:{userId:users[1]}}),0);
 await restoreResearchIndex(users[1],'Consulta fictícia',sources,report,contents);
 const docs=await prisma.documentSource.findMany({where:{userId:users[1],sourceType:'web_research'}});assert.equal(docs.length,2);
 const source=docs.find(d=>d.originUrl===sources[0].url)!;const rows=await prisma.documentChunk.findMany({where:{sourceId:source.id}});assert.match(rows[0].content,/TEXTO COLETADO COMPLETO/);
 await restoreResearchIndex(users[1],'Consulta fictícia',sources,report,contents);assert.equal(await prisma.documentSource.count({where:{userId:users[1]}}),2);
 assert.equal((await prisma.documentChunk.findMany({where:{sourceId:source.id,userId:users[0]}})).length,0);
});
