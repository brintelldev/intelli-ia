import type{Role}from'./rbac';import type{Prisma}from'@/generated/prisma/client';
export type AccessScope={userId:string;isAdmin:boolean;collectionIds:string[]};
type Membership={id:string;allowedRoles:string[];allowedUserIds:string[]};
export function scopeForCollections(userId:string,role:Role,collections:Membership[]):AccessScope{return{userId,isAdmin:role==='Admin',collectionIds:collections.filter(c=>c.allowedRoles.includes(role)||c.allowedUserIds.includes(userId)).map(c=>c.id).sort()};}
export async function getAccessScope(userId:string,role:Role):Promise<AccessScope>{if(role==='Admin')return{userId,isAdmin:true,collectionIds:[]};const{prisma}=await import('./prisma');const collections=await prisma.collection.findMany({where:{OR:[{allowedRoles:{has:role}},{allowedUserIds:{has:userId}}]}});return scopeForCollections(userId,role,collections);}
export function canSeeSource(scope:AccessScope,source:{userId:string;collectionId:string|null}):boolean{return scope.isAdmin||(!source.collectionId&&source.userId===scope.userId)||!!source.collectionId&&scope.collectionIds.includes(source.collectionId);}
export function sourceAccessWhere(scope:AccessScope):Prisma.DocumentSourceWhereInput{return scope.isAdmin?{}:{OR:[{userId:scope.userId,collectionId:null},{collectionId:{in:scope.collectionIds}}]};}
/** Cache nunca atravessa usuário ou escopo. Mudanças de acesso também purgam respostas antigas. */
export function scopeFingerprint(scope:AccessScope){return JSON.stringify([scope.userId,scope.isAdmin,[...scope.collectionIds].sort()]);}
