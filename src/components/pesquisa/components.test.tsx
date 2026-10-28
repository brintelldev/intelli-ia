import{test}from'node:test';import assert from'node:assert/strict';import{renderToStaticMarkup}from'react-dom/server';import{SourceResultCard}from'./SourceResultCard';import{AgentReasoningPanel}from'./AgentReasoningPanel';
test('fonte mostra origem/score/regra de coleta sem HTML externo ou imagem rastreadora',()=>{
 const html=renderToStaticMarkup(<SourceResultCard source={{url:'https://gov.br/lei',title:'Norma <script>mal</script>',snippet:'Resumo público',score:0.82,type:'gov',origin:'lexml',n:1,robotsAllowed:false,collected:false,category:'Trabalho'}}/>);
 assert.ok(html.includes('LexML'));assert.ok(html.includes('0,82'));assert.ok(html.includes('Acesso restrito'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
});
test('timeline mostra etapa/cache e conta fontes sem simular raciocínio oculto',()=>{
 const html=renderToStaticMarkup(<AgentReasoningPanel steps={[{id:'cache',label:'Resultado recuperado',status:'done',ms:20,cacheHit:true,sources:5}]}/>);assert.ok(html.includes('Resultado em cache'));assert.ok(html.includes('5 fontes'));
});
