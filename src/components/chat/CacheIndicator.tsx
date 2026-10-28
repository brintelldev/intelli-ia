'use client';import{useSyncExternalStore}from'react';
const subscribe=(notify:()=>void)=>{const timer=setInterval(notify,60000);return()=>clearInterval(timer);};
const snapshot=()=>Math.floor(Date.now()/60000);const serverSnapshot=()=>0;
export function CacheIndicator({createdAt}:{createdAt:string}){const now=useSyncExternalStore(subscribe,snapshot,serverSnapshot);const minutes=now?Math.max(0,now-Math.floor(new Date(createdAt).getTime()/60000)):0;const label=minutes<1?'gerado agora':minutes<60?`gerado há ${minutes} min`:`gerado há ${Math.floor(minutes/60)} h`;return <span className="rounded bg-accent-search/10 px-2 py-1 text-xs text-accent-search" title={new Date(createdAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}>⚡ Cache · {label}</span>}
