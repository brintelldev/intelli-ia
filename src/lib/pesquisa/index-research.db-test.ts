import {test,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {indexResearch} from './index-research';import {prisma} from '../prisma';
const userId=`research-test-${randomUUID()}`;
after(async()=>{await prisma.documentChunk.deleteMany({where:{userId}});await prisma.documentSource.deleteMany({where:{userId}});await prisma.$disconnect();});
test('indexa fonte coletada e relatório como web_research com tópicos/categoria/resumo',async()=>{
 await indexResearch(userId,'Pesquisa CLT',[{url:'https://gov.br/test',title:'Norma sintética',snippet:'Teste',score:1,type:'gov',origin:'searxng',n:1,robotsAllowed:true,collected:true,category:'Trabalho',topics:['Vigência'],summary:'Uma norma de teste.'}],new Map([['https://gov.br/test','O prazo de vigência da norma sintética é de doze meses.']]),{sections:[{heading:'Resumo',content:'Uma norma com vigência de doze meses.'}],references:[],sourceIndex:[]});
 const docs=await prisma.documentSource.findMany({where:{userId}});assert.equal(docs.length,2);assert.ok(docs.every(d=>d.sourceType==='web_research'&&d.chunkCount>0));assert.equal(docs.find(d=>d.originUrl)?.category,'Trabalho');
});
