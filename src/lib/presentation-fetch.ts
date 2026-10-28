'use client';
/** Aviso visual restrito ao Admin; conteúdo e chaves nunca entram no evento. */
export const presentationFetch:typeof fetch=async(input,init)=>{const response=await fetch(input,init);if(response.headers.get('X-Intelli-Replay')==='true')window.dispatchEvent(new Event('intelli-replay-used'));return response;};
