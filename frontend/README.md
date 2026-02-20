# AutoFeedr Frontend

Painel unificado do AutoFeedr para operação de automações LinkedIn + LeetCode/GitHub.

## Stack

- React + TypeScript + Vite
- Tailwind CSS + componentes estilo shadcn/ui
- React Router
- TanStack Query
- React Hook Form + Zod
- TanStack Table
- Recharts
- Lucide Icons
- ESLint + Prettier

## Requisitos

- Node 18+
- Backend da API rodando (padrão: `http://localhost:8000`)

## Execução

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Configuração da API

Por padrão, usa:

- `VITE_API_BASE` (se definido)
- senão `http://<host-atual>:8000`

Também é possível alterar em runtime na tela `Configurações`, campo `API Base URL`.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run format
npm run format:check
```

## Rotas

- `/dashboard`
- `/contas`
- `/automacoes`
- `/execucoes`
- `/executar-agora`
- `/agendamentos`
- `/resultados`
- `/configuracoes`

## Endpoints consumidos

Sistema:

- `GET /health`
- `GET /prompts/defaults`

LinkedIn:

- `GET /accounts`
- `POST /accounts`
- `PUT /accounts/{account_id}`
- `GET /schedules`
- `POST /schedules`
- `PUT /schedules/{schedule_id}`
- `POST /jobs/publish-now`
- `GET /jobs`

GitHub:

- `GET /github/accounts`
- `POST /github/accounts`
- `PUT /github/accounts/{account_id}`
- `GET /github/repositories`
- `POST /github/repositories`
- `PUT /github/repositories/{repository_id}`

LeetCode:

- `POST /leetcode/jobs/run-now`
- `GET /leetcode/jobs`
- `GET /leetcode/jobs/{job_id}`
- `GET /leetcode/jobs/{job_id}/logs`
- `GET /leetcode/schedules`
- `POST /leetcode/schedules`
- `PUT /leetcode/schedules/{schedule_id}`
- `GET /leetcode/completed`
