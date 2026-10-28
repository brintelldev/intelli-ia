import{prisma}from'../src/lib/prisma';import{seedDemo,resetDemo}from'./demo-data';
(async()=>{const reset=process.argv.includes('--reset');console.log(JSON.stringify(reset?await resetDemo():await seedDemo()));})().catch(e=>{console.error('Seed de demonstração:',e instanceof Error?e.message:'falhou');process.exitCode=1;}).finally(()=>prisma.$disconnect());
