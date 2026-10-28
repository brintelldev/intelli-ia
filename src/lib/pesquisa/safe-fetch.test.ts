import {test} from 'node:test';import assert from 'node:assert/strict';
import {assertPublicUrl,safeFetch} from './safe-fetch';
test('anti-SSRF: IPv4, IPv6, mapeado, URL numérica, metadados, DNS privado e credenciais',async()=>{
 for(const url of ['http://127.0.0.1','http://2130706433','http://169.254.169.254','http://[::1]','http://[::ffff:127.0.0.1]','http://10.0.0.1','file:///etc/passwd','https://user:password@example.com'])await assert.rejects(()=>assertPublicUrl(url));
 await assert.rejects(()=>assertPublicUrl('https://example.com',async()=>[{address:'10.0.0.1',family:4}]));
});
test('redirect privado é bloqueado antes da segunda requisição; máximo três redirects e limite bytes',async()=>{
 let calls=0;const opts={resolve:async()=>[{address:'93.184.216.34',family:4}],throttle:false,transport:async()=>{calls++;return new Response('',{status:302,headers:{location:'http://127.0.0.1'}});}};
 await assert.rejects(()=>safeFetch('https://example.com',opts));assert.equal(calls,1);
 await assert.rejects(()=>safeFetch('https://example.com',{...opts,transport:async()=>new Response('x'.repeat(12)),maxBytes:10}));
 calls=0;await assert.rejects(()=>safeFetch('https://example.com',{...opts,transport:async()=>{calls++;return new Response('',{status:302,headers:{location:'/next'}});}}));assert.equal(calls,4);
});
test('deadline includes a stalled DNS resolver before any network connection',async()=>{const controller=new AbortController();let sent=false;const pending=safeFetch('https://dns-stalled.example',{signal:controller.signal,resolve:()=>new Promise(()=>{}),transport:async()=>{sent=true;return new Response('não deve enviar');}});setTimeout(()=>controller.abort(new DOMException('Cancelado no DNS','AbortError')),10);await assert.rejects(Promise.race([pending,new Promise((_,reject)=>setTimeout(()=>reject(Error('DNS não respeitou deadline')),100))]),{name:'AbortError'});assert.equal(sent,false);});
