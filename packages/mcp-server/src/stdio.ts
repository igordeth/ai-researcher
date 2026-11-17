import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { obterGrafoReal, registrarTracingLangfuse } from '@hero/agent';

import { criarServidorMcp } from './server.js';

// Ponto de entrada do transporte stdio, para `claude mcp add`. O grafo real (Postgres e Vertex AI)
// não é construído aqui: obterGrafoReal só o monta na primeira chamada da tool.
//
// No stdio, o stdout é o canal do protocolo: qualquer console.log quebra a conversa com o cliente.
// Toda mensagem para humanos vai para o stderr.

// Antes de conectar: a primeira chamada da tool já tem para onde mandar o trace. Sem as chaves da
// Langfuse, nada é registado e o servidor sobe igual.
const encerrarTracing = registrarTracingLangfuse();
if (!encerrarTracing) {
  console.error('ai-researcher: Langfuse desligada (sem LANGFUSE_PUBLIC_KEY ou _SECRET_KEY).');
}

const servidor = criarServidorMcp({ getGraph: obterGrafoReal });
await servidor.connect(new StdioServerTransport());
console.error('ai-researcher: servidor MCP (stdio) pronto.');

// O processo acaba quando o cliente o pára (SIGTERM, SIGINT) ou fecha o stdin. Antes de sair, os
// traces que ficaram na fila são enviados para a Langfuse.
let encerrando = false;
async function encerrar(): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  try {
    await servidor.close();
    await encerrarTracing?.();
    process.exit(0);
  } catch (erro) {
    console.error('ai-researcher: falha ao encerrar:', erro);
    process.exit(1);
  }
}

process.once('SIGTERM', () => void encerrar());
process.once('SIGINT', () => void encerrar());
process.stdin.once('end', () => void encerrar());
