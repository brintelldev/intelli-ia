import{test}from'node:test';import assert from'node:assert/strict';import{renderToStaticMarkup}from'react-dom/server';import{ResearchHistoryList}from'./ResearchHistorySidebar';
test('histórico mostra consulta/data e ponte report com identificador próprio',()=>{
 const html=renderToStaticMarkup(<ResearchHistoryList items={[{id:'report-123',query:'CLT sintética',createdAt:'2026-10-26T12:00:00Z',modelUsed:'haiku',sourceFilter:'gov'}]} onSelect={()=>{}}/>);assert.ok(html.includes('CLT sintética'));assert.ok(html.includes('/chat?report=report-123'));assert.ok(html.includes('Continuar no Chat'));
});
