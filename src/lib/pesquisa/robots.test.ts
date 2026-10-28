import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRobotsChecker} from './robots';
test('robots: bloqueio, caminho permitido, crawl-delay e cache de uma hora por origem',async()=>{
 let calls=0;let now=0;const check=createRobotsChecker(async()=>{calls++;return{status:200,text:'User-agent: IntelliSuiteBot\nDisallow: /privado\nAllow: /privado/aberto\nCrawl-delay: 2'};},()=>now);
 assert.equal((await check('https://example.com/privado')).allowed,false);
 const r=await check('https://example.com/privado/aberto');assert.equal(r.allowed,true);assert.equal(r.crawlDelay,2);assert.equal(calls,1);
 now=3_600_001;await check('https://example.com/a');assert.equal(calls,2);
});
test('robots: 404 permite, 403/5xx/timeout/desafio HTML bloqueiam sem exceção',async()=>{
 for(const status of [403,500])assert.equal((await createRobotsChecker(async()=>({status,text:''}))('https://example.com/a')).allowed,false);
 assert.equal((await createRobotsChecker(async()=>({status:404,text:''}))('https://example.com/a')).allowed,true);
 assert.equal((await createRobotsChecker(async()=>{throw Error('rede');})('https://example.com/a')).allowed,false);
 assert.equal((await createRobotsChecker(async()=>({status:200,text:'<!doctype html>Captcha'}))('https://example.com/a')).allowed,false);
});
