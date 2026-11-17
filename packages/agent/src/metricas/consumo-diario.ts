/** O dia UTC de um instante, como "2026-11-17": é o que separa um dia de consumo do seguinte. */
function diaUtc(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

/**
 * Os tokens consumidos hoje (dia UTC) por este processo, em memória. Quem soma é o callback de
 * métricas, no mesmo ponto e com os mesmos números que vão para o llm_tokens_total: o orçamento e
 * o Prometheus leem a mesma contagem, o usage_metadata devolvido pela Vertex AI.
 *
 * Zera na virada do dia UTC. Não há timer para isso: cada leitura e cada soma confere o dia, e se
 * mudou, começa do zero. Um processo parado à meia-noite não perde a virada.
 *
 * Em memória quer dizer por processo: cada instância do Cloud Run tem o seu, e um restart zera.
 */
export class ConsumoDiarioDeTokens {
  private dia = diaUtc(new Date());
  private tokens = 0;

  somar(tokens: number): void {
    this.virarODiaSeMudou();
    this.tokens += tokens;
  }

  tokensHoje(): number {
    this.virarODiaSeMudou();
    return this.tokens;
  }

  /** Quantos segundos faltam para a próxima meia-noite UTC, quando o consumo volta a zero. */
  segundosAteZerar(): number {
    const agora = new Date();
    const proximaMeiaNoite = Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth(),
      agora.getUTCDate() + 1,
    );
    return Math.ceil((proximaMeiaNoite - agora.getTime()) / 1000);
  }

  private virarODiaSeMudou(): void {
    const hoje = diaUtc(new Date());
    if (hoje === this.dia) return;
    this.dia = hoje;
    this.tokens = 0;
  }
}

/** O consumo do processo: o callback de métricas soma aqui, e a rota /chat lê daqui. */
export const consumoDiarioDeTokens = new ConsumoDiarioDeTokens();
