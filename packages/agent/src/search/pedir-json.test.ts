import { afterEach, describe, expect, it, vi } from 'vitest';

import { pedirJson, TIMEOUT_MS } from './pedir-json.js';
import { SearchProviderError } from './types.js';

async function falha(promessa: Promise<unknown>): Promise<SearchProviderError> {
  const erro = await promessa.catch((e: unknown) => e);
  if (!(erro instanceof SearchProviderError)) throw new Error('esperava SearchProviderError');
  return erro;
}

describe('pedirJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passa ao fetch um sinal de timeout de 10 segundos', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchFake = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchFake);

    expect(await pedirJson('P', 'https://api.exemplo.com')).toEqual({ ok: true });
    expect(TIMEOUT_MS).toBe(10_000);
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchFake.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('mantém o método, os headers e o corpo do pedido', async () => {
    const fetchFake = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetchFake);

    await pedirJson('P', 'https://api.exemplo.com', { method: 'POST', body: '{"q":"x"}' });

    expect(fetchFake.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"q":"x"}' });
  });

  it('timeout ou rede no pedido viram motivo sem-resposta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('t', 'TimeoutError')));

    expect((await falha(pedirJson('P', 'https://x.com'))).motivo).toBe('sem-resposta');
  });

  it('status não-2xx vira motivo http, com o status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));

    const erro = await falha(pedirJson('P', 'https://x.com'));

    expect(erro.motivo).toBe('http');
    expect(erro.status).toBe(503);
  });

  it('corpo cortado pelo timeout durante a leitura vira sem-resposta, não formato', async () => {
    const resposta = new Response('{}');
    vi.spyOn(resposta, 'json').mockRejectedValue(new DOMException('t', 'TimeoutError'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta));

    expect((await falha(pedirJson('P', 'https://x.com'))).motivo).toBe('sem-resposta');
  });

  it('corpo completo que não é JSON vira motivo formato', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>erro</html>')));

    expect((await falha(pedirJson('P', 'https://x.com'))).motivo).toBe('formato');
  });

  it('nenhuma mensagem inclui a URL, que no Google leva a chave', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));

    const erro = await falha(pedirJson('P', 'https://x.com/?key=chave-secreta'));

    expect(erro.message).not.toContain('chave-secreta');
  });
});
