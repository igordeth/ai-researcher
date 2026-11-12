const TAMANHO_PADRAO = 1000;
const SOBREPOSICAO_PADRAO = 100;

/**
 * Divide o texto em chunks de até `tamanho` caracteres, em que cada chunk repete os últimos
 * ~`sobreposicao` caracteres do anterior. A sobreposição evita que uma frase partida ao meio fique
 * sem contexto nos dois lados do corte.
 *
 * Os cortes caem num espaço, para não partir palavras. Só se não houver nenhum espaço na segunda
 * metade da janela (uma "palavra" com mais de 500 caracteres, como um URL enorme) é que se corta
 * no limite exato.
 */
export function dividirEmChunks(
  texto: string,
  tamanho = TAMANHO_PADRAO,
  sobreposicao = SOBREPOSICAO_PADRAO,
): string[] {
  if (sobreposicao >= tamanho) {
    throw new Error(`sobreposição (${sobreposicao}) tem de ser menor que o tamanho (${tamanho})`);
  }

  const chunks: string[] = [];
  let inicio = 0;

  while (inicio < texto.length) {
    let fim = Math.min(inicio + tamanho, texto.length);

    if (fim < texto.length) {
      const ultimoEspaco = texto.lastIndexOf(' ', fim);
      if (ultimoEspaco > inicio + tamanho / 2) fim = ultimoEspaco;
    }

    const chunk = texto.slice(inicio, fim).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (fim >= texto.length) break;

    // Recua `sobreposicao` caracteres e avança até ao início da palavra seguinte. O Math.max
    // garante que o próximo chunk começa sempre depois deste, e o ciclo termina.
    let proximo = Math.max(fim - sobreposicao, inicio + 1);
    const espaco = texto.indexOf(' ', proximo);
    if (espaco !== -1 && espaco < fim) proximo = espaco + 1;
    inicio = proximo;
  }

  return chunks;
}
