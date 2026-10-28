import {DOMParser,parseHTML} from 'linkedom';

function clean(value:string){return value.replace(/[\t\r\n\u00a0 ]+/g,' ').trim();}
function paragraphs(root:Element){
 for(const cell of root.querySelectorAll('td,th'))cell.appendChild(root.ownerDocument.createTextNode(' | '));
 // Uma linha por bloco, sem perder células, legendas, notas ou referências.
 for(const el of root.querySelectorAll('p,title,sec,table-wrap,tr,ref,fn,list-item,caption'))el.appendChild(root.ownerDocument.createTextNode('\n\n'));
 return (root.textContent??'').split(/\n\s*\n/).map(clean).filter(Boolean).join('\n\n');
}
export function extractJats(xml:string,doi:string):{text:string;license:string} {
 // linkedom não busca DTDs/sub-recursos; entidades personalizadas nunca são admitidas.
 if(/<!ENTITY\b/i.test(xml))throw Error('Entidade XML recusada');
 const document=new DOMParser().parseFromString(xml,'text/xml');
 const article=document.documentElement;if(article?.tagName!=='article')throw Error('Artigo JATS ausente');
 const meta=article.querySelector('front > article-meta') as Element|null;
 if(!meta)throw Error('Metadados JATS ausentes');
 if(meta?.querySelector('article-id[pub-id-type="doi"]')?.textContent?.trim().toLowerCase()!==doi.toLowerCase())throw Error('DOI divergente');
 const license=meta.querySelector('permissions license')?.getAttribute('xlink:href');
 if(!license||!/^https?:\/\/creativecommons\.org\/licenses\/by\/4\.0\/?$/.test(license))throw Error('licença CC-BY-4.0 não confirmada na fonte');
 const body=Array.from(article.children).find(e=>e.tagName==='body');
 if(!body||!body.textContent?.trim())throw Error('Texto integral ausente');
 const title=meta.querySelector('title-group > article-title')?.textContent??'';
 const authors=Array.from(meta.querySelectorAll('contrib[contrib-type="author"]')).map(e=>clean([e.querySelector('given-names')?.textContent,e.querySelector('surname')?.textContent].filter(Boolean).join(' '))).filter(Boolean);
 const back=Array.from(article.children).find(e=>e.tagName==='back');
 const abstract=meta.querySelector('abstract');
 return{text:[title,`DOI: ${doi}`,`Autores: ${authors.join('; ')}`,`Licença: CC-BY-4.0 — ${license}`,abstract?paragraphs(abstract):'',paragraphs(body),back?paragraphs(back):''].filter(Boolean).join('\n\n'),license:'CC-BY-4.0'};
}
export function extractOfficialHtml(html:string):string {
 if(/<title[^>]*>[^<]*(captcha|verifica[çc][aã]o de seguran[çc]a|access denied|just a moment)/i.test(html))throw Error('Desafio de acesso');
 const {document}=parseHTML(html);for(const e of document.querySelectorAll('script,style,noscript,iframe,form,nav,header,footer'))e.remove();
 if(!document.body)throw Error('HTML sem corpo');
 return paragraphs(document.body);
}
export function validateFullText(text:string,rule:{minChars:number;required:string[]}) {
 if(text.length<rule.minChars||text.length>2_000_000)throw Error('Extensão do texto integral inválida');
 const normalized=clean(text).toLowerCase();
 for(const marker of rule.required)if(!normalized.includes(clean(marker).toLowerCase()))throw Error(`Texto incompleto: marcador ${marker} ausente`);
}
