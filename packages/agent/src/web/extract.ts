// Blocos cujo conteúdo nunca é texto para ler: código, estilos, metadados, imagens vetoriais.
const BLOCOS_SEM_TEXTO = ['script', 'style', 'noscript', 'svg', 'template', 'head'];

const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function descodificarEntidades(texto: string): string {
  return (
    texto
      .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hexa: string) => String.fromCodePoint(parseInt(hexa, 16)))
      .replace(/&(nbsp|lt|gt|quot|#39|apos);/g, (entidade) => ENTIDADES[entidade] ?? entidade)
      // &amp; por último: assim "&amp;lt;" vira o texto "&lt;", e não "<".
      .replace(/&amp;/g, '&')
  );
}

/**
 * HTML → texto legível. Determinístico, sem rede. Não pretende ser um parser completo de HTML:
 * tira o que não é texto, as tags e as entidades mais comuns, e junta os espaços. Para gerar
 * embeddings e para o LLM ler, é o que basta.
 */
export function extrairTexto(html: string): string {
  let texto = html.replace(/<!--[\s\S]*?-->/g, ' ');

  for (const bloco of BLOCOS_SEM_TEXTO) {
    texto = texto.replace(new RegExp(`<${bloco}\\b[\\s\\S]*?</${bloco}>`, 'gi'), ' ');
  }

  texto = texto.replace(/<[^>]+>/g, ' ');

  return descodificarEntidades(texto).replace(/\s+/g, ' ').trim();
}
