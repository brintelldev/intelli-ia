type LocalEnv = Record<string, string | undefined>;
/** Mantém o processo, banco e configuração no host; não exporta chaves nem cria serviços. */
export function localRuntimeConfig(env: LocalEnv) {
    if (!env.DATABASE_URL)
        throw Error('Configure DATABASE_URL no ambiente local.');
    const database = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(database.protocol))
        throw Error('Banco local inválido.');
    const url = new URL(env.BETTER_AUTH_URL || 'http://localhost:3001');
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
        throw Error('A inicialização local aceita somente uma origem HTTP de loopback.');
    const port = env.INTELLI_LOCAL_PORT || url.port || '3001';
    if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
        throw Error('Porta local inválida.');
    url.port = port;
    return { url: url.origin, port, databaseUrl: database.href };
}
/** Aliases emitidos pelo empacotador; aceitamos somente nomes de pacotes npm. */
export function externalAliases(code: string) {
    const result = new Map<string, string>();
    for (const match of code.matchAll(/["']((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)-([a-f0-9]{16})(?:\/[a-z0-9._/-]+)?["']/gi))
        result.set(`${match[1]}-${match[2]}`, match[1]);
    return [...result].map(([alias, packageName]) => ({ alias, packageName }));
}
