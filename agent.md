# AutoFeedr - Referencia Operacional Atual (2026-02-08)

## 1) Intuito do projeto
O AutoFeedr e uma plataforma para operacao de postagens tecnicas no LinkedIn com multiplas contas, combinando:

1. Cadastro de contas LinkedIn.
2. Agenda recorrente por conta com timezone.
3. Publicacao imediata sob demanda (tema, URL de paper ou texto).
4. Geracao de post via Gemini com traducao e limite para LinkedIn.
5. Execucao automatica por worker com retries.

## 2) Arquitetura atual (MVP com base solida)

Servicos principais:

1. `backend/` (FastAPI + SQLAlchemy)
   - API REST para contas, agendas, jobs e prompts padrao.
   - Criptografa tokens LinkedIn no banco com Fernet.
2. `worker/` (Python)
   - Enfileira jobs de agendas usando `croniter` + timezone por agenda.
   - Processa jobs pendentes com retry automatico.
3. `frontend/` (React + Vite)
   - Painel web com sidebar e 4 telas: Home, Contas, Agenda, Publicar.
4. `postgres` (Docker)
   - Persistencia de contas, agendas, jobs, logs de job e deduplicacao de execucao por minuto.

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

1. `GEMINI_API_KEY`
2. `GEMINI_MODEL`
3. `TOKEN_ENCRYPTION_KEY`
4. `DATABASE_URL`
5. `CORS_ORIGINS`
6. `DEFAULT_TIMEZONE`
7. `WORKER_POLL_SECONDS`
8. `WORKER_MAX_ATTEMPTS`

## 8) Deploy e operacao (ambiente conhecido)

Host de execucao informado:

1. Maquina: `eyelid`
2. Caminho: `/opt/AutoFeedr`
3. Orquestracao: `docker compose`
4. Estrategia adotada: deploy por Git (`develop`) + rebuild de containers

Fluxo usado:

1. `git push origin develop`
2. `ssh eyelid`
3. `cd /opt/AutoFeedr`
4. `git fetch origin develop && git reset --hard origin/develop`
5. `docker compose up -d --build`

## 9) Riscos e pontos de atencao

1. Painel ainda sem autenticacao/autorizacao.
2. Renovacao de token LinkedIn ainda manual.
3. Dependencia de APIs externas (arXiv, Gemini, LinkedIn).
4. Falhas de rede externas podem aumentar latencia de processamento.
5. Necessario manter `TOKEN_ENCRYPTION_KEY` estavel para nao invalidar tokens armazenados.

## 10) Proximos passos naturais

1. Auth para painel/API (mesmo single-user).
2. Endpoint para excluir agenda/conta com seguranca.
3. Auditoria de operacoes administrativas.
4. Segredo centralizado para tokens LinkedIn (fora de Git e com rotacao).
5. Evoluir agenda para UX de calendario ainda mais rica (drag/drop e conflitos).
