import { SearchProviderError, type SearchProvider, type SearchResult } from './types.js';

export interface OpcoesResiliencia {
  // Nome do provider, para a mensagem de erro do circuito aberto.
  nome: string;
  // Tentativas por chamada, contando a primeira.
  maxTentativas?: number;
  // Espera antes da 2ª tentativa; dobra a cada nova tentativa (500, 1000, 2000...).
  esperaInicialMs?: number;
  // Falhas seguidas, contadas por tentativa, que abrem o circuito.
  falhasParaAbrir?: number;
  // Quanto tempo o circuito fica aberto antes de deixar passar uma tentativa de teste.
  resfriamentoMs?: number;
  // Injetáveis para o teste não esperar os segundos de verdade nem depender do relógio real.
  esperar?: (ms: number) => Promise<void>;
  agora?: () => number;
}

/**
 * Falha que pode passar sozinha: timeout, rede, limite de pedidos (429) ou erro do servidor (5xx).
 * Só estas valem uma nova tentativa. Um 401 (chave errada) ou uma resposta fora do formato
 * repetem-se iguais, e tentar de novo só gasta tempo e quota.
 */
export function falhaTransitoria(erro: unknown): boolean {
  if (!(erro instanceof SearchProviderError)) return false;
  if (erro.motivo === 'sem-resposta') return true;
  if (erro.motivo === 'http' && erro.status !== undefined) {
    return erro.status === 429 || erro.status >= 500;
  }
  return false;
}

// O serviço respondeu, mesmo que com um erro que não passa sozinho: está de pé.
function servicoRespondeu(erro: unknown): boolean {
  return (
    erro instanceof SearchProviderError &&
    (erro.motivo === 'formato' || (erro.motivo === 'http' && !falhaTransitoria(erro)))
  );
}

function esperarDeVerdade(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envolve um SearchProvider com retry, backoff exponencial e circuit breaker. O provider envolvido
 * não sabe que esta camada existe, e quem a usa continua a ver só um SearchProvider.
 *
 * O circuito tem três estados:
 * - fechado: as chamadas passam; cada falha conta, e `falhasParaAbrir` seguidas abrem o circuito;
 * - aberto: as chamadas falham na hora, sem chamar o provider, até passar o resfriamento;
 * - meio-aberto: passado o resfriamento, uma única tentativa de teste passa. Se o serviço
 *   responder, o circuito fecha; se falhar, abre de novo por mais um resfriamento.
 *
 * O estado vive nesta instância: crie uma por provider, na montagem da aplicação, para todas as
 * perguntas partilharem o mesmo circuito.
 */
export function comResiliencia(
  provider: SearchProvider,
  opcoes: OpcoesResiliencia,
): SearchProvider {
  const {
    nome,
    maxTentativas = 3,
    esperaInicialMs = 500,
    falhasParaAbrir = 5,
    resfriamentoMs = 30_000,
    esperar = esperarDeVerdade,
    agora = Date.now,
  } = opcoes;

  let estado: 'fechado' | 'aberto' | 'meio-aberto' = 'fechado';
  let falhasSeguidas = 0;
  let abertoEm = 0;

  function circuitoAberto(): SearchProviderError {
    return new SearchProviderError(nome, 'circuito-aberto', 'circuito aberto após falhas seguidas');
  }

  // Antes de cada tentativa: deixa passar, ou falha na hora sem chamar o provider.
  function autorizarTentativa(): void {
    if (estado === 'fechado') return;
    if (estado === 'meio-aberto') throw circuitoAberto(); // a tentativa de teste ainda não acabou
    if (agora() - abertoEm < resfriamentoMs) throw circuitoAberto();
    estado = 'meio-aberto';
  }

  function fechar(): void {
    estado = 'fechado';
    falhasSeguidas = 0;
  }

  function registrarFalha(): void {
    falhasSeguidas += 1;
    if (estado === 'meio-aberto' || falhasSeguidas >= falhasParaAbrir) {
      estado = 'aberto';
      abertoEm = agora();
    }
  }

  return {
    async search(query: string): Promise<SearchResult[]> {
      for (let tentativa = 1; ; tentativa += 1) {
        // Fora do try: a falha por circuito aberto não conta como falha do serviço.
        autorizarTentativa();

        try {
          const resultados = await provider.search(query);
          fechar();
          return resultados;
        } catch (erro) {
          if (servicoRespondeu(erro)) {
            fechar();
            throw erro;
          }
          registrarFalha();
          // Sem nova tentativa: falha que não passa sozinha, última tentativa, ou circuito que
          // acabou de abrir (esperar o backoff só para depois falhar na hora não ajuda ninguém).
          if (!falhaTransitoria(erro) || tentativa >= maxTentativas || estado === 'aberto') {
            throw erro;
          }
          await esperar(esperaInicialMs * 2 ** (tentativa - 1));
        }
      }
    },
  };
}
