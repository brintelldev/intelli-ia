import{test}from'node:test';import assert from'node:assert/strict';import{shareAvailable,ShareBody}from'./share-core';
test('compartilhamento expira no instante limite e respeita revogação/toggle global',()=>{
 const row={revokedAt:null,expiresAt:new Date('2026-10-28T00:00:00Z')};assert.equal(shareAvailable(row,true,new Date('2026-10-27T00:00:00Z')),true);assert.equal(shareAvailable(row,true,row.expiresAt),false);assert.equal(shareAvailable({...row,revokedAt:new Date()},true,new Date('2026-10-27')),false);assert.equal(shareAvailable(row,false,new Date('2026-10-27')),false);
});
test('link só aceita tipos chat/report e identificador de recurso válido',()=>{assert.equal(ShareBody.safeParse({kind:'admin',targetId:'u'}).success,false);assert.equal(ShareBody.safeParse({kind:'chat',targetId:''}).success,false);});
