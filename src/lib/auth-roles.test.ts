import assert from "node:assert/strict";
import { test } from "node:test";
import { roles } from "./auth-roles";
import { ROLES } from "./rbac";

test("todo perfil de rbac.ts existe em roles (chave exata, com maiúscula)", () => {
  for (const r of ROLES) assert.ok(r in roles, `${r} ausente em auth-roles.ts`);
});

test("só o Admin administra usuários no plugin", () => {
  const ops = { user: ["set-role", "ban", "create", "list"] } as const;
  assert.equal(roles.Admin.authorize({ user: [...ops.user] }).success, true);
  assert.equal(roles.Analista.authorize({ user: ["set-role"] }).success, false);
  assert.equal(roles.Leitor.authorize({ user: ["ban"] }).success, false);
});
