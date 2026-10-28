import { spawn } from 'node:child_process';
import { mkdir, rm, readFile, writeFile, symlink, access, lstat, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { localRuntimeConfig, externalAliases } from '../src/lib/local-runtime';
const root = process.cwd(), config = localRuntimeConfig(process.env), runtime = resolve(root, '.local-runtime'), current = resolve(runtime, 'current'), pidFile = resolve(runtime, 'run.json');
// O Docker é usado SOMENTE para compilar/exportar JS. Nenhuma chave do app vai para ele.
const toolEnv: NodeJS.ProcessEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG'].includes(k))), NODE_ENV: 'production' };
const run = (command: string, args: string[], quiet = false) => new Promise<number | null>((done, reject) => { const child = spawn(command, args, { cwd: root, env: toolEnv, stdio: quiet ? 'ignore' : 'inherit' }); child.once('error', reject); child.once('exit', done); });
async function main() {
    await mkdir(runtime, { recursive: true });
    let active: { pid: number; url: string } | undefined;
    try {
        active = JSON.parse(await readFile(pidFile, 'utf8'));
        process.kill(active!.pid, 0);
    } catch {
        active = undefined;
    }
    if (active) {
        if (process.argv.includes('--rebuild'))
            throw Error('Encerre a instância no terminal antes de recompilar.');
        if (active.url !== config.url)
            throw Error('Já existe uma instância local com outra origem. Encerre-a antes de trocar a porta.');
        const response = await fetch(config.url + '/api/health', { signal: AbortSignal.timeout(3000) });
        if (!response.ok)
            throw Error('A instância local está ativa, mas o banco não está saudável. Verifique os serviços antes de reiniciar.');
        console.log(`Aplicação de produção local disponível: ${config.url}`);
        return;
    }
    let exists = true;
    try {
        await access(resolve(current, 'server.js'));
    }
    catch {
        exists = false;
    }
    if (!exists || process.argv.includes('--rebuild')) {
        const image = 'intellisuite:local-build';
        console.log('Compilando sem chaves em ambiente isolado.');
        if (await run('docker', ['build', '--target', 'runner', '-t', image, '.']) !== 0)
            throw Error('O build local não concluiu.');
        const holder = `intellisuite-artifact-${randomUUID().slice(0, 8)}`, staging = resolve(runtime, 'staging');
        await rm(staging, { recursive: true, force: true });
        await mkdir(staging, { recursive: true });
        try {
            if (await run('docker', ['create', '--network', 'none', '--name', holder, image], true) !== 0)
                throw Error('Não foi possível preparar os artefatos.');
            const copy = spawn('docker', ['cp', `${holder}:/app/.`, '-'], { env: toolEnv, stdio: ['ignore', 'pipe', 'inherit'] });
            const unpack = spawn('tar', ['-x', '-C', staging, '--exclude=node_modules'], { env: toolEnv, stdio: ['pipe', 'inherit', 'inherit'] });
            copy.stdout.pipe(unpack.stdin);
            const codes = await Promise.all([copy, unpack].map(p => new Promise<number | null>((done, reject) => { p.once('error', reject); p.once('exit', done); })));
            if (codes.some(c => c !== 0))
                throw Error('Não foi possível exportar o build.');
            await rm(current, { recursive: true, force: true });
            const { rename } = await import('node:fs/promises');
            await rename(staging, current);
        }
        finally {
            await run('docker', ['rm', holder], true);
        }
    }
    // Os imports normais encontram node_modules do projeto pelos diretórios pais.
    // Apenas aliases do build precisam de links; cada nativo usa o pacote do Mac.
    const modules = resolve(current, 'node_modules');
    try {
        if ((await lstat(modules)).isSymbolicLink())
            await rm(modules);
    }
    catch { }
    await mkdir(modules, { recursive: true });
    const files = await readdir(resolve(current, '.next/server'), { recursive: true });
    for (const file of files.filter(f => f.endsWith('.js'))) {
        const code = await readFile(resolve(current, '.next/server', file), 'utf8');
        for (const { alias, packageName } of externalAliases(code)) {
            const target = resolve(root, 'node_modules', packageName), link = resolve(modules, alias);
            try {
                await access(target);
            }
            catch {
                continue;
            }
            try {
                await lstat(link);
            }
            catch {
                await mkdir(dirname(link), { recursive: true });
                await symlink(target, link, 'dir');
            }
        }
    }
    console.log(`Aplicação de produção local: ${config.url}`);
    console.log('Sem Fast Refresh. Mantenha este terminal aberto.');
    const child = spawn(process.execPath, [resolve(current, 'server.js')], { cwd: current, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', PORT: config.port, HOSTNAME: '127.0.0.1', HF_HOME: resolve(root, '.cache') } });
    await writeFile(pidFile, JSON.stringify({ pid: child.pid, url: config.url }), { mode: 0o600 });
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
        process.on(signal, () => child.kill(signal));
    child.once('error', e => { console.error(e.message); process.exitCode = 1; });
    child.once('exit', code => { void rm(pidFile, { force: true }); process.exitCode = code ?? 0; });
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Falha ao iniciar aplicação local.'); process.exitCode = 1; });
