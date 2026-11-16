// O que o pacote expõe a quem o usa (apps/api). Só o grafo e os tipos que atravessam a fronteira.
// O cliente da base (db/client.ts) fica de fora de propósito: importá-lo abre um pool de conexões.
export { buildGraph, MAX_ITERATIONS, type GraphDeps, type ResearchStateValue } from './graph.js';
export type { DocumentoCvm, DocumentoWeb, RetrievedDoc } from './db/retrieve-similar.js';
// A API mapeia a falha da busca (por exemplo, o circuito aberto) para um status HTTP.
export { SearchProviderError, type MotivoFalhaBusca } from './search/types.js';
// O grafo com as dependências reais, construído na primeira chamada. O MCP e a API usam o mesmo.
export { obterGrafoReal, type ResearchGraph } from './grafo-real.js';
