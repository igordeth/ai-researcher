/**
 * O cliente passou do número de pedidos permitido na janela do rate limiting. Quem lança é o
 * @fastify/rate-limit, pelo errorResponseBuilder configurado em limites.ts.
 */
export class LimiteDePedidosExcedido extends Error {
  override readonly name = 'LimiteDePedidosExcedido';

  constructor(readonly segundosAteLiberar: number) {
    super(`Limite de pedidos excedido; liberta em ${segundosAteLiberar} s.`);
  }
}

/**
 * Os tokens consumidos hoje (dia UTC) já chegaram ao orçamento diário. Lançado pela rota /chat
 * antes de começar o grafo, para nenhuma pergunta nova gastar mais.
 */
export class OrcamentoDiarioEsgotado extends Error {
  override readonly name = 'OrcamentoDiarioEsgotado';

  constructor(
    readonly tokensHoje: number,
    readonly limiteDiario: number,
  ) {
    super(`Orçamento diário de tokens esgotado: ${tokensHoje} de ${limiteDiario}.`);
  }
}
