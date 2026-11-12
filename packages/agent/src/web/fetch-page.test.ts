import { afterEach, describe, expect, it, vi } from 'vitest';

import { buscarPagina } from './fetch-page.js';

function respostaHtml(corpo: string, headers: Record<string, string> = {}, status = 200) {
  return new Response(corpo, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

describe('buscarPagina', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devolve o HTML e passa um sinal de timeout ao fetch', async () => {
    const fetchFake = vi.fn().mockResolvedValue(respostaHtml('<p>ok</p>'));
    vi.stubGlobal('fetch', fetchFake);

    expect(await buscarPagina('https://exemplo.com')).toEqual({
      html: '<p>ok</p>',
      urlFinal: 'https://exemplo.com',
    });
    expect(fetchFake.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('devolve o URL final quando houve redirecionamento', async () => {
    const resposta = respostaHtml('<p>ok</p>');
    // Num fetch real, response.url é o endereço depois dos redirecionamentos.
    Object.defineProperty(resposta, 'url', { value: 'https://noticias.com/vale' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta));

    const { urlFinal } = await buscarPagina('https://www.google.com/goto?url=abc');

    expect(urlFinal).toBe('https://noticias.com/vale');
  });

  it('lança erro quando a página responde com erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaHtml('', {}, 404)));

    await expect(buscarPagina('https://exemplo.com')).rejects.toThrow('respondeu 404');
  });

  it('lança erro quando não é HTML, como um PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
        ),
    );

    await expect(buscarPagina('https://exemplo.com/a.pdf')).rejects.toThrow('não é HTML');
  });

  it('lança erro quando o content-length passa do limite', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respostaHtml('<p>x</p>', { 'content-length': '5000000' })),
    );

    await expect(buscarPagina('https://exemplo.com')).rejects.toThrow('acima do limite');
  });

  it('propaga o erro de rede ou de timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')));

    await expect(buscarPagina('https://exemplo.com')).rejects.toThrow('timeout');
  });
});
