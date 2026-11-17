/**
 * O único sítio que interpreta a variável DEMO. Com DEMO=true, o grafo inteiro corre com fixtures,
 * sem rede, sem credencial e sem Postgres:
 * - criarEmbeddings devolve vetores de zeros;
 * - o grafo-real.ts monta o grafo com criarBuscarDemo (sempre a Vale 3T25), criarGradeLlmDemo
 *   (sempre suficiente) e criarAnswerLlmDemo (resposta fixa), e não grava nada na base;
 * - criarSearchProvider e criarBuscarPagina devolvem as fixtures da web, que no demo ficam sem
 *   uso enquanto o grade for sempre suficiente.
 * O seed não olha para esta variável: usa sempre os embeddings reais (criarEmbeddingsReal).
 *
 * Valor desconhecido é erro, e não "desligado": um DEMO=1 que fosse ignorado em silêncio faria a
 * gravação de uma demo chamar o Serper sem ninguém perceber.
 */
export function modoDemoAtivo(): boolean {
  const valor = process.env.DEMO;
  if (valor === undefined || valor === '' || valor === 'false') return false;
  if (valor === 'true') return true;
  throw new Error(`DEMO inválido: "${valor}". Use "true" ou "false".`);
}
