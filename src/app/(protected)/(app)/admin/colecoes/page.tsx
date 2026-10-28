import{RoleGate}from'@/components/auth/RoleGate';import{CollectionsPanel}from'@/components/admin/CollectionsPanel';
export default function Page(){return <RoleGate roles={['Admin']}><CollectionsPanel/></RoleGate>}
