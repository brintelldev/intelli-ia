import{RoleGate}from'@/components/auth/RoleGate';import{ResearchWorkspace}from'@/components/pesquisa/ResearchWorkspace';
export default function Page(){return <RoleGate roles={['Admin','Analista']}><ResearchWorkspace/></RoleGate>}
