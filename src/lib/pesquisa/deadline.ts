/** Limite ético de coleta: prazo esgotado usa apenas os metadados já disponíveis. */
export function beforeDeadline<T>(work:()=>Promise<T>,signal:AbortSignal,fallback:T):Promise<T>{
 if(signal.aborted)return Promise.resolve(fallback);
 return new Promise<T>((resolve,reject)=>{
  const cleanup=()=>signal.removeEventListener('abort',abort);const abort=()=>{cleanup();resolve(fallback);};signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  Promise.resolve().then(work).then(value=>{cleanup();resolve(signal.aborted?fallback:value);},error=>{cleanup();reject(error);});
 });
}
