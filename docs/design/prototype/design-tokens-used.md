# Tokens usados — AI Researcher Chat (sistema UNIPDS)

Extraídos por amostragem de cor de um print da landing page unipds.com.br/gads_pos_ia (fundo preto, cyan, CTA lima) e aplicados como custom properties inline no elemento raiz de `ai-researcher-chat.dc.html`. O verde-limão foi restrito ao botão de envio; nenhuma cor verde/vermelha foi aplicada a dados financeiros ou estados do pipeline, para não sugerir "compra/venda" (restrição de domínio).

## Cor

| Token | Valor | Uso na tela |
| --- | --- | --- |
| `--bg` | `#080909` | fundo geral (quase preto, não puro para evitar banding) |
| `--surface` | `#141517` | nav, card de mensagem do assistente, sidebar do pipeline |
| `--surface-2` | `#1c1e21` | faixa de disclaimer, bolha do usuário, campo de input, painel de citação |
| `--border` | `#2b2e32` | divisórias, bordas de card/input, conector do timeline |
| `--text` | `#f2f3f4` | texto principal |
| `--text-muted` | `#95999e` | legendas, labels secundárias, texto de disclaimer |
| `--cyan` | `#14fefe` | accent — ícones, links, citações, estado "em execução"/"concluído", banner de fallback |
| `--cyan-dim` | `#0d8f8f` | bordas sutis em accent (avatar, tags, ícone de disclaimer) |
| `--cyan-tint` | `rgba(20,254,254,0.1)` | fundo tintado de estado ativo/fallback |
| `--lime` | `#a3ea1f` | botão primário "Enviar" — única aplicação de cor sólida, ecoando o CTA da página de origem |

## Tipografia

| Token | Valor | Uso |
| --- | --- | --- |
| `--font-display` | `"Anton", sans-serif` | wordmark "AI RESEARCHER" no header (único uso — fonte condensada demais para texto corrido) |
| `--font-body` | `"Poppins", sans-serif` | todo o restante: mensagens, labels, botões, tags |

Números monetários seguem em `--text` com `font-weight: 700` e `font-variant-numeric: tabular-nums`.

## Espaçamento e forma

Sem escala de tokens dedicada nesta versão — valores em px diretos (10–24px para gaps/padding, 6–10px de raio). `border-radius: 999px` nas tags e pills de citação; `10px`/`8px`/`6px` em cards, painéis e botões/inputs, respectivamente.

## Origem

Amostra de cor extraída de um screenshot de unipds.com.br/gads_pos_ia (banner topo, botão CTA, cards de seção). Fontes (Anton/Poppins) são uma inferência visual do estilo tipográfico da página — condensada em caixa alta para headline, sans regular para corpo — carregadas via Google Fonts.
