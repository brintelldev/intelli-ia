import { adminAc, userAc } from "better-auth/plugins/admin/access";

// Perfis do plugin admin do Better Auth. ATENÇÃO: o plugin procura o perfil neste objeto com
// busca case-sensitive. Sem declarar "Admin" aqui o Admin é recusado em todos os endpoints do
// plugin (set-role, ban, create-user...), mesmo com adminRoles: ["Admin"], porque a validação do
// adminRoles ignora maiúsculas e passa em silêncio.
// Analista e Leitor não administram usuários; o acesso deles às telas é decidido por lib/rbac.ts.
export const roles = {
  Admin: adminAc,
  Analista: userAc,
  Leitor: userAc,
};
