import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { obterGrafoReal } from '@hero/agent';

import { criarServidorMcp } from './server.js';

// Ponto de entrada do transporte stdio, para `claude mcp add`. O grafo real (Postgres e Vertex AI)
// não é construído aqui: obterGrafoReal só o monta na primeira chamada da tool.
//
// No stdio, o stdout é o canal do protocolo: qualquer console.log quebra a conversa com o cliente.
// Toda mensagem para humanos vai para o stderr.
const servidor = criarServidorMcp({ getGraph: obterGrafoReal });
await servidor.connect(new StdioServerTransport());
console.error('ai-researcher: servidor MCP (stdio) pronto.');
