import{RoleGate}from'@/components/auth/RoleGate';import{UserEditor}from'@/components/admin/UserTable';export default function Page(){return <RoleGate roles={['Admin']}><UserEditor/></RoleGate>}
