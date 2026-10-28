/** Só referência expressa; não interpreta números soltos nem gera regex com texto externo. */
export function referencePattern(query:string):string|null {
 const numbers=[...new Set(Array.from(query.matchAll(/\bart(?:igo)?\.?\s*(\d{1,4})(?!\d)/gi),m=>m[1]))].slice(0,4);
 return numbers.length?`(^|[\n\r])Art[.]?[[:space:]]+(${numbers.join('|')})([º°o.]|[[:space:]]|$)`:null;
}
