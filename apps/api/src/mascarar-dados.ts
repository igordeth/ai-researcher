// A pergunta vem de um campo de texto livre, e um utilizador pode escrever lá o próprio e-mail ou
// CPF. Os dados financeiros do corpus são públicos; isto não é, e não deve sair para a Langfuse.
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// Só o CPF formatado (000.000.000-00): onze dígitos soltos também aparecem em números financeiros
// e em URLs, e mascará-los estragaria o trace sem proteger ninguém.
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;

/**
 * Troca e-mails e CPFs por marcadores. Recebe o texto que o LangfuseSpanProcessor vai exportar (o
 * input, o output ou o metadata de uma observação, já em JSON) e devolve-o mascarado; os
 * marcadores não têm aspas, por isso o JSON continua válido.
 */
export function mascararDadosPessoais(texto: string): string {
  return texto.replace(EMAIL, '[EMAIL]').replace(CPF, '[CPF]');
}
