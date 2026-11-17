import { expect, test } from '@playwright/test';

// A API corre com DEMO=true (ver playwright.config.ts): o grafo inteiro usa fixtures, a busca
// devolve sempre a Vale 3T25, o grade considera sempre o contexto suficiente e o answer responde
// um texto fixo. Por isso a resposta e o caminho do grafo são previsíveis.
const PERGUNTA = 'Qual foi a receita líquida da Vale no 3T25?';
const DISCLAIMER =
  'Este assistente apresenta informações públicas, não recomendação de investimento.';

test('pergunta sobre a Vale: resposta com fonte da CVM e grafo em três etapas', async ({
  page,
}) => {
  await page.goto('/');

  // Restrição regulatória: o aviso está sempre na tela, antes, durante e depois da resposta.
  const disclaimer = page.getByRole('note');
  await expect(disclaimer).toHaveText(DISCLAIMER);

  const pergunta = page.getByLabel('Pergunta');
  await pergunta.fill(PERGUNTA);
  await pergunta.press('Enter');

  await expect(page.locator('.mensagem-usuario')).toHaveText(PERGUNTA);

  // A resposta aparece palavra a palavra: primeiro o estado revealing, com o disclaimer ainda lá.
  const resposta = page.locator('.mensagem-assistente');
  await expect(resposta).toHaveAttribute('data-estado', 'revealing', { timeout: 30_000 });
  await expect(disclaimer).toBeVisible();

  // Depois, a resposta completa.
  await expect(resposta).toHaveAttribute('data-estado', 'done', { timeout: 30_000 });
  await expect(resposta).toHaveAttribute('aria-busy', 'false');
  await expect(resposta.locator('.mensagem-assistente__texto')).toContainText('R$ 56,7 bilhões');

  // A fonte da CVM, na lista de fontes da resposta. Ainda sem clique nem link: a citação clicável
  // com "Abrir documento original" é a F.4, e o agente não envia URL para a CVM.
  const fonteCvm = resposta.locator('.fonte').filter({ hasText: 'VALE 3T25' });
  await expect(fonteCvm.locator('.fonte__data-base')).toHaveText('data-base 30/09/2025');
  await expect(fonteCvm.locator('.fonte__origem')).toHaveText('Base local (CVM)');

  // O grafo terminou em três etapas, todas concluídas, sem passar pela web.
  const painel = page.getByRole('complementary', { name: 'Pipeline de raciocínio' });
  const etapas = painel.locator('li.etapa');
  await expect(etapas.locator('.etapa__nome')).toHaveText(['Retrieve', 'Grade', 'Answer']);
  for (const etapa of await etapas.all()) {
    await expect(etapa).toHaveAttribute('data-estado', 'done');
  }
  await expect(painel.locator('li.etapa[data-no="webSearch"]')).toHaveCount(0);
  await expect(painel.locator('.aviso-web')).toHaveCount(0);

  await expect(disclaimer).toBeVisible();
});
