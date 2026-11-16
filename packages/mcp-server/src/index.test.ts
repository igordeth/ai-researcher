import { Server } from 'node:net';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('a superfície pública do pacote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('importar o pacote como biblioteca não conecta o stdio nem abre nenhuma porta', async () => {
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
  });
});
