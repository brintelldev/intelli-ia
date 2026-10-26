import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ano do copyright fixado no build: ler a hora no render exigiria deixar o footer dinâmico.
  env: { BUILD_YEAR: String(new Date().getFullYear()) },
  // Imagem Docker enxuta (ENV v2, §4).
  output: "standalone",
  // Binários nativos do onnxruntime não podem ser empacotados pelo bundler.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  // Cabeçalhos de segurança em todas as respostas. Sem CSP por enquanto: o Next injeta scripts em linha e
  // uma política correta exige nonces; fica como melhoria. O HSTS só vale sob HTTPS (o navegador o ignora em
  // http) e não usa includeSubDomains/preload, para não travar subdomínios que um dia precisem de HTTP.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=15552000" },
        ],
      },
    ];
  },
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
