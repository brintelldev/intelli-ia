import{test}from'node:test';import assert from'node:assert/strict';import{renderToStaticMarkup}from'react-dom/server';import{MessageBubble}from'./MessageBubble';import{SourceFilter}from'./SourceFilter';
test('mensagem usa Markdown seguro, citações clicáveis e aviso de conhecimento geral',()=>{
 const html=renderToStaticMarkup(<MessageBubble text={'Resposta [1] ![x](https://tracker.invalid) <script>ruim</script>'} role="assistant" citations={[{n:1,sourceId:'d',filename:'Norma',snippet:'Trecho',score:0.9}]} generalKnowledge onCitation={()=>{}}/>);assert.ok(html.includes('#cit-1'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('conhecimento geral'));
});
test('filtro oferece base especializada e categorias normativas sem esconder controle de acesso no cliente',()=>{
 const html=renderToStaticMarkup(<SourceFilter value="base" onChange={()=>{}} kind="normativa" onKind={()=>{}}/>);assert.ok(html.includes('Base especializada'));assert.ok(html.includes('Normativas'));assert.ok(html.includes('Referências oficiais'));
});
