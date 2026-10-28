import {test} from 'node:test';import assert from 'node:assert/strict';import {ResearchBody,researchCacheKey} from './request';import {DEFAULT_RESEARCH_TEMPLATE} from './agent';
test('pedido de pesquisa valida consulta/filtro e limita queries confirmadas',()=>{
 assert.equal(ResearchBody.safeParse({query:' ',filter:'gov'}).success,false);assert.equal(ResearchBody.safeParse({query:'CLT',queries:['a','b','c','d']}).success,false);assert.equal(ResearchBody.parse({query:' CLT '}).query,'CLT');
});
test('cache não mistura modelos, consultas editadas ou critérios/seções',async()=>{
 const a=await researchCacheKey('CLT','gov',DEFAULT_RESEARCH_TEMPLATE,'modelo-a');
 assert.notEqual(a,await researchCacheKey('CLT','gov',DEFAULT_RESEARCH_TEMPLATE,'modelo-b'));
 assert.notEqual(a,await researchCacheKey('CLT','gov',DEFAULT_RESEARCH_TEMPLATE,'modelo-a',['mudança CLT']));
 assert.notEqual(a,await researchCacheKey('CLT','gov',{...DEFAULT_RESEARCH_TEMPLATE,sections:[{title:'Impacto'}]},'modelo-a'));
});
