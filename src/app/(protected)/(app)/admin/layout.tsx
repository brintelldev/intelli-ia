import{Suspense,type ReactNode}from'react';import{AdminNav}from'@/components/admin/AdminNav';
export default function Layout({children}:{children:ReactNode}){return <><Suspense fallback={<div className="h-16"/>}><AdminNav/></Suspense>{children}</>}
