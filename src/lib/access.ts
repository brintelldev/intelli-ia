/**
 * Quem pode ver o quê na base vetorial (item 136). A busca EXIGE um AccessScope: não existe jeito de
 * consultar chunks sem declarar de quem é a consulta. `getAccessScope`/`canSeeSource` entram na T-27b.
 */
export type AccessScope = { userId: string; isAdmin: boolean; collectionIds: string[] };
