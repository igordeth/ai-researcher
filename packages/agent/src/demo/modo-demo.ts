/**
 * O único sítio que interpreta a variável DEMO. Com DEMO=true, as fábricas da busca na web
 * (criarSearchProvider e criarBuscarPagina) devolvem as versões com fixtures, sem rede. Embeddings,
 * grade e answer não olham para esta variável: continuam a chamar a Vertex AI.
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
