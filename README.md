# AutoFeedr

Plataforma para automacao de conteudo tecnico no LinkedIn com:

1. API (`backend`) para contas, agendas e jobs manuais.
2. Worker (`worker`) para scheduler, fila e publicacao.
3. Frontend (`frontend`) para administracao no navegador.
4. Postgres para persistencia.

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
- `GEMINI_API_KEY`
- `TOKEN_ENCRYPTION_KEY` (Fernet, usado para criptografar tokens LinkedIn no banco)
- `DATABASE_URL`
- `CORS_ORIGINS`
- `DEFAULT_TIMEZONE`

## Fluxo resumido
1. Cadastrar contas LinkedIn na API/UI.
2. Criar agendas por conta com `cron_expr` + timezone.
3. Worker enfileira jobs de agenda e processa jobs manuais.
4. Job gera post (tema/link/texto) e publica no LinkedIn.
5. Em falha, retry automatico ate 3 tentativas.

## Documentacao
1. Referencia operacional do projeto: `agent.md`
2. Documentacao completa da API: `docs/API_USAGE.md`

## Estrutura principal
- `backend/`: API e modelos do banco.
- `worker/`: scheduler e processamento de jobs.
- `frontend/`: painel administrativo.
- `packages/`: bibliotecas reutilizaveis (`Escritor`, `Linkedin`, `arxiv_reciver`, `shared`).
- `legacy/`: fluxo antigo preservado para compatibilidade/referencia.
