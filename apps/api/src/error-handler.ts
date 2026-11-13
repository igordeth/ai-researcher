import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { SearchProviderError } from '@hero/agent';
import {
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPES,
  problemDetailsSchema,
  ZodError,
  type ProblemDetails,
} from '@hero/contracts';

// Erro do próprio Fastify por culpa do pedido (JSON malformado, content-type não suportado, corpo
// grande demais): já traz o status 4xx certo, e a mensagem descreve o erro do cliente.
function erroDoPedidoNoFastify(erro: unknown): erro is FastifyError & { statusCode: number } {
  if (!(erro instanceof Error) || !('statusCode' in erro)) return false;
  const { statusCode } = erro as FastifyError;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

/**
 * Traduz um erro no problema que o cliente recebe. A decisão de status vive só aqui: nenhuma
 * rota escolhe o seu código de erro. Fora dos casos conhecidos, o cliente recebe uma mensagem fixa,
 * sem a mensagem nem a stack do erro, que podem ter detalhe interno (SQL, caminho, chave).
 */
export function paraProblema(erro: unknown): ProblemDetails {
  if (erro instanceof ZodError) {
    return {
      type: PROBLEM_TYPES.pedidoInvalido,
      title: 'Pedido inválido',
      status: 400,
      // O campo e a regra que falhou, sem repetir o valor enviado.
      detail: erro.issues
        .map((issue) => `${issue.path.join('.') || 'corpo'}: ${issue.message}`)
        .join('; '),
    };
  }

  if (erro instanceof SearchProviderError && erro.motivo === 'circuito-aberto') {
    return {
      type: PROBLEM_TYPES.buscaIndisponivel,
      title: 'Busca na web indisponível',
      status: 503,
      detail: 'A busca na web está temporariamente indisponível. Tente novamente em instantes.',
    };
  }

  if (erroDoPedidoNoFastify(erro)) {
    return {
      type: PROBLEM_TYPES.pedidoInvalido,
      title: 'Pedido inválido',
      status: erro.statusCode,
      detail: erro.message,
    };
  }

  return {
    type: PROBLEM_TYPES.erroInterno,
    title: 'Erro interno',
    status: 500,
    detail: 'Ocorreu um erro inesperado. Tente novamente.',
  };
}

/**
 * O error handler da aplicação, registado uma vez em app.ts com setErrorHandler. Responde em
 * application/problem+json e regista o erro real no log: com stack para 5xx, que são problema
 * nosso; sem alarme para 4xx, que são do pedido.
 */
export function tratarErro(erro: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const problema = problemDetailsSchema.parse(paraProblema(erro));

  if (problema.status >= 500) {
    request.log.error({ err: erro }, problema.title);
  } else {
    request.log.info({ status: problema.status, detail: problema.detail }, problema.title);
  }

  return reply.code(problema.status).type(PROBLEM_CONTENT_TYPE).send(problema);
}
