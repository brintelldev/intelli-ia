export const BASE=process.env.DEMO_BASE_URL||'http://localhost:3001';
export async function login(role:'Admin'|'Analista'|'Leitor'='Analista'){
 const user={Admin:['admin@intellisuite.com','Admin@2025'],Analista:['analista@intellisuite.com','Analista@2025'],Leitor:['leitor@intellisuite.com','Leitor@2025']}[role];
 const response=await fetch(`${BASE}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:BASE},body:JSON.stringify({email:user[0],password:user[1]})});
 if(!response.ok)throw Error(`Login de teste indisponível: ${response.status}`);
 const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 return{fetch:(path:string,init:RequestInit={})=>fetch(`${BASE}${path}`,{...init,headers:{Origin:BASE,...(init.body instanceof FormData?{}:{'Content-Type':'application/json'}),Cookie:cookie,...init.headers}}),dispose:()=>fetch(`${BASE}/api/auth/sign-out`,{method:'POST',headers:{Origin:BASE,'Content-Type':'application/json',Cookie:cookie},body:'{}'})};
}
export async function readParts(response:Response):Promise<Record<string,unknown>[]>{
 if(!response.ok)throw Error(`API de teste HTTP ${response.status}`);const text=await response.text();const parts:Record<string,unknown>[]=[];
 for(const line of text.split('\n'))if(line.startsWith('data: ')&&line!=='data: [DONE]'){try{parts.push(JSON.parse(line.slice(6)));}catch{/* outro framing SSE */}}
 if(parts.some(p=>p.type==='error'))throw Error('Stream de teste retornou erro');return parts;
}
