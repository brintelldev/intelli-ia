/** Não passa o Request instrumentado do Next ao construtor nativo (marcas privadas diferem). */
export function forwardRequest(request:Pick<Request,'url'|'method'|'headers'>,body:string,signal:AbortSignal){return new Request(request.url,{method:request.method,headers:new Headers(request.headers),body,signal});}
