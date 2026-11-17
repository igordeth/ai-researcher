import type { RateLimitPluginOptions } from '@fastify/rate-limit';

import { LimiteDePedidosExcedido } from './erros.js';

// Valores para quando a variável não está definida. 30 pedidos por minuto por cliente cobre uma
// conversa normal com folga; um script em ciclo passa disso no primeiro minuto.
const RATE_LIMIT_MAX_PADRAO = 30;
const RATE_LIMIT_WINDOW_PADRAO_MS = 60_000;
// Uma pergunta gasta da ordem de 3 a 4 mil tokens (grade + answer, com o raciocínio do Gemini):
// um milhão dá algumas centenas de perguntas por dia, uns poucos dólares no pior caso.
const DAILY_TOKEN_BUDGET_PADRAO = 1_000_000;

/**
 * Lê uma variável de ambiente como inteiro positivo, ou devolve o padrão se ela não estiver
 * definida. Valor inválido é erro, e não "usa o padrão": um RATE_LIMIT_MAX=30x ignorado em
 * silêncio deixaria a API com um limite que ninguém escolheu.
 */
function inteiroPositivoDoAmbiente(variavel: string, padrao: number): number {
  const valor = process.env[variavel];
  if (valor === undefined || valor === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${variavel} inválido: "${valor}". Use um inteiro positivo.`);
  }
  return numero;
}

/**
 * As opções do @fastify/rate-limit, lidas do ambiente na hora da chamada. É uma função, chamada
 * no build(), e não um objeto de módulo: um objeto montado no import congelaria os valores do
 * primeiro import, e um teste que muda RATE_LIMIT_MAX antes do build() não teria efeito.
 *
 * RATE_LIMIT_MAX: pedidos por cliente (por IP) em cada janela.
 * RATE_LIMIT_WINDOW: a janela, em milissegundos.
 */
export function opcoesRateLimit(): RateLimitPluginOptions {
  return {
    // Vale para todas as rotas; as que não contam (/health e /metrics) desligam-se na própria
    // rota, com config.rateLimit = false.
    global: true,
    max: inteiroPositivoDoAmbiente('RATE_LIMIT_MAX', RATE_LIMIT_MAX_PADRAO),
    timeWindow: inteiroPositivoDoAmbiente('RATE_LIMIT_WINDOW', RATE_LIMIT_WINDOW_PADRAO_MS),
    // Um erro nomeado em vez do Error genérico do plugin: o error handler central traduz para 429
    // em problem+json, com tipo próprio. O Retry-After o plugin já põe no header.
    errorResponseBuilder: (_request, contexto) =>
      new LimiteDePedidosExcedido(Math.ceil(contexto.ttl / 1000)),
  };
}

/** O orçamento diário de tokens (DAILY_TOKEN_BUDGET), lido do ambiente na hora da chamada. */
export function limiteDiarioDeTokens(): number {
  return inteiroPositivoDoAmbiente('DAILY_TOKEN_BUDGET', DAILY_TOKEN_BUDGET_PADRAO);
}
