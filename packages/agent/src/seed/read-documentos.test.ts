import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { lerDocumentos } from './read-documentos.js';

const CORPUS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../corpus/data/documentos',
);

describe('lerDocumentos', () => {
  it('lê e valida os 80 documentos do corpus versionado (20 empresas × 4 trimestres)', () => {
    const documentos = lerDocumentos(CORPUS_DIR);

    expect(documentos).toHaveLength(80);
    expect(new Set(documentos.map((documento) => documento.ticker)).size).toBe(20);
    expect(new Set(documentos.map((d) => `${d.ticker}|${d.period}`)).size).toBe(80);
  });

  it('recusa um JSON fora do formato, apontando o arquivo', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'seed-'));
    // camelCase: o formato antigo do corpus, que o schema não aceita mais
    writeFileSync(
      path.join(dir, 'XPTO.json'),
      JSON.stringify([{ ticker: 'XPTO', companyName: 'X' }]),
    );

    expect(() => lerDocumentos(dir)).toThrow(/XPTO\.json fora do formato esperado/);
  });
});
