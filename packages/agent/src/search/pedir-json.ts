import { SearchProviderError } from './types.js';

// Sem timeout, uma API que trave penduraria a pergunta inteira em vez de falhar. Vale para o pedido
// e para a leitura do corpo: o sinal continua ligado à resposta até o corpo acabar de chegar.
export const TIMEOUT_MS = 10_000;

function foiCortadoPorTimeout(erro: unknown): boolean {
  return erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError');
}

/**
 * Faz o pedido HTTP de um provider de busca e devolve o corpo JSON, ainda por validar. Toda falha
 * sai como SearchProviderError, com o motivo certo, e nenhuma inclui a URL (que no Google leva a
 * chave). Serper e Google usam este mesmo caminho; cada um valida o formato da sua resposta.
 */
export async function pedirJson(
  provider: string,
  url: string | URL,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (erro) {
    throw new SearchProviderError(provider, 'sem-resposta', 'sem resposta (timeout ou rede)', {
      cause: erro,
    });
  }

  if (!response.ok) {
    throw new SearchProviderError(provider, 'http', `respondeu ${response.status}`, {
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch (erro) {
    // O corpo cortado a meio pelo timeout é falta de resposta; um corpo completo que não é JSON é
    // formato errado. A diferença decide se vale a pena tentar de novo.
    if (foiCortadoPorTimeout(erro)) {
      throw new SearchProviderError(provider, 'sem-resposta', 'resposta cortada pelo timeout', {
        cause: erro,
      });
    }
    throw new SearchProviderError(provider, 'formato', 'resposta não é JSON', { cause: erro });
  }
}
