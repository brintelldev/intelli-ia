import {lookup} from 'node:dns/promises';import {isIP} from 'node:net';
import ipaddr from 'ipaddr.js';import {Agent,fetch as undiciFetch} from 'undici';
type Address={address:string;family:number};type Resolver=(hostname:string)=>Promise<Address[]>;
const resolveDefault:Resolver=host=>lookup(host,{all:true,verbatim:true});
export const BOT_USER_AGENT='IntelliSuiteBot/1.0 (+https://intellisuite.invalid/bot)';
function isPublic(address:string){try{return ipaddr.process(address).range()==='unicast';}catch{return false;}}
export async function assertPublicUrl(raw:string,resolve:Resolver=resolveDefault):Promise<{url:URL;addresses:Address[]}>{
 const url=new URL(raw);const host=url.hostname.replace(/^\[|\]$/g,'');
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!["80","443"].includes(url.port))throw Error('URL recusada');
 const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await resolve(host);
 if(!addresses.length||addresses.some(a=>!isPublic(a.address)))throw Error('Endereço de rede restrito');
 return{url,addresses};
}
async function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{signal.throwIfAborted();return new Promise<T>((resolve,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));if(signal.aborted)abort();});}
const nextRequest=new Map<string,number>();
async function schedule(origin:string,seconds:number,signal:AbortSignal){
 const now=Date.now(),start=Math.max(now,nextRequest.get(origin)??0);nextRequest.set(origin,start+Math.max(1,seconds)*1000);
 if(nextRequest.size>2000)for(const [k,v]of nextRequest)if(v<now)nextRequest.delete(k);
 if(start>now)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,start-now);function done(){signal.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(signal.reason);}signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 signal.throwIfAborted();
}
export type SafeFetchOptions={maxBytes?:number;signal?:AbortSignal;resolve?:Resolver;throttle?:boolean;delay?:number;beforeRequest?:(url:string)=>Promise<{allowed:boolean;crawlDelay?:number}>;transport?:(url:string,agent:Agent,signal:AbortSignal)=>Promise<Response>};
/** DNS validado e fixado na conexão; revalida cada redirect. Nenhum fetch automático de sub-recursos. */
export async function safeFetch(raw:string,opts:SafeFetchOptions={}):Promise<{url:string;status:number;headers:Headers;bytes:Uint8Array}>{
 const signal=AbortSignal.any([AbortSignal.timeout(10_000),...(opts.signal?[opts.signal]:[])]);let target=raw;
 const resolve=opts.resolve??resolveDefault;
 for(let redirects=0;redirects<=3;redirects++){
  signal.throwIfAborted();const {url,addresses}=await abortable(assertPublicUrl(target,resolve),signal);signal.throwIfAborted();
  const permission=await abortable(Promise.resolve(opts.beforeRequest?.(url.href)),signal);if(permission&&!permission.allowed)throw Error('Coleta recusada por robots.txt');
  if(opts.throttle!==false)await schedule(url.origin,permission?.crawlDelay??opts.delay??1,signal);
  const agent=new Agent({connect:{lookup:(_host,options,callback)=>options.all?callback(null,addresses):callback(null,addresses[0].address,addresses[0].family)}});
  try{
   const response=opts.transport?await opts.transport(url.href,agent,signal):await undiciFetch(url,{dispatcher:agent,redirect:'manual',signal,headers:{'User-Agent':process.env.NEXT_PUBLIC_APP_URL?`IntelliSuiteBot/1.0 (+${process.env.NEXT_PUBLIC_APP_URL}/bot)`:BOT_USER_AGENT,Accept:'text/plain,text/html,application/pdf'}}) as unknown as Response;
   if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();const location=response.headers.get('location');if(!location||redirects===3)throw Error('Redirecionamentos excedidos');target=new URL(location,url).href;continue;}
   const max=opts.maxBytes??2*1024*1024;if(Number(response.headers.get('content-length'))>max){await response.body?.cancel();throw Error('Página excede o limite de bytes');}
   const chunks:Uint8Array[]=[];let length=0;const reader=response.body?.getReader();
   if(reader)try{for(;;){signal.throwIfAborted();const {value,done}=await abortable(reader.read(),signal);if(done)break;length+=value.length;if(length>max)throw Error('Página excede o limite de bytes');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   return{url:url.href,status:response.status,headers:response.headers,bytes};
  }finally{if(signal.aborted)await agent.destroy();else await agent.close();}
 }
 throw Error('Redirecionamentos excedidos');
}
