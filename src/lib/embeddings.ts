import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const EMBEDDING_DIMS = 384;
const BATCH = 32;

// O transformers.js ignora HF_HOME: sem isto o cache iria para dentro de node_modules (somente leitura na imagem).
env.cacheDir = process.env.HF_HOME ?? ".cache";

// Singleton no globalThis: o HMR do dev recarrega o módulo e, sem isso, recarregaria o modelo a cada edição.
const g = globalThis as unknown as { __embedder?: Promise<FeatureExtractionPipeline> };

function embedder(): Promise<FeatureExtractionPipeline> {
  g.__embedder ??= (
    pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" }) as Promise<FeatureExtractionPipeline>
  ).catch((e) => {
    g.__embedder = undefined; // falha de download não pode ficar gravada para sempre
    throw e;
  });
  return g.__embedder;
}

/** Carrega o modelo (1ª vez baixa ~120 MB para o cache). Chamado no instrumentation.ts. */
export async function warmUpEmbeddings(): Promise<void> {
  await embed("aquecimento");
}

export async function embed(text: string): Promise<number[]> {
  return (await embedBatch([text]))[0];
}

/** Vetores normalizados (norma 1), então o produto interno = cosseno. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = await embedder();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const t = await model(texts.slice(i, i + BATCH), { pooling: "mean", normalize: true });
    out.push(...(t.tolist() as number[][]));
  }
  return out;
}
