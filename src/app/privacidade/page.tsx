import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = { title: "Privacidade · Intelli AI" };

// Página pública. As políticas dos provedores foram conferidas nas páginas oficiais na data abaixo;
// ao trocar de provedor, de plano ou de modelo, reconferir e atualizar.
const UPDATED = "26/10/2026";

const PROVIDERS = [
  {
    name: "Anthropic (Claude)",
    training: "Não usa o conteúdo da API para treinar modelos sem permissão expressa do cliente.",
    retention:
      "Apaga entradas e saídas em até 30 dias. Conteúdo sinalizado pelos sistemas de segurança por violação da política de uso pode ser mantido por até 2 anos.",
    links: [
      ["Política de retenção de dados comerciais", "https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data"],
      ["Retenção de dados da API", "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention"],
    ],
  },
  {
    name: "OpenAI (GPT)",
    training: "Por padrão, os dados enviados à API não são usados para treinar ou melhorar os modelos.",
    retention:
      "Mantém registros de monitoramento de abuso por até 30 dias, ou mais se a lei exigir. Existe retenção zero, mas só mediante aprovação da OpenAI.",
    links: [["Controles de dados da API", "https://developers.openai.com/api/docs/guides/your-data"]],
  },
  {
    name: "Google (Gemini)",
    training:
      "Em projetos com faturamento ativo, prompts e respostas não são usados para melhorar produtos do Google. Em projetos sem faturamento, podem ser.",
    retention:
      "Os registros mantidos apenas para detectar abuso são separados dos registros do projeto, e o prazo exato deles não é informado na página oficial consultada. Se o registro do projeto estiver ativado, o padrão é de 55 dias.",
    links: [["Registro e compartilhamento de dados", "https://ai.google.dev/gemini-api/docs/logs-policy"]],
  },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

const ul = "flex list-disc flex-col gap-1.5 pl-5 text-text-secondary";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10 md:py-16">
      <header className="flex flex-col gap-4">
        <Link href="/home" className="w-fit rounded outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
          <Logo className="text-lg" />
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Privacidade e tratamento de dados</h1>
        <p className="text-text-secondary">
          Como o Intelli AI trata os documentos, as conversas e os dados de uso. Atualizado em {UPDATED}.
        </p>
      </header>

      <Section title="Em resumo">
        <ul className={ul}>
          <li>Os documentos e as perguntas que você envia são processados por provedores de IA externos para gerar as respostas.</li>
          <li>Esses provedores, nas condições descritas abaixo, não usam o conteúdo para treinar os modelos deles.</li>
          <li>Você pode excluir seus documentos e conversas; o administrador pode excluir a sua conta, o que apaga os seus dados.</li>
          <li>Não envie dados pessoais sensíveis (saúde, biometria, origem racial, convicções etc.) a menos que tenha base legal para isso.</li>
        </ul>
      </Section>

      <Section title="Que dados ficam guardados aqui">
        <ul className={ul}>
          <li><strong className="text-text-primary">Conta:</strong> nome, e-mail, perfil de acesso e a senha, guardada apenas como hash. Não há cadastro público: as contas são criadas pelo administrador.</li>
          <li><strong className="text-text-primary">Sessão:</strong> cookie de acesso que expira em 8 horas, protegido contra leitura por scripts.</li>
          <li><strong className="text-text-primary">Documentos:</strong> o texto extraído e os trechos indexados para a busca, ligados à sua conta (ou à coleção em que foram colocados).</li>
          <li><strong className="text-text-primary">Conversas e relatórios:</strong> as mensagens, as fontes citadas e os relatórios de pesquisa gerados.</li>
          <li><strong className="text-text-primary">Cache:</strong> respostas repetidas ficam guardadas por até 24 horas para acelerar a resposta.</li>
          <li><strong className="text-text-primary">Métricas de uso:</strong> módulo, tipo de operação, duração, modelo, quantidade de tokens, custo e um título curto. <strong className="text-text-primary">Nunca o conteúdo</strong> dos documentos ou das mensagens.</li>
        </ul>
      </Section>

      <Section title="Para onde os dados vão">
        <p className="text-text-secondary">
          O conteúdo dos seus documentos e as suas perguntas vão, no momento da resposta, ao provedor do modelo de IA
          escolhido, e a mais ninguém. A pesquisa na web é a exceção, e só para o texto da consulta:
        </p>
        <ul className={ul}>
          <li><strong className="text-text-primary">Anthropic, OpenAI e Google:</strong> recebem o conteúdo necessário para responder. A política de cada um está abaixo.</li>
          <li><strong className="text-text-primary">Pesquisa na web:</strong> o <em>texto da consulta</em> (que pode conter o que você digitou) vai para a Tavily e, se ela estiver indisponível, para os mecanismos de busca que a plataforma consulta (Google, Bing e DuckDuckGo). Os seus documentos nunca são enviados.</li>
          <li><strong className="text-text-primary">Sites visitados na pesquisa:</strong> recebem uma requisição comum feita pelo servidor da plataforma, sem nenhum dado seu.</li>
          <li><strong className="text-text-primary">Leitura de PDF e busca nos documentos:</strong> rodam no servidor da plataforma e não enviam o conteúdo para fora.</li>
        </ul>
      </Section>

      <Section title="Política de cada provedor de IA">
        <p className="text-sm text-text-muted">Conferida nas páginas oficiais em {UPDATED}. Essas políticas podem mudar: consulte os links.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {PROVIDERS.map((p) => (
            <article key={p.name} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
              <h3 className="text-base font-semibold">{p.name}</h3>
              <p className="text-text-secondary"><strong className="text-text-primary">Treinamento.</strong> {p.training}</p>
              <p className="text-text-secondary"><strong className="text-text-primary">Retenção.</strong> {p.retention}</p>
              <ul className="mt-auto flex flex-col gap-1">
                {p.links.map(([label, href]) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-primary underline underline-offset-2">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Por quanto tempo e como excluir">
        <ul className={ul}>
          <li>Documentos, conversas e relatórios ficam guardados até serem excluídos. A exclusão de um documento remove também os trechos indexados dele.</li>
          <li>Quando o administrador exclui uma conta, as sessões, os documentos, as conversas e os relatórios dela são apagados junto.</li>
          <li>Os provedores de IA seguem os prazos da política deles, descritos acima, e não é possível excluir antes pela plataforma.</li>
        </ul>
      </Section>

      <Section title="Segurança">
        <ul className={ul}>
          <li>Cada perfil (Admin, Analista, Leitor) acessa só o que a função dele permite, e as coleções de documentos podem ter acesso restrito.</li>
          <li>O número de tentativas de login é limitado. O acesso exige conta criada pelo administrador.</li>
          <li>O administrador pode ativar o ocultamento automático de CPF, e-mail e telefone nas respostas exibidas para um perfil.</li>
          <li>O conteúdo de documentos e páginas externas é tratado como dado, nunca como instrução, para reduzir o risco de manipulação do modelo.</li>
        </ul>
      </Section>

      <Section title="Atenção ao usar">
        <p className="text-text-secondary">
          As respostas são geradas por inteligência artificial e podem conter erros. Confira as informações importantes nas
          fontes citadas antes de tomar decisões. Dúvidas sobre os seus dados: fale com o administrador da plataforma.
        </p>
      </Section>
    </main>
  );
}
