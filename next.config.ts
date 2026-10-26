import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ano do copyright fixado no build: ler a hora no render exigiria deixar o footer dinâmico.
  env: { BUILD_YEAR: String(new Date().getFullYear()) },
  // Imagem Docker enxuta (ENV v2, §4).
  output: "standalone",
  // Binários nativos do onnxruntime não podem ser empacotados pelo bundler.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
