import{test}from'node:test';import assert from'node:assert/strict';import{visibleMessage}from'./history-core';
test('histórico não devolve texto de resposta baseado em fonte cujo acesso foi revogado',()=>{
 const row={id:'m',role:'assistant',parts:[{type:'text',text:'Segredo interno AURORA-27'}],citations:[{n:1,sourceId:'restricted',filename:'Norma interna',snippet:'Segredo',score:1}]};const m=visibleMessage(row,new Set(),false);assert.ok(!JSON.stringify(m).includes('AURORA-27'));assert.ok(JSON.stringify(m).includes('fonte restrita'));
});
test('histórico mascara texto completo e restaura metadata de cache sem duplicar partes',()=>{
 const m=visibleMessage({id:'m',role:'assistant',parts:[{type:'text',text:'Contato pessoa@example.com'},{type:'data-meta',data:{cacheHit:true}}],citations:[]},new Set(),true);assert.ok(!JSON.stringify(m).includes('pessoa@example.com'));assert.equal(m.metadata?.cacheHit,true);assert.equal(m.parts.length,1);
});
test('citação de relatório autorizado permanece visível e a indisponível oculta o corpo',()=>{
 const row={id:'m',role:'assistant',parts:[{type:'text',text:'Código DEMO-4826 [1]'}],citations:[{n:1,sourceId:'report-1',reportId:'report-1',kind:'report',filename:'Relatório',snippet:'Código DEMO-4826',score:1}]};assert.ok(JSON.stringify(visibleMessage(row,new Set(['report-1']),false)).includes('DEMO-4826'));assert.ok(!JSON.stringify(visibleMessage(row,new Set(),false)).includes('DEMO-4826'));
});
test('mascaramento também remove dados pessoais do endereço de origem nas citações',()=>{
 const row={id:'m',role:'assistant',parts:[{type:'text',text:'Fonte pública [1]'}],citations:[{n:1,sourceId:'publica',filename:'Contato',snippet:'Resumo',originUrl:'https://example.invalid/contato?email=pessoa@example.com',score:1}]};
 assert.ok(!JSON.stringify(visibleMessage(row,new Set(['publica']),true)).includes('pessoa@example.com'));
 assert.ok(JSON.stringify(visibleMessage(row,new Set(['publica']),false)).includes('pessoa@example.com'));
});
test('relatório legado truncado mostra texto legível e conserva a numeração original',()=>{
 const report={sections:[{heading:'Resumo',content:'Oito fontes, uma coletada [2].'}],sourceIndex:[],references:[]};
 const row={id:'m',role:'assistant',parts:[{type:'text',text:'Resposta [1]'}],citations:[{n:1,sourceId:'r',reportId:'r',kind:'report',filename:'Relatório',snippet:'{"sections":[{"heading":"Resumo","content":"Oito',score:1}]};
 const message=visibleMessage(row,new Set(['r']),false,new Map([['r',report]]));
 assert.equal(message.citations[0].snippet,'Resumo\n\nOito fontes, uma coletada (referência original nº 2).');
});
test('texto legível do relatório mantém mascaramento e bloqueio de acesso',()=>{
 const report={sections:[{heading:'Contato',content:'pessoa@example.invalid'}]};
 const row={id:'m',role:'assistant',parts:[{type:'text',text:'Resposta'}],citations:[{n:1,sourceId:'r',kind:'report',filename:'Relatório',snippet:'JSON legado',score:1}]};
 const reports=new Map([['r',report]]);
 assert.ok(!JSON.stringify(visibleMessage(row,new Set(['r']),true,reports)).includes('pessoa@example.invalid'));
 assert.equal(visibleMessage(row,new Set(),false,reports).citations[0].snippet,'');
 assert.equal(visibleMessage(row,new Set(['r']),false,reports).citations[0].snippet,'Contato\n\npessoa@example.invalid');
});
