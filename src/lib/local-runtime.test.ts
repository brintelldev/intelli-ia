import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localRuntimeConfig } from './local-runtime';
test('runtime local usa origem existente e banco existente sem alterar host, credenciais ou nome', () => {
    const config = localRuntimeConfig({ DATABASE_URL: 'postgresql://fixture:senha_ficticia@localhost:5432/intellisuite', BETTER_AUTH_URL: 'http://localhost:3001' });
    assert.equal(config.url, 'http://localhost:3001');
    assert.equal(config.port, '3001');
    const database = new URL(config.databaseUrl);
    assert.equal(database.hostname, 'localhost');
    assert.equal(database.username, 'fixture');
    assert.equal(database.password, 'senha_ficticia');
    assert.equal(database.pathname, '/intellisuite');
    assert.equal(localRuntimeConfig({ DATABASE_URL: 'postgresql://x:y@localhost/db', BETTER_AUTH_URL: 'http://127.0.0.1:3001', INTELLI_LOCAL_PORT: '3100' }).url, 'http://127.0.0.1:3100');
});
test('inicialização local não publica em domínio remoto nem aceita porta/configuração inválida', () => {
    const base = { DATABASE_URL: 'postgresql://x:y@localhost/db' };
    for (const origin of ['https://example.com', 'http://user:senha@localhost:3001', 'http://localhost:3001/caminho'])
        assert.throws(() => localRuntimeConfig({ ...base, BETTER_AUTH_URL: origin }));
    for (const port of ['abc', '80', '70000'])
        assert.throws(() => localRuntimeConfig({ ...base, INTELLI_LOCAL_PORT: port }));
    assert.throws(() => localRuntimeConfig({}));
});
test('aliases externos do build são vinculados aos pacotes locais sem caminhos arbitrários', async () => {
    const { externalAliases } = await import('./local-runtime');
    assert.deepEqual(externalAliases('x("@huggingface/transformers-31f28a0eb9b916d1"); y("pg-0123456789abcdef"); q("@prisma/client-2c3a283f134fdcb6/runtime/client"); z("../../secreto-0123456789abcdef");'), [{ alias: '@huggingface/transformers-31f28a0eb9b916d1', packageName: '@huggingface/transformers' }, { alias: 'pg-0123456789abcdef', packageName: 'pg' }, { alias: '@prisma/client-2c3a283f134fdcb6', packageName: '@prisma/client' }]);
});
