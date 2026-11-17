import type { FastifyPluginAsync } from 'fastify';
import { chatRequestSchema } from '@hero/contracts';
import {
  criarTradutorDeEventos,
  formatarEventoSse,
  type ChatEvent,
  type GraphChunk,
} from './chat-event.js';

/**
 * Só o que a rota usa do grafo: o método stream em modo 'updates'. O grafo compilado do LangGraph
 * encaixa aqui sem adaptação, e o teste passa um fake sem LLM nem Postgres.
 */
export interface GraphLike {
  stream(
    input: { question: string },
    options: { streamMode: 'updates' },
  ): Promise<AsyncIterable<GraphChunk>>;
}

/**
 * Como a rota obtém o grafo. Uma função, e não o grafo pronto: o grafo real só é construído no
 * primeiro pedido, e a API sobe sem tocar a base nem a Vertex AI. É o mesmo desenho do GetGraph do
 * @hero/mcp-server.
 */
export type GetGraph = () => Promise<GraphLike>;

export interface ChatRouteOptions {
  getGraph: GetGraph;
}

// Mensagem fixa para o cliente: o erro real (de rede, do LLM, da base) só vai para o log.
const MENSAGEM_ERRO_GRAFO = 'Não foi possível concluir a resposta. Tente novamente.';

const chatRoute: FastifyPluginAsync<ChatRouteOptions> = async (app, { getGraph }) => {
  app.post('/chat', async (request, reply) => {
    // Corpo inválido lança ZodError, e o error handler central responde 400 em problem+json.
    const pedido = chatRequestSchema.parse(request.body);

    // Daqui em diante a resposta é escrita à mão, aos poucos. O hijack diz ao Fastify que não
    // envie uma resposta própria quando o handler terminar. Por isso o erro do grafo, abaixo, não
    // pode ir para o error handler central: o status 200 já foi enviado, e a falha só pode chegar
    // ao cliente como um evento do próprio stream.
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: sem ele, o Cloud Run bufferiza a resposta inteira e o cliente recebe tudo de
      // uma vez no fim, em vez de um evento por nó.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const traduzir = criarTradutorDeEventos();
    function escrever(evento: ChatEvent): void {
      // Com o cliente já desligado, escrever no socket não tem para onde ir.
      if (reply.raw.destroyed) return;
      reply.raw.write(formatarEventoSse(evento));
    }

    try {
      // Dentro do try: se a construção do grafo falhar (variável em falta, por exemplo), o cliente
      // recebe o evento de erro como qualquer outra falha do grafo.
      const graph = await getGraph();
      const chunks = await graph.stream({ question: pedido.question }, { streamMode: 'updates' });
      for await (const chunk of chunks) {
        // O cliente foi embora: sair do for await fecha o stream, e o grafo não segue para os
        // nós seguintes (cada um pode custar uma chamada ao LLM).
        if (reply.raw.destroyed) break;
        for (const evento of traduzir(chunk)) escrever(evento);
      }
    } catch (error) {
      // O status 200 já foi enviado: o erro chega ao cliente como um evento, e o detalhe fica no
      // log, sem vazar para fora. O processo continua de pé para os outros pedidos.
      request.log.error({ err: error }, 'Falha na execução do grafo em /api/chat');
      escrever({ type: 'error', message: MENSAGEM_ERRO_GRAFO });
    } finally {
      reply.raw.end();
    }
  });
};

export default chatRoute;
