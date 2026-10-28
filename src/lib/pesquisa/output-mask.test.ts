import{test}from'node:test';import assert from'node:assert/strict';import{maskResearchOutput,maskResearchRecording}from'./output-mask';
test('pesquisa mascara PII em consultas, etapas, fontes e relatório preservando tipos e IDs',()=>{
 const pii='Contato qa@example.invalid CPF 529.982.247-25 telefone (21) 98888-7777';const raw={type:'data-research',id:'research',data:{phase:'final',reportId:'report-52998224725',createdAt:'2026-10-28T10:00:00Z',query:pii,queries:[pii],sources:[{url:'https://example.invalid/?email=qa@example.invalid',title:pii,collected:true,score:0.8}],report:{sections:[{heading:pii,content:pii}],references:[{label:pii,url:'https://example.invalid/?email=qa@example.invalid'}]}}};
 const safe=maskResearchOutput(raw,true);assert.doesNotMatch(JSON.stringify(safe),/qa@example\.invalid|529\.982\.247-25|98888-7777/);assert.equal(safe.data.reportId,raw.data.reportId);assert.equal(safe.data.phase,'final');assert.equal(safe.data.createdAt,raw.data.createdAt);assert.equal(safe.data.sources[0].score,0.8);assert.equal(safe.data.sources[0].collected,true);assert.equal(maskResearchOutput(raw,false),raw);assert.doesNotMatch(maskResearchOutput({type:'data-step',id:'interpret',data:{label:pii}},true).data.label,/qa@example/);
});
test('replay legado de pesquisa é mascarado antes de retornar ao navegador',()=>{
 const body='data: '+JSON.stringify({type:'data-research',id:'research',data:{phase:'final',reportId:'r',report:{sections:[{heading:'Contato',content:'qa@example.invalid CPF 529.982.247-25'}]}}})+'\n\ndata: [DONE]\n\n';
 const safe=maskResearchRecording({body,status:200,contentType:'text/event-stream'},true);assert.doesNotMatch(safe.body,/qa@example\.invalid|529\.982\.247-25/);assert.ok(safe.body.includes('data: [DONE]'));assert.equal(JSON.parse(safe.body.split('\n')[0].slice(6)).data.reportId,'r');assert.equal(maskResearchRecording({body,status:200,contentType:'text/event-stream'},false).body,body);
});
test('URLs codificadas e duplamente codificadas não expõem dados ao decodificar',()=>{
 const raw={originUrl:'https://example.invalid/?email=qa%40example.invalid',url:'https://example.invalid/529%2E982%2E247%2D25',references:[{url:'https://example.invalid/?q=qa%2540example.invalid'}],report:{content:'Fonte: https://example.invalid/?q=qa%40example.invalid'}};
 const safe=maskResearchOutput(raw,true);assert.equal(safe.url,'');assert.equal(safe.originUrl,'');assert.equal(safe.references[0].url,'');assert.ok(!decodeURIComponent(JSON.stringify(safe)).includes('qa@example.invalid'));
 assert.equal(maskResearchOutput({url:'https://example.invalid/?q=publico%20seguro'},true).url,'https://example.invalid/?q=publico%20seguro');
});
