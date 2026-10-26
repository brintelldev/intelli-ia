import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS, ROLES, can, canAccess, isRole, type Role } from "./rbac";

// Matriz esperada: rota -> [Admin, Analista, Leitor]
const MATRIX: [path: string, expected: Record<Role, boolean>][] = [
  ["/home", { Admin: true, Analista: true, Leitor: true }],
  ["/documentos", { Admin: true, Analista: true, Leitor: false }],
  ["/documentos/qualquer/subrota", { Admin: true, Analista: true, Leitor: false }],
  ["/pesquisa", { Admin: true, Analista: true, Leitor: false }],
  ["/chat", { Admin: true, Analista: true, Leitor: true }],
  ["/chat/abc123", { Admin: true, Analista: true, Leitor: true }],
  ["/compartilhado/token", { Admin: true, Analista: true, Leitor: true }],
  ["/admin/dashboard", { Admin: true, Analista: true, Leitor: false }],
  ["/admin/llm", { Admin: true, Analista: false, Leitor: false }],
  ["/admin/users/novo", { Admin: true, Analista: false, Leitor: false }],
  ["/admin", { Admin: true, Analista: false, Leitor: false }],
];

for (const [path, expected] of MATRIX) {
  test(`canAccess ${path}`, () => {
    for (const role of ROLES) assert.equal(canAccess(role, path), expected[role], `${role} em ${path}`);
  });
}

test("rotas públicas valem sem perfil", () => {
  for (const p of ["/login", "/403", "/privacidade", "/bot"]) assert.equal(canAccess(undefined, p), true, p);
});

test("rota sem regra é negada (default-deny), inclusive para Admin", () => {
  for (const p of ["/nao-existe", "/design-test", "/api/qualquer"]) assert.equal(canAccess("Admin", p), false, p);
});

test("prefixo só casa por segmento: /administrador não herda a regra de /admin", () => {
  assert.equal(canAccess("Admin", "/administrador"), false);
  assert.equal(canAccess("Analista", "/documentosX"), false);
});

test("sem sessão ou perfil inválido não acessa rota protegida", () => {
  for (const r of [undefined, null, "", "admin", "Superuser"]) {
    assert.equal(canAccess(r as never, "/home"), false, String(r));
  }
});

test("isRole", () => {
  assert.equal(isRole("Admin"), true);
  assert.equal(isRole("admin"), false);
  assert.equal(isRole(undefined), false);
});

test("ações: Leitor não envia nem faz upload no chat; só Admin configura", () => {
  assert.equal(can("Leitor", "chat:send"), false);
  assert.equal(can("Leitor", "chat:upload"), false);
  assert.equal(can("Analista", "chat:send"), true);
  assert.equal(can("Analista", "admin:config"), false);
  assert.equal(can("Admin", "admin:config"), true);
  for (const a of Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]) assert.equal(can(undefined, a), false);
});
