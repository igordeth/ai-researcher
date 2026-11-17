import { defineConfig } from '@playwright/test';

// Portas próprias do e2e, e não as do `pnpm dev` (3000 e 4200): com reuseExistingServer, um outro
// serviço já na 3000 seria tomado pela nossa API, e o teste correria contra a aplicação errada.
const PORTA_API = 3100;
const PORTA_WEB = 4300;

export default defineConfig({
  testDir: './e2e',
  // Os dois servidores arrancam antes do primeiro teste; este é o tempo de cada teste.
  timeout: 60_000,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
    // O Chrome instalado na máquina (e nos runners do GitHub Actions), em vez de baixar os
    // browsers do Playwright.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // A API real, com o grafo inteiro em modo DEMO: sem Vertex AI, sem Serper e sem Postgres.
      // Sem o --env-file do `pnpm dev`: o teste não lê o .env de ninguém, como num CI.
      command: 'pnpm exec tsx src/index.ts',
      cwd: '../api',
      env: {
        PORT: String(PORTA_API),
        DEMO: 'true',
        // Uma porta fechada: o /api/health responde degraded logo, em vez de tentar o Postgres
        // que estiver na 5432 desta máquina. O /api/chat em demo não abre a base.
        DATABASE_URL: 'postgresql://e2e@127.0.0.1:1/sem-base',
      },
      url: `http://localhost:${PORTA_API}/api/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    {
      // O Angular servido como no desenvolvimento, com o proxy /api apontado para a API do e2e.
      command: `pnpm exec ng serve --port ${PORTA_WEB} --proxy-config e2e/proxy.e2e.json`,
      url: `http://localhost:${PORTA_WEB}`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
