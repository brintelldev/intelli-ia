export async function adminJson<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,init);const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir a operação.');return data;}
export function putJson(url:string,body:unknown){return adminJson(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
export const fieldClass='mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';
export const cardClass='min-w-0 rounded-xl border border-border bg-surface p-5';
export const usd=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(value);
export const when=(value:string)=>new Date(value).toLocaleString('pt-BR');
