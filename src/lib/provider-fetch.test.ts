import test from'node:test';import assert from'node:assert/strict';import{createProviderFetch}from'./provider-fetch';
test('provider HTTP deadline covers stalled calls and preserves user cancellation',async()=>{const fetcher=createProviderFetch(async(_url,opts)=>new Promise((_resolve,reject)=>{opts?.signal?.addEventListener('abort',()=>reject(opts.signal!.reason),{once:true});}),15);const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(fetcher('https://example.com'),{name:'TimeoutError'});const controller=new AbortController();const p=fetcher('https://example.com',{signal:controller.signal});controller.abort();await assert.rejects(p,{name:'AbortError'});}finally{clearTimeout(keepAlive);}});
test('prazo de conexão permite fallback sem cortar um stream que já começou',async()=>{
 const slowHeaders=createProviderFetch(async()=>{await new Promise(r=>setTimeout(r,25));return new Response('ok');},100,5);
 await assert.rejects(slowHeaders('https://example.invalid'),{name:'TimeoutError'});
 const streaming=createProviderFetch(async(_url,opts)=>new Response(new ReadableStream({start(c){const timer=setTimeout(()=>{c.enqueue(new TextEncoder().encode('ok'));c.close();},25);opts?.signal?.addEventListener('abort',()=>{clearTimeout(timer);c.error(opts.signal!.reason);},{once:true});}})),100,5);
 assert.equal(await(await streaming('https://example.invalid')).text(),'ok');
});
