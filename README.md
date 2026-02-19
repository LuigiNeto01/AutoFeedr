# AutoFeedr

Plataforma para automacao com dois fluxos:

1. LinkedIn: geracao e publicacao automatica de conteudo tecnico.
2. LeetCode -> GitHub: resolver desafios e commitar no repositorio configurado.
3. API (`backend`) para contas, agendas e jobs manuais.
4. Worker (`worker`) para scheduler, fila e execucao de pipelines.
5. Frontend (`frontend`) para administracao no navegador.
6. Postgres para persistencia.

## Stack
- Backend: FastAPI + SQLAlchemy
- Worker: Python (croniter + retry)
- Frontend: React + Vite
- Banco: Postgres

## Subir com Docker
```bash
docker compose up -d --build
```

Servicos:
- API: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Swagger: `http://localhost:8000/docs`

## Configuracao
Crie `.env` a partir de `.env.example` e configure:

```bash
cp .env.example .env
```

Campos importantes:
- `LLM_PROVIDER` (`openai` ou `gemini`)
- `OPENAI_MODEL` / `OPENAI_API_KEY` (quando `LLM_PROVIDER=openai`)
- `GEMINI_MODEL` / `GEMINI_API_KEY` (quando `LLM_PROVIDER=gemini`)
- `TOKEN_ENCRYPTION_KEY` (Fernet, usado para criptografar tokens LinkedIn no banco)
- `DATABASE_URL`
- `CORS_ORIGINS`
- `DEFAULT_TIMEZONE`
- `LEETCODE_GRAPHQL_URL`
- `LEETCODE_DEFAULT_MAX_ATTEMPTS`
- `LEETCODE_TEST_TIMEOUT_SECONDS`

## Fluxo resumido (LinkedIn)
1. Cadastrar contas LinkedIn na API/UI.
2. Criar agendas por conta com `cron_expr` + timezone.
3. Worker enfileira jobs de agenda e processa jobs manuais.
4. Job gera post (tema/link/texto) e publica no LinkedIn.
5. Em falha, retry automatico ate 3 tentativas.

## Fluxo resumido (LeetCode -> GitHub)
1. Cadastrar conta GitHub com chave SSH via API.
2. Cadastrar repositorio alvo (branch, autor de commit, estrategia).
3. Criar agenda LeetCode ou disparar job imediato.
4. Worker seleciona problema nao pago e ainda nao resolvido.
5. Pipeline gera solucao Python, executa testes e corrige ate 5 tentativas.
6. Em sucesso, commita/pusha no GitHub e registra deduplicacao por problema.

## Documentacao
1. Referencia operacional do projeto: `agent.md`
2. Documentacao completa da API: `docs/API_USAGE.md`

## Estrutura principal
- `backend/`: API e modelos do banco.
- `worker/`: scheduler e processamento de jobs.
- `frontend/`: painel administrativo.
- `packages/`: bibliotecas reutilizaveis (`Escritor`, `Linkedin`, `arxiv_reciver`, `shared`).
- `legacy/`: fluxo antigo preservado para compatibilidade/referencia.
