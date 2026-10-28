import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { BASE, login } from './lib/demo-client';

async function main() {
  // Impede que testes de concessão de papéis/credenciais atinjam o ambiente do usuário.
  assert.equal(BASE, 'http://127.0.0.1:3027');
  assert.equal(new URL(process.env.DATABASE_URL!).port, '15427');
  assert.equal(await prisma.documentSource.count(), 0, 'QA deve conter apenas contas sintéticas, sem documentos');
  const admin = await login('Admin');
  const email = `qa-${randomUUID()}@example.invalid`;
  const password = `Aa9!${randomBytes(24).toString('base64url')}`;
  let id = '';
  let userCookie = '';
  const configs = (await (await admin.fetch('/api/admin/llm-config')).json()).items;
  const settings = (await (await admin.fetch('/api/admin/settings')).json()).values;
  try {
    const created = await admin.fetch('/api/admin/users', { method: 'POST', body: JSON.stringify({ name: 'Usuário totalmente sintético QA', email, password, role: 'Analista', modelOverride: 'anthropic:claude-haiku-5-5', costLimitDay: 0 }) });
    assert.equal(created.status, 201);
    const user = await created.json(); id = user.id;
    assert.equal(user.costLimitDay, 0);
    assert.ok(!JSON.stringify(user).includes(password));
    const signed = await fetch(`${BASE}/api/auth/sign-in/email`, { method: 'POST', headers: { Origin: BASE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(signed.status, 200);
    userCookie = signed.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const asUser = (path: string, init: RequestInit = {}) => fetch(`${BASE}${path}`, { ...init, headers: { Origin: BASE, 'Content-Type': 'application/json', Cookie: userCookie } });
    assert.equal((await asUser('/documentos')).status, 200);
    assert.equal((await asUser('/api/admin/llm-config')).status, 403);
    const list = await (await admin.fetch(`/api/admin/users?role=Analista&status=active&search=${encodeURIComponent(email)}`)).json();
    assert.ok(list.items.some((u: { id: string }) => u.id === id));
    assert.equal((await admin.fetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ role: 'Leitor' }) })).status, 200);
    assert.equal((await asUser('/api/chat', { method: 'POST', body: '{}' })).status, 403);
    assert.equal((await admin.fetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ banned: true }) })).status, 200);
    assert.equal((await asUser('/api/chat/sessions')).status, 401);
    assert.equal((await admin.fetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ key: 'disabledProviders', value: ['anthropic'] }) })).status, 200);
    const catalog = await (await admin.fetch('/api/models')).json();
    const models = Array.isArray(catalog) ? catalog : catalog.models;
    assert.ok(models.every((m: { id: string }) => !m.id.startsWith('anthropic:')));
    assert.equal((await admin.fetch('/api/admin/llm-config', { method: 'PUT', body: JSON.stringify({ module: 'demo2', primaryModel: 'anthropic:claude-haiku-5-5', fallbackModel: 'google:gemini-3.8-flash', temperature: 0.2, maxTokens: 4096, costLimitDay: 0 }) })).status, 200);
    const updated = await (await admin.fetch('/api/admin/llm-config')).json();
    assert.equal(updated.items.find((c: { module: string }) => c.module === 'demo2').primaryModel, 'anthropic:claude-haiku-5-5');
    console.log(JSON.stringify({ isolated: true, noRealKeys: true, create: 201, login: 200, documents: 200, adminDenied: 403, roleEffectiveNextRequest: true, banEffective: 401, providerCatalogUpdated: true, configWithoutRestart: true }));
  } finally {
    for (const config of configs) {
      const { module, primaryModel, fallbackModel, temperature, maxTokens, costLimitDay } = config;
      await admin.fetch('/api/admin/llm-config', { method: 'PUT', body: JSON.stringify({ module, primaryModel, fallbackModel, temperature, maxTokens, costLimitDay }) });
    }
    await admin.fetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ key: 'disabledProviders', value: settings.disabledProviders }) });
    if (id) await admin.fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    await admin.dispose();
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error('Falha no teste isolado de Admin:', error instanceof Error ? error.name : 'erro'); process.exitCode = 1; });
