import{test}from'node:test';import assert from'node:assert/strict';import{scopeForCollections,canSeeSource,scopeFingerprint}from'./access';
const collections=[{id:'restricted',allowedRoles:['Analista'],allowedUserIds:[]},{id:'direct',allowedRoles:[],allowedUserIds:['reader']}];
test('matriz role×coleção: Admin vê tudo, Analista por role, Leitor só por autorização direta; privado só do dono',()=>{
 for(const role of ['Admin','Analista','Leitor'] as const){const userId=role==='Leitor'?'reader':'owner';const scope=scopeForCollections(userId,role,collections);assert.equal(canSeeSource(scope,{userId:'other',collectionId:'restricted'}),role!=='Leitor');assert.equal(canSeeSource(scope,{userId:'other',collectionId:null}),role==='Admin');assert.equal(canSeeSource(scope,{userId,collectionId:null}),true);}
 const reader=scopeForCollections('reader','Leitor',collections);assert.equal(canSeeSource(reader,{userId:'other',collectionId:'direct'}),true);
 const expanded=scopeForCollections('reader','Leitor',[{...collections[0],allowedUserIds:['reader']}]);assert.equal(canSeeSource(expanded,{userId:'other',collectionId:'restricted'}),true);assert.notEqual(scopeFingerprint(reader),scopeFingerprint(expanded));
});
