export const PROVIDER_TIMEOUT_MS=60_000;
export const PROVIDER_HEADERS_TIMEOUT_MS=10_000;
/** Prazo de conexão curto; a leitura de um stream que já começou conserva o prazo completo. */
export function createProviderFetch(transport:typeof fetch=fetch,timeoutMs=PROVIDER_TIMEOUT_MS,headersTimeoutMs=timeoutMs):typeof fetch{return async(input,init)=>{
 const headers=new AbortController();const timer=setTimeout(()=>headers.abort(new DOMException('O provedor não iniciou a resposta no prazo.','TimeoutError')),headersTimeoutMs);
 const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),headers.signal,...(init?.signal?[init.signal]:[])]);
 try{
  // O race também protege transports que só observam o cancelamento depois de abrir a conexão.
  return await new Promise<Response>((resolve,reject)=>{const cleanup=()=>signal.removeEventListener('abort',abort);const abort=()=>{cleanup();reject(signal.reason);};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}Promise.resolve().then(()=>transport(input,{...init,signal})).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});});
 }finally{clearTimeout(timer);}
};}
