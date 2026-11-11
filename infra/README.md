# Infra — Bloco A (Fundação GCP)

Recursos GCP provisionados no Bloco A, fora do controle de versão (não há Terraform/IaC ainda — isso é conteúdo de bloco futuro, se entrar no escopo). Este arquivo documenta o que existe e como foi criado, para reprodução manual.

**`ai-researcher-capstone` nas tabelas abaixo é o projeto da instância de referência do curso — troque pelo id do seu próprio projeto em todo lugar.** Nenhum nome de recurso (`ai-researcher-db`, repo `ai-researcher`, service account `github-actions-deployer`, etc.) precisa mudar — são convenções deste projeto, não específicas de uma conta. Só o **project id**, o **número do projeto** (usado no caminho do Workload Identity Provider) e a **billing account** são específicos da sua conta. Ver "Configuração do GitHub Actions" abaixo pra saber onde esses três valores entram — nenhum é hardcoded em `deploy.yml`.

### Esta instância: `ai-wise-researcher`

Este repositório roda no projeto GCP **`ai-wise-researcher`**, e não no `ai-researcher-capstone` da referência. Project id é único no mundo inteiro: `ai-researcher` já estava em uso, por isso o nome próprio. As tabelas abaixo continuam com `ai-researcher-capstone` de propósito, para bater com o material das aulas. Ao reproduzir um comando daqui, troque `ai-researcher-capstone` por `ai-wise-researcher`.

O que já foi provisionado nesta instância (Aula 6, em 2026-11-11):

- Projeto `ai-wise-researcher` criado e vinculado à billing account.
- APIs habilitadas: Cloud Run, Cloud SQL Admin, Artifact Registry, Secret Manager e IAM Credentials. A do Vertex AI (`aiplatform.googleapis.com`) entra na Aula 8, junto com o seed.
- Artifact Registry: repo Docker `ai-researcher` em `us-central1` (`us-central1-docker.pkg.dev/ai-wise-researcher/ai-researcher`).
- Cloud SQL: instância `ai-researcher-db` (Postgres 16.15, `db-f1-micro`, edição Enterprise, zonal em `us-central1-f`, sem backup, IP público). Banco `ai_researcher` com a extensão `vector` habilitada. Aqui a versão é **0.8.5**; a referência tem 0.8.1, porque o Cloud SQL entrega a versão corrente na hora do `CREATE EXTENSION`.
- Usuário `app_user`, com senha aleatória gerada por `openssl rand -hex 32`. A senha nunca foi impressa nem gravada em disco: foi direto para o secret `database-url` (versão 2, formato socket `/cloudsql/...`). A versão 1 está desabilitada, porque a senha dela apareceu num log de erro durante o provisionamento e foi rotacionada na hora.
- O `CREATE EXTENSION` rodou pelo Cloud SQL Auth Proxy (componente `cloud-sql-proxy` do gcloud, com `--gcloud-auth`).
- APIs extras exigidas pelo WIF: `iam`, `sts` e `cloudresourcemanager`. Elas não vêm habilitadas por dependência em projeto novo.
- Workload Identity Federation: pool `github-actions-pool` e provider OIDC `github-actions-provider`, restrito a **`igordeth/ai-researcher`**, o fork desta instância, e não ao repositório do curso. Se o provider aceitasse o repositório do curso, os workflows de lá poderiam assumir a service account de deploy deste projeto, e os deste fork não conseguiriam se autenticar. Restrinja sempre ao repositório onde o seu Actions roda.
- Service account `github-actions-deployer@ai-wise-researcher.iam.gserviceaccount.com`, com as 7 roles da tabela. `roles/iam.workloadIdentityUser` concedido ao principalSet `attribute.repository/igordeth/ai-researcher`.
- Firebase adicionado pelo console ao projeto GCP existente, com o Google Analytics ativado (o código não usa). O site padrão do Hosting é `ai-wise-researcher.web.app`. O `.firebaserc` aponta para `ai-wise-researcher`. Não rodei o `firebase init hosting`, porque ele oferece sobrescrever o `firebase.json` versionado, que tem o rewrite `/api/**` para o Cloud Run.
- Variáveis do GitHub (`GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`) criadas em `igordeth/ai-researcher` com `gh variable set`.
- `roles/secretmanager.secretAccessor` no secret `database-url` concedido à service account de execução do Cloud Run (`595752602813-compute@developer.gserviceaccount.com`) **antes** do primeiro deploy. É o problema 2 do Bloco C abaixo, resolvido de antemão.
- **8ª role da service account de deploy: `roles/serviceusage.serviceUsageConsumer`.** Sem ela, o `firebase-tools deploy` falha com `403 Permission denied to get service [firebasehosting.googleapis.com]`, porque o CLI consulta o Service Usage antes de publicar. Ela não está na tabela da referência. Lá provavelmente já existia por causa do problema 1 do Bloco C, a tentativa com o Cloud Build.
- Primeiro deploy (`v1`) verde em 2026-11-11, depois de corrigir essa role com `gh run rerun --failed`. Cloud Run público via `allUsers` + `roles/run.invoker`, liberado depois de confirmação explícita do risco. **Rever antes de o `/chat` (Bloco D) entrar**: a liberação vale para o serviço inteiro, não por rota. `pnpm capstone:check --url https://ai-wise-researcher.web.app` deu 3/3.
- **Rotação da senha do `app_user` (versão 3 do secret, 2026-11-11).** A senha tinha sido trocada à mão no console para entrar no Cloud SQL Studio. O secret ficou com a antiga e a produção caiu para `degraded`. Restaurado com uma senha gerada (`set-password` e `versions add` num comando só), uma revisão nova do Cloud Run (`gcloud run services update --update-secrets=DATABASE_URL=database-url:latest`, porque o `latest` só é lido quando a instância sobe) e a versão 2 desabilitada. **Regra: a senha do `app_user` só existe no secret, e ninguém troca à mão.**
- **Acesso humano ao banco (Cloud SQL Studio) por usuário IAM, sem senha.** Flag `cloudsql.iam_authentication=on` na instância (não reinicia), usuário `CLOUD_IAM_USER` com a conta Google do dono do projeto e `GRANT app_user TO "<conta>"`, para enxergar as tabelas do `app_user`, inclusive as futuras. No Studio: banco `ai_researcher`, autenticação "IAM database authentication". Para revogar: `REVOKE app_user FROM "<conta>"`.
- `docker compose build` no Windows teve dois problemas. Os dois foram resolvidos:
  1. O compose v5 usa o bake do buildx e travava em `additional privileges requested: pass "--allow=fs.read=infra\\docker\\..."`, um problema de barra invertida no caminho. O comando saía com código 0 sem construir nada. Corrigido com a variável de usuário `BUILDX_BAKE_ENTITLEMENTS_FS=0`. O `COMPOSE_BAKE=false` não resolve: é ignorado nesta versão.
  2. O `COPY . .` levava o `node_modules` do host para o container, e o `npx turbo prune` quebrava no Alpine (`MODULE_NOT_FOUND`). Corrigido com o `.dockerignore` na raiz e com `turbo@2.10.9` fixo nos Dockerfiles. No CI (Linux) o problema não aparecia.
