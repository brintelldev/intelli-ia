import{test}from'node:test';import assert from'node:assert/strict';import{cachedResearchContents}from'./cached-index';import type{ResearchSource}from'./agent';
const source:ResearchSource={url:'https://example.invalid/publico',title:'Fonte',snippet:'Resumo público',score:1,type:'web',origin:'tavily',n:1,robotsAllowed:true,collected:true};
test('cache preserva conteúdo coletado e rejeita conteúdo fora das fontes permitidas',()=>{
 const contents=cachedResearchContents([source],[['https://example.invalid/outro','injetado'],[source.url,'TEXTO COLETADO INTEGRAL']]);assert.equal(contents.size,1);assert.equal(contents.get(source.url),'TEXTO COLETADO INTEGRAL');
 assert.equal(cachedResearchContents([{...source,robotsAllowed:false}],[[source.url,'bloqueado']]).size,0);
 const legacy=cachedResearchContents([source]);assert.match(legacy.get(source.url)!,/resumo/i);assert.match(legacy.get(source.url)!,/integral.*indisponível/i);
});
