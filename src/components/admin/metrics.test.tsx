import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {summarizeMetrics} from '@/lib/admin/metrics-core';
import {MetricsView} from './MetricsDashboard';
test('dashboard exposes costs, budget warning, cache rates and operation counts accessibly',()=>{
 const stats={...summarizeMetrics([],[]),syntheticEvents:0,replayOperations:0,topUsers:[],recentErrors:[],topDocCategories:[],monthProjection:3,budget:{todayUsd:4.1,limitUsd:5,level:'warn' as const},tavily:{used:7,limit:1000,safetyLimit:850},range:{from:'',to:'',timezone:'America/Sao_Paulo'}};
 const html=renderToStaticMarkup(<MetricsView data={stats}/>);
 assert.match(html,/80%/);assert.match(html,/7 de 1000/);assert.match(html,/Cache/);assert.match(html,/Nenhuma operação/);assert.match(html,/Projeção/);
});
