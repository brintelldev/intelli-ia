import{PROVIDERS,type ProviderId}from'./models';
const KEY:Record<ProviderId,string>={anthropic:'ANTHROPIC_API_KEY',openai:'OPENAI_API_KEY',google:'GOOGLE_GENERATIVE_AI_API_KEY'};
/** Nunca retorna valores das chaves. A configuração é lida a cada requisição. */
export function missingProviderKeys(env:Record<string,string|undefined>):ProviderId[]{return PROVIDERS.filter(p=>!env[KEY[p]]?.trim());}
