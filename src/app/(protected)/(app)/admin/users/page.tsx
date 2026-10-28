import{RoleGate}from'@/components/auth/RoleGate';import{UserTable}from'@/components/admin/UserTable';export default function Page(){return <RoleGate roles={['Admin']}><UserTable/></RoleGate>}
