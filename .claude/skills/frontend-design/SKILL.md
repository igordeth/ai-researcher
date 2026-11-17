---
name: frontend-design
description: Use ao escrever ou revisar o visual do frontend Angular (apps/web) — estilos, cores, tipografia, ícones e os componentes de chat (bolha de mensagem, citação, painel do pipeline, disclaimer, input e botão de envio). Traduz o protótipo docs/design/prototype/ai-researcher-chat.dc.html e os tokens de design-tokens-used.md em regras de código. Inclui a restrição de domínio — nunca verde nem vermelho em dado financeiro ou estado do pipeline; ciano é a única cor de estado.
---

# Design do frontend do AI Researcher

Fonte da verdade visual: [`docs/design/prototype/ai-researcher-chat.dc.html`](../../../docs/design/prototype/ai-researcher-chat.dc.html) e [`design-tokens-used.md`](../../../docs/design/prototype/design-tokens-used.md). Esta skill traduz os dois em regras para o código Angular de `apps/web`.

Divisão com as outras skills:

- **`angular-developer`** (oficial): idiomas do framework — signals, templates, acessibilidade, testes. Em conflito sobre o framework, a oficial vence.
- **`angular-component`** (do repositório): comportamento — store, SSE, o que o painel e a citação precisam mostrar.
- **Esta**: aparência — tokens, tipografia, forma e a anatomia visual de cada componente.

## A regra de domínio, antes de tudo

**Nunca use verde nem vermelho em dado financeiro ou em estado do pipeline. Ciano é a única cor de estado.**

Em finanças, verde e vermelho querem dizer alta e queda, compra e venda. Pintar um lucro de verde ou um prejuízo de vermelho é sugerir uma leitura de investimento, e o sistema informa, nunca recomenda (ver "Domínio: restrição regulatória" no CLAUDE.md). A regra vale para:

- **Números**: lucro e prejuízo, alta e queda, variação positiva e negativa — todos em `--text`, peso 700. O sinal vai no texto ("prejuízo de R$ -497,0 milhões", "queda de 3,2%"), nunca na cor.
- **Setas e ícones de tendência** (▲▼, ↑↓): não use. Se a direção importa, ela está escrita na frase.
- **Estados do pipeline**: "concluído" não é verde, "falhou" não é vermelho. Ver os estados abaixo.
- **Erro**: também sem vermelho, nem amarelo, nem laranja. Uma falha aparece em texto neutro, com ícone (ver "Erro e falha").
- **Nomes que puxam a cor**: nenhuma classe ou variável `success`, `danger`, `positive`, `negative`, `up`, `down`, `profit`, `loss`.

O verde-limão (`--lime`) existe, mas **só no botão de envio ativo**. Não é cor de estado nem de dado, e não aparece em mais nenhum lugar.

## Tokens

Os tokens vivem uma vez só, como custom properties no `:root` de `apps/web/src/styles.scss`. Componente nenhum escreve hex, `rgb()` ou nome de cor: só `var(--...)`.

```scss
:root {
  // Superfícies, da mais funda para a mais alta
  --bg: #080909; // fundo geral; quase preto, não #000, para evitar banding
  --surface: #141517; // nav, mensagem do assistente, painel do pipeline
  --surface-2: #1c1e21; // disclaimer, mensagem do usuário, input, painel de citação
  --border: #2b2e32; // divisórias e bordas; decorativo (1,34:1), não marca foco

  // Texto
  --text: #f2f3f4; // texto principal e todos os números
  --text-muted: #95999e; // legendas, labels secundárias, disclaimer

  // Ciano: a única cor de estado
  --cyan: #14fefe; // accent, links, citações, estado em execução e concluído, fallback
  --cyan-dim: #0d8f8f; // bordas e ícones em accent; texto só sobre --surface ou --bg
  --cyan-tint: rgba(20, 254, 254, 0.1); // fundo de estado ativo e do aviso de fallback
  --cyan-hover: #7cffff; // hover de link (no protótipo, hex solto)
  --on-cyan: #04201f; // texto sobre fundo --cyan (citação aberta)

  // Lima: só o botão de envio ativo
  --lime: #a3ea1f;
  --on-lime: #0a1400; // texto sobre --lime

  // Tipografia
  --font-display: 'Anton', sans-serif; // só o wordmark
  --font-body: 'Poppins', sans-serif; // todo o resto

  // Raio, pelos valores que o protótipo usa
  --radius-card: 10px; // mensagens
  --radius-panel: 8px; // painel de citação, aviso de fallback
  --radius-control: 6px; // botões, input
  --radius-pill: 999px; // tags, citações, círculos do pipeline
}
```