- Provider para a variável `GCP_WIF_PROVIDER`: `projects/595752602813/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider`.

## Recursos criados

| Recurso | Valor |
|---|---|
| Projeto GCP | `ai-researcher-capstone` (troque pelo seu — ver nota acima) |
| Região padrão | `us-central1` (escolhida pela cobertura de modelos Gemini estáveis no Vertex AI; `southamerica-east1` tem cobertura mais restrita) |
| Billing account | específica da sua conta GCP — `gcloud billing accounts list` |
| Artifact Registry | repo Docker `ai-researcher` em `us-central1` |
| Cloud SQL | instância `ai-researcher-db`, Postgres 16, tier `db-f1-micro` (menor tier suportado em Postgres via edição Enterprise), zonal, sem backup automático, IP público |
| Banco | `ai_researcher`, extensão `vector` (pgvector 0.8.1) habilitada |
| Usuário da aplicação | `app_user`, credenciais apenas no Secret Manager |
| Secret Manager | `database-url` — connection string do `app_user`, via socket Unix (`?host=/cloudsql/...`), formato que o Cloud Run usa em produção (C.6). Localmente o `docker-compose` usa uma `DATABASE_URL` própria, TCP direto pro Postgres do compose — nunca lê este secret. |
| Workload Identity Federation | pool `github-actions-pool`, provider `github-actions-provider`, restrito ao repositório `unipds-engenharia-de-ia-aplicada/capstone-project-ai-researcher` via `attribute.repository` |
| Service account de deploy | `github-actions-deployer@ai-researcher-capstone.iam.gserviceaccount.com` — roles: `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`, `cloudsql.client`, `secretmanager.secretAccessor`, `cloudbuild.builds.editor`, `firebasehosting.admin` (esta última adicionada no C.5, pro `firebase deploy --only hosting` do workflow) |
| Firebase Hosting | inicializado no projeto; placeholder do A.6 substituído pelo `firebase.json` versionado e pelo build real do Angular a partir do C.5 |

Nenhuma credencial foi escrita em arquivo local ou versionado — a senha do `app_user` e a connection string só existem no Secret Manager.

## Configuração do GitHub Actions (Bloco C.4)

