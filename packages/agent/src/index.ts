// O que o pacote expõe a quem o usa (apps/api). Só o grafo e os tipos que atravessam a fronteira.
// O cliente da base (db/client.ts) fica de fora de propósito: importá-lo abre um pool de conexões.
export { buildGraph, MAX_ITERATIONS, type GraphDeps, type ResearchStateValue } from './graph.js';
export type { DocumentoCvm, DocumentoWeb, RetrievedDoc } from './db/retrieve-similar.js';
// A API mapeia a falha da busca (por exemplo, o circuito aberto) para um status HTTP.
export { SearchProviderError, type MotivoFalhaBusca } from './search/types.js';
// O grafo com as dependências reais, construído na primeira chamada. O MCP e a API usam o mesmo.
export { obterGrafoReal, type ResearchGraph } from './grafo-real.js';
// Tracing na Langfuse: registado uma vez no arranque de cada processo (apps/api e os transportes
// do mcp-server), e um trace por pergunta, aberto por quem a recebe (a rota /chat, a tool MCP).
export { registrarTracingLangfuse, type EncerrarTracing } from './tracing/registrar.js';
export {
  rastrearPergunta,
  type CallbacksDaPergunta,
  type CanalPergunta,
} from './tracing/rastrear-pergunta.js';
// Métricas do Prometheus: o callback soma-se aos da Langfuse no call site do grafo, e o registry é
// o que o /metrics vai expor.
export { criarMetricsCallback } from './metricas/metrics-callback.js';
export { registroMetricas } from './metricas/registro.js';
// O consumo de tokens do dia, somado pelo mesmo callback: a rota /chat confere-o contra o orçamento.
export { consumoDiarioDeTokens } from './metricas/consumo-diario.js';
