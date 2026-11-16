// A superfície pública do pacote, o que o apps/api importa: o servidor, o plugin HTTP e os tipos.
// Nenhum destes módulos tem efeito ao ser importado. Os pontos de entrada que arrancam alguma coisa
// (stdio.ts, que conecta o stdio, e http.ts, que abre a porta) ficam de fora de propósito e nunca
// devem ser importados daqui.
export {
  criarServidorMcp,
  DESCRICAO_PERGUNTAR,
  MENSAGEM_ERRO_PERGUNTAR,
  type GetGraph,
  type GrafoPerguntavel,
  type OpcoesServidor,
} from './server.js';
export { mcpHttpPlugin, type McpHttpPluginOptions } from './http-plugin.js';