`deploy.yml` não hardcoda projeto, provider do WIF nem service account — lê tudo de **variáveis de repositório** (Settings → Secrets and variables → Actions → **Variables**, não Secrets — nenhum dos três é segredo, são identificadores). Configure com `gh variable set` (ou pela UI) antes do primeiro push que dispare o job `deploy`:

```bash
gh variable set GCP_PROJECT_ID --body "<seu-project-id>"

# Caminho completo do provider — pegue com:
#   gcloud iam workload-identity-pools providers describe github-actions-provider \
#     --location=global --workload-identity-pool=github-actions-pool --project=<seu-project-id> \
#     --format="value(name)"
gh variable set GCP_WIF_PROVIDER --body "projects/<numero-do-projeto>/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider"

gh variable set GCP_DEPLOY_SERVICE_ACCOUNT --body "github-actions-deployer@<seu-project-id>.iam.gserviceaccount.com"
```

Note que o caminho do provider usa o **número** do projeto (ex.: `473939301392`), não o project id — são coisas diferentes; `gcloud projects describe <seu-project-id> --format="value(projectNumber)"` devolve o número.

`.firebaserc` também precisa do seu project id (`"default": "<seu-project-id>"`) — é lido pelo Firebase CLI localmente; o `deploy.yml` já passa `--project` explícito e não depende dele.

## Bloco C — Deploy Zero

Primeiro deploy real (`v1`) rodou verde ponta a ponta em `2026-08-08`: `apps/api` no Cloud Run (`ai-researcher-api`, `us-central1`) e `apps/web` no Firebase Hosting, via `.github/workflows/deploy.yml` autenticado por WIF.

Três problemas só apareceram rodando o workflow de verdade contra produção (não em teoria) — os três documentados nos commits do Bloco C:

1. O bucket de staging padrão do Cloud Build (`gs://ai-researcher-capstone_cloudbuild`, criado com ACL legada na primeira vez que rodei `gcloud builds submit` manualmente no A.2) recusava acesso da service account de deploy mesmo depois de IAM binding no bucket e `serviceusage.serviceUsageConsumer` no projeto. Resolvido trocando a etapa de build por `docker build` + `docker push` direto no runner do GitHub Actions, sem depender do Cloud Build.
2. A service account **de execução** do Cloud Run (`473939301392-compute@developer.gserviceaccount.com`, a padrão do Compute — diferente da service account *de deploy*) precisou de `secretmanager.secretAccessor` no secret `database-url` pra conseguir ler o próprio segredo em runtime.
3. `pnpm --filter @hero/web build` no job de deploy pulava o Turborepo e nunca buildava `@hero/contracts` primeiro — corrigido usando `pnpm turbo run build --filter=@hero/web`, que respeita `dependsOn: ["^build"]`.

**Cloud Run público:** liberado via `gcloud run services add-iam-policy-binding ai-researcher-api --region=us-central1 --member=allUsers --role=roles/run.invoker` em `2026-08-08`, depois de confirmar explicitamente — é exposição real pra internet inteira, não algo pra seguir o plano sem checar. Risco aceito nesse estágio porque a única rota é `/api/health` (barata, sem custo de LLM); rate limiting e alerta de abuso entram no Bloco G, antes do `/chat` (Bloco D) trazer custo de verdade por requisição. `pnpm capstone:check --url https://ai-researcher-capstone.web.app` confirma 3/3.

## A.7 — Cronometragem

Tempo do zero (conta com billing já configurado, mas máquina limpa — sem `gcloud`, sem `psql`, sem componente `cloud-sql-proxy`) até A.6 concluído: **~30 minutos**.

Isso ultrapassa o orçamento de 20 minutos para caber ao vivo na Unidade 1. Distribuição aproximada do tempo:

- Instalação de ferramental local (gcloud CLI, libpq/psql, componente cloud-sql-proxy): a maior parte do tempo, e é o que menos agrega à aula — é setup de máquina, não decisão de arquitetura.
- Dois logins interativos distintos (`gcloud auth login` e `gcloud auth application-default login`) — a segunda conta muita gente esquece, e o erro que ela produz (`could not find default credentials`) não é óbvio.
- Provisionamento em si (criar projeto, habilitar APIs, Artifact Registry, Cloud SQL, WIF, Firebase) — rápido, a maior parte em paralelo/background.

**Recomendação:** Bloco A vira pré-requisito assíncrono, não demonstração ao vivo. O aluno provisiona a própria conta GCP antes da Unidade 1, seguindo este README como roteiro; a aula usa o tempo para explicar *por que* cada peça existe (WIF em vez de chave de service account, `db-f1-micro` vs. tiers maiores, região por cobertura de modelo) em vez de esperar comandos rodarem.
