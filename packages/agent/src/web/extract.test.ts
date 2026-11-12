import { describe, expect, it } from 'vitest';

import { extrairTexto } from './extract.js';

describe('extrairTexto', () => {
  it('tira as tags e junta os espaços', () => {
    const html = '<html><body><h1>Vale</h1>\n\n<p>Receita   caiu <b>5%</b>.</p></body></html>';

    expect(extrairTexto(html)).toBe('Vale Receita caiu 5% .');
  });

  it('descarta o conteúdo de script, style, noscript, svg e head, e comentários', () => {
    const html = `<head><title>Título</title><meta name="x"></head>
      <body><script>var x = "<p>não</p>";</script><style>p { color: red }</style>
      <noscript>ative o JS</noscript><svg><text>logo</text></svg><!-- comentário -->
      <p>Texto útil</p></body>`;

    expect(extrairTexto(html)).toBe('Texto útil');
  });

  it('descodifica as entidades comuns, numéricas e hexadecimais', () => {
    expect(
      extrairTexto('<p>A&amp;B &lt;3&gt; &quot;x&quot; d&#39;Ouro &#233; &#xE7;&nbsp;fim</p>'),
    ).toBe('A&B <3> "x" d\'Ouro é ç fim');
  });

  it('descodifica &amp; por último, sem descodificar duas vezes', () => {
    expect(extrairTexto('<p>&amp;lt;</p>')).toBe('&lt;');
  });

  it('devolve texto vazio para HTML sem texto', () => {
    expect(
      extrairTexto('<html><head><title>x</title></head><body><script>1</script></body></html>'),
    ).toBe('');
  });
});
