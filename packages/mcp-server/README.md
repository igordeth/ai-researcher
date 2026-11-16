# @hero/mcp-server

Servidor MCP do AI Researcher, com uma única tool, `perguntar`: recebe uma pergunta em texto, roda o
grafo inteiro de `packages/agent` (retrieve → grade → webSearch → answer) e devolve a resposta
final, citada e com o guardrail aplicado.

O grafo real (Postgres e Vertex AI) só é construído na primeira chamada da tool. O servidor sobe sem
tocar a base nem a Vertex AI, e uma variável de ambiente em falta só aparece como erro na primeira
pergunta, com `isError: true` para o cliente e o detalhe no stderr.

## Transporte stdio

Pré-requisitos: o Postgres com o corpus semeado (`docker compose up -d postgres` e `pnpm seed`), o
ADC da Vertex AI (`gcloud auth application-default login`) e o `.env` na raiz do repositório, com
as variáveis do `.env.example`.

```bash
pnpm --filter @hero/mcp-server build
```

Registar no Claude Code. Os caminhos têm de ser absolutos, porque o cliente arranca o processo
noutro diretório. O `--env-file-if-exists` carrega o `.env` da raiz:

```bash
claude mcp add ai-researcher -- node --env-file-if-exists=/caminho/para/ai-researcher/.env /caminho/para/ai-researcher/packages/mcp-server/dist/stdio.js
```

Para gravar a demo sem depender do Serper, ponha `DEMO=true` no `.env`: só a busca na web passa a
usar fixtures; embeddings, grade e answer continuam na Vertex AI.

**No stdio, o stdout é o canal do protocolo.** Nenhum código deste processo pode escrever no stdout
(`console.log`): qualquer linha a mais corrompe a conversa com o cliente. Logs vão para o stderr.
