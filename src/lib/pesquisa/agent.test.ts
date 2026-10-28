import {test} from 'node:test';import assert from 'node:assert/strict';
import {MockLanguageModelV4,convertArrayToReadableStream} from 'ai/test';
import {runResearch,DEFAULT_RESEARCH_TEMPLATE,type ResearchMessage} from './agent';
import type {UIMessageStreamWriter} from 'ai';
const usage={inputTokens:{total:50,noCache:50,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:20,text:20,reasoning:undefined}};
const finishReason={unified:'stop',raw:undefined} as const;
const generated=(value:unknown)=>({content:[{type:'text',text:JSON.stringify(value)}],usage,finishReason,warnings:[]}) as never;
function models(classifyOnly=false){let calls=classifyOnly?1:0;return{fast:new MockLanguageModelV4({doGenerate:async()=>generated(++calls===1?{intent:'Verificar legislação',queries:['CLT atualização','CLT direitos']}:{sources:[{n:1,category:'Trabalho',topics:['CLT'],relevance:0.9,summary:'Fonte oficial'},{n:99,category:'Inventada',topics:[],relevance:1,summary:'Intrusa'}]})}),main:new MockLanguageModelV4({doStream:async()=>({stream:convertArrayToReadableStream([{type:'stream-start',warnings:[]},{type:'text-start',id:'x'},{type:'text-delta',id:'x',delta:JSON.stringify({sections:[{title:'Contexto',content:'Conforme [1], direito verificado. [99]'}]})},{type:'text-end',id:'x'},{type:'finish',finishReason,usage}] as never[])}) as never})};}
const source={url:'https://gov.br/lei',title:'Lei',snippet:'Fonte real',score:0.9,type:'gov' as const,origin:'searxng' as const};
const deps={search:async()=>[source],robots:async()=>({allowed:true,crawlDelay:1,checkedAt:new Date().toISOString()}),extract:async()=>[],scrape:async()=>({url:source.url,title:'Lei',content:'Direito previsto na norma.',fetchedAt:new Date().toISOString(),robotsAllowed:true as const,crawlDelayRespected:true as const})};
test('agente: pausa antes de pesquisar permite editar queries',async()=>{
 let called=false;const r=await runResearch({query:'CLT',filter:'gov',confirmQueries:true,template:DEFAULT_RESEARCH_TEMPLATE,models:models(),settings:{temperature:0,maxOutputTokens:4096},writer:{write:()=>{}} as Pick<UIMessageStreamWriter<ResearchMessage>,'write'>,deps:{...deps,search:async()=>{called=true;return[];}}});assert.equal(called,false);assert.equal(r.phase,'queries');assert.ok(r.queries.length>=2);
});
test('agente: fontes conferidas, seções do usuário, referências reais e nenhuma citação inventada',async()=>{
 const parts:unknown[]=[];let indexed=false;
 const r=await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:{sections:[{title:'Contexto'}],format:DEFAULT_RESEARCH_TEMPLATE.format},models:models(true),settings:{temperature:0,maxOutputTokens:4096},writer:{write:p=>{parts.push(p);}},deps,index:async()=>{indexed=true;}});
 assert.equal(r.phase,'final');if(r.phase!=='final')return;assert.equal(indexed,true);assert.deepEqual(r.report.sections.map(s=>s.heading),['Contexto','Referências']);assert.ok(r.report.references.every(s=>s.url===source.url));assert.equal(r.sources.length,1);assert.ok(!r.report.sections[0].content.includes('[99]'));assert.ok(parts.length>4);
});
test('research accounts each auxiliary call before the main result is completed',async()=>{const calls:string[]=[];await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:DEFAULT_RESEARCH_TEMPLATE,models:models(true),settings:{temperature:0,maxOutputTokens:4096},writer:{write:()=>{}},deps,onUsage:(kind,u)=>{assert.equal(u.inputTokens,50);calls.push(kind);}});assert.deepEqual(calls,['fast','main']);});
test('research synthesis reserves output for six sections and uses low effort for bounded latency',async()=>{const selected=models(true);await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:DEFAULT_RESEARCH_TEMPLATE,models:selected,settings:{temperature:0,maxOutputTokens:4096},writer:{write:()=>{}},deps});assert.ok(selected.main.doStreamCalls[0].maxOutputTokens!>=8000);assert.deepEqual(selected.main.doStreamCalls[0].providerOptions?.anthropic,{effort:'low'});});
test('allowed pages collect concurrently while each source failure remains isolated',async()=>{const events:string[]=[];const sources=[1,2,3].map(n=>({...source,url:`https://source${n}.example/lei`}));await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:DEFAULT_RESEARCH_TEMPLATE,models:models(true),settings:{temperature:0,maxOutputTokens:4096},writer:{write:()=>{}},deps:{...deps,search:async()=>sources,scrape:async url=>{events.push(`start:${url}`);await new Promise(r=>setTimeout(r,10));events.push(`done:${url}`);if(url.includes('source2.'))throw Error('Falha fictícia isolada');return{url,title:'Fonte fictícia',content:'Texto público fictício.',fetchedAt:new Date().toISOString(),robotsAllowed:true,crawlDelayRespected:true};}}});assert.deepEqual(events.slice(0,3),sources.map(s=>`start:${s.url}`));});
test('classificação por metadados começa durante a coleta sem perder o texto na síntese',async()=>{
 let classificationStarted=false,sawOverlap=false;const selected=models(true);
 const fast=new MockLanguageModelV4({doGenerate:async()=>{classificationStarted=true;return generated({sources:[{n:1,category:'Trabalho',topics:['CLT'],relevance:0.9,summary:'Fonte oficial'}]});}});
 await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:DEFAULT_RESEARCH_TEMPLATE,models:{main:selected.main,fast},settings:{temperature:0,maxOutputTokens:4096},writer:{write:()=>{}},deps:{...deps,scrape:async()=>{await new Promise(r=>setTimeout(r,20));sawOverlap=classificationStarted;return{url:source.url,title:'Lei',content:'TEXTO_COLETADO_PRESERVADO_8372',fetchedAt:new Date().toISOString(),robotsAllowed:true,crawlDelayRespected:true};}}});
 assert.ok(sawOverlap);assert.ok(!JSON.stringify(fast.doGenerateCalls).includes('TEXTO_COLETADO_PRESERVADO_8372'));assert.ok(JSON.stringify(selected.main.doStreamCalls).includes('TEXTO_COLETADO_PRESERVADO_8372'));
});
test('referências são montadas das fontes sem pedir ao LLM para reescrever URLs descartadas',async()=>{
 const selected=models(true);const r=await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:{sections:[{title:'Contexto'},{title:'Referências'}],format:DEFAULT_RESEARCH_TEMPLATE.format},models:selected,settings:{temperature:0,maxOutputTokens:4096},writer:{write:()=>{}},deps});
 assert.ok(!JSON.stringify(selected.main.doStreamCalls[0].prompt).includes('2. \\"Referências\\"'));if(r.phase!=='final')throw Error('incompleto');assert.deepEqual(r.report.sections.map(s=>s.heading),['Contexto','Referências']);assert.ok(r.report.sections[1].content.includes(source.url));
});
test('custo auxiliar concluído é registrado mesmo se a coleta for cancelada depois',async()=>{
 const controller=new AbortController();const selected=models(true);const calls:string[]=[];
 await assert.rejects(runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:DEFAULT_RESEARCH_TEMPLATE,models:selected,settings:{temperature:0,maxOutputTokens:4096},signal:controller.signal,writer:{write:()=>{}},deps:{...deps,scrape:async()=>{await new Promise(r=>setTimeout(r,20));controller.abort();return null;}},onUsage:kind=>{calls.push(kind);}}),{name:'AbortError'});
 assert.deepEqual(calls,['fast']);
});
test('coleta travada encerra no orçamento e relatório distingue metadados de texto lido',{timeout:1000},async()=>{
 const selected=models(true);const r=await runResearch({query:'CLT',filter:'gov',queries:['CLT'],template:DEFAULT_RESEARCH_TEMPLATE,models:selected,settings:{temperature:0,maxOutputTokens:4096},collectionBudgetMs:15,writer:{write:()=>{}},deps:{...deps,scrape:async()=>new Promise(()=>{})}});
 if(r.phase!=='final')throw Error('relatório incompleto');assert.equal(r.sources[0].collected,false);assert.ok(JSON.stringify(selected.main.doStreamCalls).includes('Somente metadados'));
});
