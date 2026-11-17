import { describe, expect, it, vi } from 'vitest';

import { rastrearPergunta } from './tracing.js';

// Sem o OpenTelemetry iniciado, como em todos os testes: o tracing corre sobre o tracer no-op e
// não pode mudar o comportamento de quem o usa. O que chega à Langfuse verifica-se com um trace
// real (ver o relatório da instrumentação), não aqui.
describe('rastrearPergunta', () => {
  it('corre executar uma vez e devolve a resposta dele', async () => {
    const executar = vi.fn(async () => 'A receita foi de R$ 56,7 bilhões.');

    await expect(rastrearPergunta('Receita da Vale?', 'chat', executar)).resolves.toBe(
      'A receita foi de R$ 56,7 bilhões.',
    );
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('devolve null quando não houve resposta (cliente desligou a meio)', async () => {
    await expect(rastrearPergunta('q', 'chat', async () => null)).resolves.toBeNull();
  });

  it('relança o erro de executar, para quem chama o tratar como antes', async () => {
    const erro = new Error('Vertex AI respondeu 503');

    await expect(
      rastrearPergunta('q', 'mcp', async () => {
        throw erro;
      }),
    ).rejects.toBe(erro);
  });
});
