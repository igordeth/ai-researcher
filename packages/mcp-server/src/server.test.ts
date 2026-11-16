import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';

import {
  criarServidorMcp,
  DESCRICAO_PERGUNTAR,
  MENSAGEM_ERRO_PERGUNTAR,
  type GetGraph,
  type GrafoPerguntavel,
} from './server.js';

const RESPOSTA =
  'A receita líquida da Vale no 3T25 foi de R$ 56,7 bilhões [VALE3 3T25].\n\nFontes:\n- [VALE3 3T25] Vale S.A., data-base 30/09/2025 (CVM)';

/**
 * Liga um cliente MCP de verdade ao servidor por um par de transportes em memória, do próprio SDK:
 * o teste passa pelo protocolo inteiro (listagem, validação dos argumentos, chamada), sem processo
 * nem rede.
 */
async function conectar(getGraph: GetGraph) {
  const registrarErro = vi.fn();
  const servidor = criarServidorMcp({ getGraph, registrarErro });
  const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(transporteServidor);
  const cliente = new Client({ name: 'teste', version: '0.0.0' });
  await cliente.connect(transporteCliente);
  return { cliente, registrarErro };
}

function grafoFake(resposta = RESPOSTA) {
  const invoke = vi.fn<GrafoPerguntavel['invoke']>(async () => ({ finalAnswer: resposta }));
  const getGraph = vi.fn<GetGraph>(async () => ({ invoke }));
  return { invoke, getGraph };
}

function textoDe(resultado: Awaited<ReturnType<Client['callTool']>>): string {
  const [bloco] = resultado.content as { type: string; text: string }[];
  return bloco.text;
}

describe('servidor MCP', () => {
  it('expõe uma única tool, perguntar, que recebe a pergunta em texto', async () => {
    const { cliente } = await conectar(grafoFake().getGraph);

    const { tools } = await cliente.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['perguntar']);
    expect(tools[0].inputSchema).toMatchObject({
      type: 'object',
      properties: { pergunta: { type: 'string' } },
      required: ['pergunta'],
    });
  });

  it('a descrição diz o domínio e repete o guardrail, porque é o que o cliente lê para decidir', async () => {
    const { cliente } = await conectar(grafoFake().getGraph);

    const { tools } = await cliente.listTools();

    expect(tools[0].description).toBe(DESCRICAO_PERGUNTAR);
    expect(DESCRICAO_PERGUNTAR).toContain('20 empresas');
    expect(DESCRICAO_PERGUNTAR).toContain('B3');
    expect(DESCRICAO_PERGUNTAR).toContain('CVM');
    expect(DESCRICAO_PERGUNTAR).toContain('nunca recomenda');
    expect(DESCRICAO_PERGUNTAR).toMatch(/comprar, vender ou manter/);
  });

  it('roda o grafo com a pergunta e devolve a resposta final, já citada', async () => {
    const { invoke, getGraph } = grafoFake();
    const { cliente } = await conectar(getGraph);

    const resultado = await cliente.callTool({
      name: 'perguntar',
      arguments: { pergunta: '  Qual a receita da Vale no 3T25?  ' },
    });

    expect(resultado.isError).toBeFalsy();
    expect(textoDe(resultado)).toBe(RESPOSTA);
    expect(invoke).toHaveBeenCalledWith({ question: 'Qual a receita da Vale no 3T25?' });
  });

  it('só obtém o grafo na primeira chamada da tool, não ao subir nem ao listar', async () => {
    const { getGraph } = grafoFake();
    const { cliente } = await conectar(getGraph);

    await cliente.listTools();
    expect(getGraph).not.toHaveBeenCalled();

    await cliente.callTool({ name: 'perguntar', arguments: { pergunta: 'q' } });
    expect(getGraph).toHaveBeenCalledTimes(1);
  });

  it('se o grafo falhar, devolve isError com mensagem genérica, sem a exceção crua', async () => {
    const { getGraph, invoke } = grafoFake();
    const falha = new Error('connect ECONNREFUSED 127.0.0.1:5434 senha=segredo');
    invoke.mockRejectedValue(falha);
    const { cliente, registrarErro } = await conectar(getGraph);

    const resultado = await cliente.callTool({ name: 'perguntar', arguments: { pergunta: 'q' } });

    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toBe(MENSAGEM_ERRO_PERGUNTAR);
    expect(JSON.stringify(resultado)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(resultado)).not.toContain('segredo');
    // O erro real não se perde: vai para o log.
    expect(registrarErro).toHaveBeenCalledWith(falha);
  });

  it('se a construção do grafo falhar (configuração em falta), também devolve isError', async () => {
    const getGraph = vi.fn<GetGraph>().mockRejectedValue(new Error('MODEL_ANSWER não definida'));
    const { cliente } = await conectar(getGraph);

    const resultado = await cliente.callTool({ name: 'perguntar', arguments: { pergunta: 'q' } });

    expect(resultado.isError).toBe(true);
    expect(textoDe(resultado)).toBe(MENSAGEM_ERRO_PERGUNTAR);
  });

  it.each([
    ['vazia', { pergunta: '   ' }],
    ['ausente', {}],
    ['de outro tipo', { pergunta: 42 }],
  ])('recusa pergunta %s sem rodar o grafo', async (_caso, args) => {
    const { getGraph } = grafoFake();
    const { cliente } = await conectar(getGraph);

    const resultado = await cliente.callTool({ name: 'perguntar', arguments: args });

    expect(resultado.isError).toBe(true);
    expect(getGraph).not.toHaveBeenCalled();
  });
});
