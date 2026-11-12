import type { RetrievedDoc } from '../db/retrieve-similar.js';

const TOP_K_PADRAO = 5;

/** A parte do estado do grafo que este nó lê. */
export interface RetrieveState {
  question: string;
}

// Só a operação de que o nó precisa, escrita por extenso. O VertexAIEmbeddings real tem este
// método (entre outros) e se encaixa sem adaptação; o fake do teste implementa só ele.
export interface EmbeddingsClient {
  embedQuery(texto: string): Promise<number[]>;
}

export type Buscar = (embedding: number[], k: number) => Promise<RetrievedDoc[]>;

export interface RetrieveDeps {
  embeddings: EmbeddingsClient;
  buscar: Buscar;
  // Opção da factory, e não campo do estado: só este nó usa o top-k.
  topK?: number;
}

/**
 * Nó `retrieve`: gera o embedding da pergunta e busca os documentos mais próximos.
 * Não importa nenhum cliente global: embeddings e busca chegam por parâmetro, e por isso o nó é
 * testável com fakes, sem rede e sem banco.
 */
export function makeRetrieveNode({ embeddings, buscar, topK = TOP_K_PADRAO }: RetrieveDeps) {
  return async function retrieve(state: RetrieveState): Promise<{ documents: RetrievedDoc[] }> {
    const embedding = await embeddings.embedQuery(state.question);
    const documents = await buscar(embedding, topK);

    return { documents };
  };
}
