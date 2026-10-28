import{test}from'node:test';import assert from'node:assert/strict';import{researchExport}from'./workspace';
test('exportação da pesquisa inclui seções, índice temático, citações e tabela para Excel',()=>{
 const e=researchExport('Pesquisa de teste',{sections:[{heading:'Resumo',content:'Resumo [1]'}],references:[{label:'Fonte',url:'https://gov.br/x',score:0.9}],sourceIndex:[{n:1,title:'Norma',category:'Trabalho',topics:['CLT'],summary:'Norma pública',relevance:0.9}]},'Haiku','2026-10-26');
 assert.equal(e.sections[1].heading,'Índice analítico das fontes');assert.equal(e.table?.rows[0][1],'Norma');assert.equal(e.citations?.[0].url,'https://gov.br/x');assert.equal(e.metadata.modelo,'Haiku');
});
