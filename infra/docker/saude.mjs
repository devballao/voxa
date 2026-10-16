// HEALTHCHECK das imagens: GET em VOXA_SAUDE_URL; 2xx = saudável.
// Sem a variável (serviço sem HTTP, como o worker), basta o Node conseguir rodar.
// biome-ignore lint/suspicious/noUndeclaredEnvVars: roda dentro do contêiner, fora do Turborepo.
const url = process.env.VOXA_SAUDE_URL;
if (!url) process.exit(0);
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