`--cyan-hover`, `--on-cyan`, `--on-lime` e os quatro `--radius-*` não estão no `design-tokens-used.md`: são os valores que o protótipo usa soltos, com nome. Espaçamento não tem escala nesta versão do design; use os valores do protótipo listados em cada componente (10 a 24px) e não invente uma escala.

As fontes carregam no `apps/web/src/index.html`, do Google Fonts, com `preconnect` e `display=swap`: Anton e Poppins nos pesos 400, 500, 600, 700 e 800.

### Contraste (WCAG AA, texto normal pede 4,5:1)

Medido sobre os valores acima:

| Texto | Fundo | Contraste | Uso |
| --- | --- | --- | --- |
| `--text` | `--bg`, `--surface`, `--surface-2` | 15,0 a 17,9 | livre |
| `--text-muted` | `--bg`, `--surface`, `--surface-2` | 5,8 a 7,0 | livre |
| `--cyan` | `--surface`, `--surface-2`, `--cyan-tint` | 11,6 a 14,5 | livre |
| `--cyan-dim` | `--surface` | 4,65 | só label curta em caixa alta (ex.: "Pipeline de raciocínio") |
| `--cyan-dim` | `--surface-2` | **4,25** | **proibido como texto**; só borda e ícone |
| `--on-cyan` / `--on-lime` | `--cyan` / `--lime` | 13,5 / 12,9 | livre |

## Tipografia

- **Anton** (`--font-display`) só no wordmark "AI RESEARCHER" do cabeçalho: 20px, `letter-spacing: 0.02em`. É condensada demais para texto corrido.
- **Poppins** (`--font-body`) em todo o resto.
- **Números** dentro de texto: `color: var(--text)`, `font-weight: 700`, `font-variant-numeric: tabular-nums`. Sem cor, ver a regra de domínio.

| Elemento | Tamanho | Peso | Outros |
| --- | --- | --- | --- |
| Texto da resposta | 15px | 400 | `line-height: 1.65` |
| Texto do usuário | 15px | 400 | `line-height: 1.5` |
| Input | 14.5px | 400 | |
| Botão de envio | 13.5px | 700 | caixa alta, `letter-spacing: 0.02em` |
| Botão secundário | 12.5px | 600 | caixa alta, `letter-spacing: 0.04em` |
| Nome da etapa do pipeline | 13.5px | 600 | |
| Descrição da etapa | 12px | 400 | `--text-muted` |
| Disclaimer | 12.5px | 400 | `--text-muted` |
| Label de seção | 11px | 700 | caixa alta, `letter-spacing: 0.08em` |
| Tag e citação | 11px | 700 | |

## Componentes

Cada componente estiliza o seu próprio `.scss`, com os tokens. Estados entram por classe ou atributo (`[class.aberta]`, `[attr.data-estado]="etapa.estado"`), e o CSS decide a aparência. Nada de `[ngStyle]` ou `[style]` com objetos montados no TypeScript, como o protótipo faz: lá era necessidade da ferramenta de protótipo, aqui espalharia o design pelo código.

### Cabeçalho e disclaimer

- **Nav**: `--surface`, `border-bottom: 1px solid var(--border)`, padding 14px 24px. Wordmark em Anton; ao lado, a tag "B3 · CVM" (pill, borda `--cyan-dim`, texto `--cyan`, 11px 700 caixa alta). À direita, o botão secundário "Nova conversa".
- **Disclaimer**: faixa logo abaixo da nav, `--surface-2`, `border-bottom: 1px solid var(--border)`, padding 9px 24px. Ícone de informação de 14px, traço `--cyan-dim`; texto 12.5px `--text-muted`: "Este assistente apresenta informações públicas, não recomendação de investimento."
- O disclaimer é fixo no layout (ver `angular-component`): não fecha, não rola com a conversa, não some durante o streaming.

### Mensagem do usuário

Alinhada à direita (`align-self: flex-end`), `max-width: 62%`, `--surface-2`, `border: 1px solid var(--border)`, `border-radius: var(--radius-card)`, padding 12px 16px. Texto puro, sem formatação.

### Mensagem do assistente

