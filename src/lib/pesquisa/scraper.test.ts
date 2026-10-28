import {test} from 'node:test';import assert from 'node:assert/strict';
import {createScraper} from './scraper';
test('scraper respeita robots antes da rede e extrai artigo sem scripts/imagens',async()=>{
 let calls=0;const fetchPage=async()=>{calls++;return{url:'https://example.com/a',status:200,headers:new Headers({'content-type':'text/html'}),bytes:new TextEncoder().encode(`<html><head><title>Artigo</title></head><body><article><h1>Artigo</h1><p>${'Texto público importante para pesquisa. '.repeat(30)}</p><script>roubar()</script><img src="https://tracker.invalid" /></article></body></html>`)};};
 const blocked=createScraper({robots:async()=>({allowed:false,crawlDelay:1}),fetchPage});assert.equal(await blocked('https://example.com/a'),null);assert.equal(calls,0);
 const scrape=createScraper({robots:async()=>({allowed:true,crawlDelay:1}),fetchPage});const r=await scrape('https://example.com/a');assert.ok(r);assert.ok(r.content.includes('Texto público'));assert.ok(!r.content.includes('roubar()'));assert.equal(r.robotsAllowed,true);assert.equal(r.crawlDelayRespected,true);
});
test('scraper ignora tipo não permitido, login/desafio e corpo vazio',async()=>{
 for(const [type,text]of [['application/json','{}'],['text/html','<title>CAPTCHA</title>'],['text/html','']]){
 const scrape=createScraper({robots:async()=>({allowed:true,crawlDelay:1}),fetchPage:async()=>({url:'https://example.com/a',status:200,headers:new Headers({'content-type':type}),bytes:new TextEncoder().encode(text)})});assert.equal(await scrape('https://example.com/a'),null);
 }
});
