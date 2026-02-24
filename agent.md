# AutoFeedr - Referencia Operacional Atual (2026-02-08)

## 1) Intuito do projeto
O AutoFeedr e uma plataforma com dois fluxos principais:

1. LinkedIn: cadastro de contas, agenda recorrente, publicacao imediata e geracao via provedor configuravel de IA.
2. LeetCode -> GitHub: selecao de desafios nao pagos, geracao/correcao de solucao Python, testes e commit automatizado.

## 2) Arquitetura atual (MVP com base solida)

Servicos principais:

1. `backend/` (FastAPI + SQLAlchemy)
   - API REST para contas, agendas, jobs e prompts padrao.
   - Criptografa tokens LinkedIn no banco com Fernet.
2. `worker/` (Python)
   - Enfileira jobs de agendas usando `croniter` + timezone por agenda.
   - Processa jobs pendentes de LinkedIn e LeetCode com retry automatico.
3. `frontend/` (React + Vite)
   - Painel web com sidebar e 4 telas: Home, Contas, Agenda, Publicar.
4. `postgres` (Docker)
   - Persistencia de contas, agendas, jobs, logs e deduplicacao por execucao/problema.

## 3) Fluxo de negocio

1. Usuario cria/edita conta LinkedIn na UI/API.
2. Usuario cria agenda por conta (`day_of_week` + `time_local` + `timezone`).
3. Worker roda em loop:
   - verifica agendas ativas,
   - cria job `pending` no minuto devido,
   - evita duplicidade por `schedule_runs` (constraint unica por `schedule_id + run_minute_utc`).
4. Worker processa job:
   - monta input de conteudo (topic, paper_url ou paper_text),
   - gera post pelo `Escritor`,
   - publica no LinkedIn,
   - grava sucesso/falha e logs.
5. Em erro:
   - status vira `retry`,
   - reprograma com backoff linear (2 min por tentativa),
   - falha final ao atingir `WORKER_MAX_ATTEMPTS`.

## 4) Modulos reaproveitados (organizados em `packages/`)

1. `packages/Escritor/`
   - Geracao e traducao com `google-genai`.
   - Limite de tamanho para postagem no LinkedIn (3000 caracteres).
2. `packages/Linkedin/`
   - Publicacao no LinkedIn com validacoes de token/URN e tratamento de erro.
3. `packages/arxiv_reciver/`
   - Busca de artigo por topico quando o job e baseado em `topic`.

## 5) Estado atual da UI

1. Tema escuro e layout app-like.
2. Agenda com planner semanal.
3. Cadastro de agenda por clique no slot (`+`) abrindo modal central.
4. Lista de agendas oculta por padrao e exibida sob demanda.
5. Prompts por conta (geracao e traducao), com suporte a prompt padrao.

## 6) API atual (resumo)

Base: `http://<host>:8000`

1. `GET /health`
2. `GET /prompts/defaults`
3. `GET /accounts`
4. `POST /accounts`
5. `PUT /accounts/{account_id}`
6. `GET /schedules`
7. `POST /schedules`
8. `PUT /schedules/{schedule_id}`
9. `POST /jobs/publish-now`
10. `GET /jobs?limit=50`

Documentacao detalhada da API e exemplos em:
- `docs/API_USAGE.md`
- Swagger: `/docs`
- OpenAPI: `/openapi.json`

## 7) Configuracao relevante

Arquivo base: `.env` (modelo em `.env.example`).

Variaveis principais:

1. `LLM_PROVIDER` (`openai` ou `gemini`)
2. `OPENAI_API_KEY` e `OPENAI_MODEL` (quando `LLM_PROVIDER=openai`)
3. `GEMINI_API_KEY` e `GEMINI_MODEL` (quando `LLM_PROVIDER=gemini`)
4. `TOKEN_ENCRYPTION_KEY`
5. `DATABASE_URL`
6. `CORS_ORIGINS`
7. `DEFAULT_TIMEZONE`
8. `WORKER_POLL_SECONDS`
9. `WORKER_MAX_ATTEMPTS`

## 8) Deploy em producao (eyelid)

Ambiente de producao atual:

1. Host: `eyelid`
2. Path: `/opt/AutoFeedr`
3. Branch de deploy: `github_develop`
4. Orquestracao: `docker compose`

Passo a passo de deploy:

1. Local:
   - `git push origin github_develop`
2. Servidor:
   - `ssh eyelid`
   - `cd /opt/AutoFeedr`
   - `git pull --ff-only origin github_develop`
   - `docker compose up -d --build backend worker frontend`
3. Validacao rapida:
   - `curl http://localhost:8000/health`
   - `docker compose ps`

Observacoes operacionais:

1. Evitar `git reset --hard` em deploy padrao.
2. `TOKEN_ENCRYPTION_KEY` precisa permanecer estavel no servidor.
3. Frontend em producao usa tunel local para acesso remoto:
   - `ssh -N -L 5173:localhost:5173 -L 8001:localhost:8000 eyelid`
   - Abrir `http://localhost:5173`

## 9) Diferencas entre ambientes

`local (dev)`:

1. Execucao no workspace local (`docker compose up -d --build`).
2. API local normalmente em `http://localhost:8000`.
3. Frontend local normalmente em `http://localhost:5173`.
4. Pode usar `.env` de desenvolvimento com credenciais de teste.

`producao (eyelid)`:

1. Codigo roda em `/opt/AutoFeedr`.
2. Acesso geralmente via tunel SSH (`5173` frontend + `8001` API).
3. `.env` do servidor pode divergir do local (segredos reais).
4. Qualquer troca de `TOKEN_ENCRYPTION_KEY` invalida segredos criptografados ja salvos.
5. Limites de quota do provider de IA impactam jobs reais (LinkedIn e LeetCode).

## 10) Riscos e pontos de atencao

1. Painel ainda sem autenticacao/autorizacao.
2. Renovacao de token LinkedIn ainda manual.
3. Dependencia de APIs externas (arXiv, provedor de IA, LinkedIn).
4. Falhas de rede externas podem aumentar latencia de processamento.
5. Necessario manter `TOKEN_ENCRYPTION_KEY` estavel para nao invalidar tokens armazenados.

## 11) Proximos passos naturais

1. Auth para painel/API (mesmo single-user).
2. Endpoint para excluir agenda/conta com seguranca.
3. Auditoria de operacoes administrativas.
4. Segredo centralizado para tokens LinkedIn (fora de Git e com rotacao).
5. Evoluir agenda para UX de calendario ainda mais rica (drag/drop e conflitos).
