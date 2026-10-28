// Ponte TCP local por stdin/stdout do docker exec. Nenhuma rede externa é adicionada aos containers.
import net from 'node:net';
import {spawn} from 'node:child_process';
const port=Number(process.env.OFFLINE_PORT||3030);
const target=process.env.OFFLINE_CONTAINER||'intellisuite-offline-nextjs-1';
if(!Number.isInteger(port)||port<1024||port>65535||!/^intellisuite-offline-[a-z0-9_-]+$/.test(target))throw Error('Porta ou container offline inválido.');
const inside="const n=require('node:net');const s=n.connect(3000,'127.0.0.1');s.setTimeout(180000,()=>s.destroy());process.stdin.pipe(s);s.pipe(process.stdout);s.on('error',()=>process.exit(1));s.on('close',()=>{process.stdin.destroy();process.stdout.end(()=>process.exit());});process.stdin.on('end',()=>s.end());";
const sockets=new Set();
const server=net.createServer(socket=>{
 sockets.add(socket);
 const child=spawn('docker',['exec','-i',target,'node','-e',inside],{stdio:['pipe','pipe','pipe']});
 socket.setTimeout(180000,()=>socket.destroy());
 socket.pipe(child.stdin);child.stdout.pipe(socket);
 child.stderr.resume();
 const close=()=>{sockets.delete(socket);socket.destroy();child.stdin.destroy();if(!child.killed)child.kill();};
 socket.on('error',close);socket.on('close',close);child.on('error',close);child.on('exit',()=>socket.end());child.stdin.on('error',()=>socket.destroy());
});
server.on('error',e=>{console.error(`Não foi possível abrir a ponte local (${e.code||'erro'}).`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Cópia offline: http://127.0.0.1:${port} · ponte local por docker exec, containers sem internet.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const socket of sockets)socket.destroy();server.close(()=>process.exit());});
