import { Server } from 'node:net';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

// O import do pacote acontece dentro do teste, depois dos espiões, e carrega a árvore inteira do
// @hero/agent (LangChain, LangGraph, Vertex AI, Langfuse, OpenTelemetry, pg). Com os ficheiros já
// em memória leva ~1,5 s; num runner novo do CI, com o disco frio, passou dos 5 s padrão do Vitest.
// O limite é do tempo de carregar dependências, e não do comportamento que o teste verifica.
const TEMPO_DO_IMPORT_FRIO_MS = 30_000;

describe('a superfície pública do pacote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'importar o pacote como biblioteca não conecta o stdio nem abre nenhuma porta',
    async () => {
      // Espiões no que os pontos de entrada fariam: o stdio.ts conecta o StdioServerTransport, e o
      // http.ts chega a um Server.listen. Nenhum dos dois pode acontecer só por importar o index.
      const conectarStdio = vi.spyOn(StdioServerTransport.prototype, 'start');
      const abrirPorta = vi.spyOn(Server.prototype, 'listen');

      const pacote = await import('./index.js');

      expect(conectarStdio).not.toHaveBeenCalled();
      expect(abrirPorta).not.toHaveBeenCalled();
      expect(Object.keys(pacote).sort()).toEqual([
        'DESCRICAO_PERGUNTAR',
        'MENSAGEM_ERRO_PERGUNTAR',
        'criarServidorMcp',
        'mcpHttpPlugin',
      ]);
    },
    TEMPO_DO_IMPORT_FRIO_MS,
  );
});
