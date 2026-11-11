import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { documentosArraySchema, type Documento } from './documento.js';

export function lerDocumentos(dir: string): Documento[] {
  // sort(): a ordem do readdirSync depende do sistema de arquivos. Ordenado, o seed processa
  // os lotes sempre na mesma ordem, em qualquer máquina.
  const arquivos = readdirSync(dir)
    .filter((arquivo) => arquivo.endsWith('.json'))
    .sort();

  return arquivos.flatMap((arquivo) => {
    const conteudo: unknown = JSON.parse(readFileSync(path.join(dir, arquivo), 'utf-8'));
    const resultado = documentosArraySchema.safeParse(conteudo);
    if (!resultado.success) {
      throw new Error(`${arquivo} fora do formato esperado:\n${z.prettifyError(resultado.error)}`);
    }
    return resultado.data;
  });
}
