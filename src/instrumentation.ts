// Roda uma vez quando o servidor Next sobe. Carrega o modelo de embeddings em segundo plano para a
// 1ª pergunta do chat não pagar o download/carga. NUNCA pode impedir o servidor de subir: se o módulo
// ou o modelo falharem, o login e as demos que não usam embeddings continuam, e a 1ª chamada tenta de novo.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { warmUpEmbeddings } = await import("@/lib/embeddings");
    warmUpEmbeddings().then(
      () => console.log("embeddings: modelo pronto"),
      (e) => console.error("embeddings: warm-up falhou:", e instanceof Error ? e.message : e),
    );
  } catch (e) {
    console.error("embeddings: módulo não carregou:", e instanceof Error ? e.message : e);
  }
}
