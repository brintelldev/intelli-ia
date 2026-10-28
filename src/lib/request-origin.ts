import{HttpError}from'./http-error';
/** Defesa CSRF também para formulários text/plain. CLI sem Origin continua autorizado pela sessão. */
export function assertRequestOrigin(origin:string|null,fetchSite:string|null,appUrl:string){if(fetchSite==='cross-site'||origin!==null&&origin!==new URL(appUrl).origin)throw new HttpError(403,'Origem da requisição não autorizada.');}
