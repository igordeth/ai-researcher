import { z } from 'zod';

/**
 * Corpo de toda resposta de erro da API: Problem Details for HTTP APIs (RFC 7807, hoje RFC 9457,
 * que a substituiu sem mudar estes campos), servido como application/problem+json. O frontend usa
 * o mesmo schema para mostrar o erro na tela.
 *
 * `type` identifica o tipo de problema e é o campo para um switch no cliente; `title` é o resumo
 * legível desse tipo; `detail` explica esta ocorrência, sem detalhe interno do servidor.
 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Os tipos de problema que a API devolve. URI relativa, como a RFC permite. */
export const PROBLEM_TYPES = {
  pedidoInvalido: '/problemas/pedido-invalido',
  buscaIndisponivel: '/problemas/busca-indisponivel',
  // 429 do rate limiting: pedidos demais do mesmo cliente na janela de tempo.
  limiteDePedidos: '/problemas/limite-de-pedidos',
  // 429 do orçamento diário de tokens: o limite do dia já foi gasto, por todos os clientes juntos.
  orcamentoDiarioEsgotado: '/problemas/orcamento-diario-esgotado',
  erroInterno: '/problemas/erro-interno',
} as const;

// A validação acontece com os schemas deste pacote; quem os usa reconhece a falha por este
// ZodError, sem precisar depender de zod diretamente.
export { ZodError } from 'zod';
