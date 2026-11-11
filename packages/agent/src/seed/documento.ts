import { z } from 'zod';

// Formato dos JSONs gerados pelo `pnpm collect` (packages/corpus/data/documentos/{TICKER}.json).
// Validado aqui porque leitura de arquivo é fronteira do domínio, por convenção do projeto.
// Os nomes seguem o arquivo (snake_case); a tradução para o camelCase do Drizzle fica em to-row.ts.
export const documentoSchema = z.object({
  ticker: z.string().min(1),
  company_name: z.string().min(1),
  setor: z.string().min(1),
  period: z.string().regex(/^\dT\d{2}$/, 'período no formato 1T26'),
  period_end: z.iso.date(),
  receita_liquida: z.number().int(),
  lucro_bruto: z.number().int(),
  lucro_liquido: z.number().int(),
  ativo_total: z.number().int(),
  patrimonio_liquido: z.number().int(),
  caixa_operacional: z.number().int(),
  // Ausente no 4º trimestre: a CVM não oferece o comparativo YoY nesse período.
  receita_mesmo_trimestre_ano_anterior: z.number().int().optional(),
  source_url: z.url(),
  fetched_at: z.iso.datetime(),
  paragraph: z.string().min(1),
});

export const documentosArraySchema = z.array(documentoSchema);

export type Documento = z.infer<typeof documentoSchema>;
