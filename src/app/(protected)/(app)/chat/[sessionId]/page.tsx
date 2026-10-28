import{ChatPage}from'@/components/chat/ChatPage';
export default function Page(props:{params:Promise<{sessionId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){return <ChatPage {...props}/>}
