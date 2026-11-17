/**
 * A duração de uma etapa do grafo, em português: "850 ms", "1,2 s", "1 min 05 s". Abaixo de um
 * segundo em milissegundos inteiros; até um minuto em segundos com uma casa decimal (vírgula,
 * como se escreve em pt-BR); daí em diante minutos e segundos, que é onde acaba uma busca na web
 * lenta.
 */
export function formatDuration(ms: number): string {
  const inteiro = Math.max(0, Math.round(ms));

  if (inteiro < 1_000) return `${inteiro} ms`;

  // Arredonda a uma casa antes de decidir a unidade: 59 960 ms são "1 min 00 s", e não "60,0 s".
  const decimos = Math.round(inteiro / 100);
  if (decimos < 600) return `${(decimos / 10).toFixed(1).replace('.', ',')} s`;

  const segundosTotais = Math.round(inteiro / 1_000);
  const minutos = Math.floor(segundosTotais / 60);
  const segundos = segundosTotais % 60;
  return `${minutos} min ${String(segundos).padStart(2, '0')} s`;
}