- Alinhada à esquerda, `max-width: 82%`, `--surface`, `border: 1px solid var(--border)`, `border-radius: var(--radius-card)`, padding 16px 20px.
- Cabeçalho com margem inferior de 12px: avatar circular de 22px (borda `--cyan-dim`, ícone de balão em `--cyan`) e "AI RESEARCHER" em 12.5px 700 `--text-muted`.
- Corpo em parágrafo, com os números destacados (ver Tipografia) e as citações em pill (abaixo).
- **Sem efeito de digitação falso.** O protótipo revela a resposta palavra a palavra, mas a API envia um evento SSE por nó do grafo, e o `answer` chega inteiro. Enquanto ele não chega, o progresso aparece no painel do pipeline; o cursor ciano piscante (2×15px, `--cyan`) pode marcar a mensagem que aguarda o `answer`.
- **Números no texto**: a resposta do LLM é texto livre. Destacar "R$ 53,0 bilhões" ou "3,2%" exige reconhecer o trecho no texto: faça isso numa função pura, com teste, que devolve segmentos (texto, número, citação), e não com regex espalhada no template.

### Citação

- **Pill inline**, um `<button type="button">` dentro do parágrafo: altura 18px, `min-width: 18px`, padding 0 5px, `border-radius: var(--radius-pill)`, `border: 1px solid var(--cyan-dim)`, texto `--cyan` 11px 700, `vertical-align: 2px`, margem 0 2px.
  - Hover: fundo `--cyan-tint`.
  - Aberta: fundo `--cyan`, borda `--cyan`, texto `--on-cyan`.
- **O texto da pill é o rótulo da API** sem colchetes ("VALE 2T26"), e não um número como o `[1]` do protótipo: o rótulo é o que liga a citação ao bloco de fontes que a API devolve (ver `packages/agent/src/prompts/rotulo.ts`). Rótulo da web ("web: título") corta com reticências a partir de uns 18 caracteres; o título inteiro vai no `aria-label`.
- **Painel da citação**, aberto abaixo do parágrafo: margem superior 14px, `--surface-2`, `border: 1px solid var(--border)`, `border-radius: var(--radius-panel)`, padding 12px 16px.
  - Título em label de seção `--cyan` ("Fonte da citação VALE 2T26"); nome da fonte 13.5px 600; detalhe 13px `--text-muted`.
  - Linha com **Data-base** (13.5px 700, `tabular-nums`) e **Origem** ("Base local (CVM)" ou "Busca web"). A data-base é obrigatória: sem o período, o número perde o sentido.
  - Link "Abrir documento original" em `--cyan` (hover `--cyan-hover`), com ícone de seta externa, `target="_blank"` e `rel="noopener noreferrer"`.
  - Botão de fechar no canto (22px, sem borda, `--text-muted`), com `aria-label="Fechar fonte"`.

### Painel do pipeline

- **Aside** de 300px fixos, `--surface`, `border-left: 1px solid var(--border)`, padding 24px 18px, coluna com gap 16px, rolagem própria.
- **Cabeçalho**: "Pipeline de raciocínio" em label de seção `--cyan-dim` (permitido: está sobre `--surface`), e uma linha de 12px `--text-muted` explicando as etapas.
- **Etapas** em timeline vertical, uma por nó do grafo, com nomes curtos: `retrieve` → Retrieve, `grade` → Grade, `webSearch` → Search, `answer` → Answer.
  - Coluna esquerda: círculo de 26px (`border-radius: var(--radius-pill)`), e abaixo dele um conector de 1px em `--border`, `min-height: 22px` (a última etapa não tem conector).
  - Coluna direita: nome (13.5px 600, ícone de 13px `--text-muted`), a tag de estado alinhada à direita e a descrição em 12px `--text-muted`.

| Estado | Círculo | Ícone | Tag |
| --- | --- | --- | --- |
| Pendente | borda `--border`, `--text-muted` | círculo vazio | "Pendente", borda `--border`, `--text-muted` |
| Em execução | borda `--cyan`, fundo `--cyan-tint`, `--cyan` | arco girando | "Em execução", borda `--cyan`, fundo `--cyan-tint`, `--cyan` |
| Concluído | borda `--cyan-dim`, `--cyan` | check | "Concluído", borda `--border`, `--text-muted` |

- **Fallback para a web**: quando o grafo passa pelo `webSearch`, o círculo do Search ganha o halo `box-shadow: 0 0 0 3px var(--cyan-tint)` e a tag diz "Fallback ativo" e depois "Fallback usado". Acima da timeline aparece o aviso: `--cyan-tint`, `border: 1px solid var(--cyan-dim)`, `border-radius: var(--radius-panel)`, padding 10px 12px, ícone de globo e texto 12.5px `--cyan`: "Contexto local insuficiente neste turno — a etapa Search buscou complemento na web."
- **O laço aparece.** O protótipo mostra uma passada só, mas o grafo pode voltar ao `retrieve` (ver `angular-component`). Na segunda rodada, as etapas repetidas entram de novo na timeline, abaixo de um separador em label de seção `--text-muted` ("2ª rodada"); nada é sobrescrito.
- A duração de cada etapa concluída aparece ao lado da descrição, em 12px `--text-muted` com `tabular-nums`.

