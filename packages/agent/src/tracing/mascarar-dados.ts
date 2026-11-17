// A pergunta vem de um campo de texto livre, e um utilizador pode escrever lá o próprio e-mail ou
// CPF. Os dados financeiros do corpus são públicos; isto não é, e não deve sair para a Langfuse.
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// Só o CPF formatado (000.000.000-00): onze dígitos soltos também aparecem em números financeiros
// e em URLs, e mascará-los estragaria o trace sem proteger ninguém.
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;

/** Troca e-mails e CPFs por marcadores num texto. */
export function mascararDadosPessoais(texto: string): string {
  return texto.replace(EMAIL, '[EMAIL]').replace(CPF, '[CPF]');
}

/**
 * A máscara que o LangfuseSpanProcessor aplica ao input, ao output e ao metadata de cada
 * observação. O valor chega em qualquer forma: texto, ou o JSON já descodificado (objeto, lista,
 * número, null). Percorre-o e mascara só os textos, devolvendo a mesma forma.
 *
 * Uma exceção aqui seria pior do que inútil: a Langfuse trocaria o campo inteiro por "<fully
 * masked due to failed mask function>", e o trace chegaria sem o conteúdo.
 */
export function mascararValor(valor: unknown): unknown {
  if (typeof valor === 'string') return mascararDadosPessoais(valor);
  if (Array.isArray(valor)) return valor.map(mascararValor);
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [chave, mascararValor(item)]),
    );
  }
  // Número, booleano, null: não há texto para mascarar.
  return valor;
}