### Input e botão de envio

- **Barra**: `border-top: 1px solid var(--border)`, padding 16px 24px, gap 10px.
- **Input**: ocupa o resto da linha; `--surface-2`, `border: 1px solid var(--border)`, `border-radius: var(--radius-control)`, padding 11px 14px, 14.5px, texto `--text`. Placeholder: "Pergunte sobre indicadores financeiros de uma empresa da B3…". Enter envia.
- **Botão "Enviar"**: o único uso de `--lime`. Ativo: fundo `--lime`, texto `--on-lime`, sem borda, `border-radius: var(--radius-control)`, padding 11px 22px, 13.5px 700 caixa alta.
  - Desativado (input vazio ou pergunta em andamento): fundo `--surface-2`, texto `--text-muted`, `cursor: default` e o atributo `disabled` de verdade, não só a aparência.
- **Botão secundário** ("Nova conversa", repetir resposta): fundo transparente, `border: 1px solid var(--border)`, texto `--text-muted`, `border-radius: var(--radius-control)`. Hover: borda `--cyan-dim`, texto `--cyan`.

### Erro e falha

O SSE pode trazer um evento `error`, e o `/api/chat` pode responder um `ProblemDetails` (ver `packages/contracts`). Nos dois casos, **sem cor de alarme**:

- Na conversa, a mensagem do assistente mostra o texto do erro em `--text`, com um ícone de alerta de traço em `--text-muted`, no mesmo card `--surface` das respostas.
- No pipeline, a etapa interrompida fica com círculo de borda `--border`, ícone "!" em `--text` e tag "Interrompido" neutra (borda `--border`, `--text-muted`). As etapas seguintes ficam "Pendente".

## Acessibilidade

- **Foco visível sempre.** O protótipo tira o `outline` do input sem pôr outro: não repita. Todo controle tem `:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }`.
- **Movimento reduzido**: com `prefers-reduced-motion: reduce`, o cursor para de piscar e o arco do pipeline para de girar (vira um círculo estático em `--cyan`).
- **Leitores de tela**: o painel do pipeline e a área da resposta ficam em `aria-live="polite"`. Ícones decorativos com `aria-hidden="true"`. A pill de citação tem `aria-label` com a fonte e a data-base ("Fonte VALE 2T26, data-base 30/06/2026"), e `aria-expanded` quando abre o painel.
- **Ícones**: SVG inline no template, como no protótipo, com `stroke="currentColor"`, para herdarem a cor do token pelo CSS.

## Responsivo

O protótipo só define o desktop (1280×800). Abaixo de 900px, o painel do pipeline sai da lateral e vai para baixo do disclaimer, em largura total, ainda com todas as etapas visíveis. Mais do que isso não está desenhado: confirme com o design antes de inventar.

## O que o protótipo mostra e o sistema não tem

O conteúdo do protótipo é ilustrativo. Não copie para o código:

- **EBITDA e fluxo de caixa livre**: o corpus tem só seis indicadores (receita líquida, lucro bruto, lucro líquido, ativo total, patrimônio líquido e caixa operacional).
- **Citações numeradas** `[1]`, `[2]`: o sistema usa o rótulo do documento (ver Citação).
- **Revelação palavra a palavra**: o SSE é um evento por nó (ver Mensagem do assistente).
- **Uma única passada no pipeline**: o laço `webSearch → retrieve` aparece (ver Painel do pipeline).

## Antes de entregar

- [ ] Nenhum hex, `rgb()` ou nome de cor fora do `:root` de `styles.scss`: `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(green|red)\b" apps/web/src/app --include=*.scss --include=*.html` volta vazio.
- [ ] Nenhuma classe ou variável `success`, `danger`, `positive`, `negative`, `up`, `down`, `profit`, `loss`.
- [ ] `--lime` aparece só no botão de envio ativo.
- [ ] Números em `--text`, 700, `tabular-nums`, com o sinal no texto.
- [ ] Toda citação mostra a data-base.
- [ ] Disclaimer fixo e visível durante o streaming.
- [ ] Foco visível em todos os controles e `prefers-reduced-motion` respeitado.
- [ ] Nenhuma biblioteca de componentes (Angular Material, PrimeNG e afins) sem perguntar antes: os temas delas trazem verde e vermelho de sucesso e erro, contra a regra de domínio.
