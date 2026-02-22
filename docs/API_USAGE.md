# AutoFeedr API - Documentacao de Uso

## 1) Visao geral
API REST para operacao do AutoFeedr:

1. Gerenciar contas LinkedIn (multi-conta).
2. Gerenciar agendas de postagem.
3. Disparar publicacao imediata.
4. Consultar jobs de execucao.
5. Consultar prompts padrao.

Base URL (local): `http://localhost:8000`

Documentacao interativa:

1. Swagger UI: `http://localhost:8000/docs`
2. OpenAPI JSON: `http://localhost:8000/openapi.json`

Conteudo:

1. Endpoints disponiveis.
2. Contratos de request/response.
3. Regras de validacao.
4. Erros comuns.
5. Exemplos `curl`.

## 2) Convencoes

1. `Content-Type`: `application/json`.
2. Datas retornam em formato ISO.
3. Timezone de agenda e definido por campo `timezone`.
4. IDs sao inteiros.

## 3) Entidades

### 3.1 LinkedinAccount

Campos principais:

1. `id` (int)
2. `name` (string, unico)
3. `urn` (string)
4. `prompt_generation` (string | null)
5. `prompt_translation` (string | null)
6. `is_active` (bool)
7. `created_at`, `updated_at` (datetime)

Observacao de seguranca:

1. Token nao e retornado pela API.
2. Token e armazenado criptografado (`token_encrypted`) no banco.

### 3.2 Schedule

Campos principais:

1. `id` (int)
2. `account_id` (int)
3. `topic` (string)
4. `cron_expr` (string)
5. `day_of_week` (int 0-6 | null)
6. `time_local` (`HH:MM` | null)
7. `timezone` (string IANA, ex.: `America/Sao_Paulo`)
8. `is_active` (bool)
9. `created_at`, `updated_at` (datetime)

Regra de criacao:

1. Informe `cron_expr`.
2. Ou informe `day_of_week` + `time_local` (a API gera `cron_expr` automaticamente).

### 3.3 Job

Campos principais:

1. `id` (int)
2. `account_id` (int)
3. `source` (`manual` ou `schedule`)
4. `status` (`pending`, `retry`, `running`, `success`, `failed`)
5. `topic`, `paper_url`, `generated_post`, `error_message`
6. `attempts`, `max_attempts`
7. `scheduled_for`, `next_retry_at`
8. `created_at`, `updated_at`

## 4) Endpoints

### 4.1 Health check

`GET /health`

Resposta:

```json
{
  "status": "ok",
  "service": "autofeedr-api"
}
```

Exemplo:

```bash
curl -s http://localhost:8000/health
```

### 4.2 Prompts padrao

`GET /prompts/defaults`

Retorna prompts default usados como base para geracao/traducao.

Resposta:

```json
{
  "prompt_generation": "....",
  "prompt_translation": "...."
}
```

Exemplo:

```bash
curl -s http://localhost:8000/prompts/defaults
```

### 4.2.1 Migracao de endpoints LinkedIn (antigo -> novo)

As rotas antigas sem namespace foram descontinuadas. Use apenas os novos endpoints com prefixo `/linkedin`.

| Endpoint antigo | Endpoint novo |
| --- | --- |
| `GET /accounts` | `GET /linkedin/accounts` |
| `POST /accounts` | `POST /linkedin/accounts` |
| `PUT /accounts/{account_id}` | `PUT /linkedin/accounts/{account_id}` |
| `DELETE /accounts/{account_id}` | `DELETE /linkedin/accounts/{account_id}` |
| `GET /schedules` | `GET /linkedin/schedules` |
| `POST /schedules` | `POST /linkedin/schedules` |
| `PUT /schedules/{schedule_id}` | `PUT /linkedin/schedules/{schedule_id}` |
| `POST /jobs/publish-now` | `POST /linkedin/jobs/run-now` |
| `GET /jobs?limit=...` | `GET /linkedin/jobs?limit=...` |

### 4.3 Listar contas

`GET /linkedin/accounts`

Resposta: array de `AccountOut`.

Exemplo:

```bash
curl -s http://localhost:8000/linkedin/accounts
```

### 4.4 Criar conta

`POST /linkedin/accounts`

Request body:

```json
{
  "name": "Luigi",
  "token": "linkedin_access_token_aqui",
  "urn": "YOUR_LINKEDIN_PERSON_URN_OR_ID",
  "prompt_generation": "Prompt custom de geracao",
  "prompt_translation": "Prompt custom de traducao",
  "is_active": true
}
```

Validacoes:

1. `name`: min 2, max 120.
2. `token`: min 10.
3. `urn`: min 3, max 255.
4. Nome duplicado retorna `409`.

Exemplo:

```bash
curl -s -X POST http://localhost:8000/linkedin/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Luigi",
    "token":"linkedin_access_token_aqui",
    "urn":"6LN8M2VQmI",
    "is_active":true
  }'
```

### 4.5 Atualizar conta

`PUT /linkedin/accounts/{account_id}`

Campos permitidos no body:

1. `token`
2. `urn`
3. `prompt_generation`
4. `prompt_translation`
5. `is_active`

Exemplo:

```bash
curl -s -X PUT http://localhost:8000/linkedin/accounts/1 \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_generation":"Novo prompt de geracao",
    "prompt_translation":"Novo prompt de traducao",
    "is_active":true
  }'
```

### 4.6 Listar agendas

`GET /linkedin/schedules`

Resposta: array de `ScheduleOut`.

Exemplo:

```bash
curl -s http://localhost:8000/linkedin/schedules
```

### 4.7 Criar agenda

`POST /linkedin/schedules`

Opcao A (recomendada): `day_of_week` + `time_local`.

```json
{
  "account_id": 1,
  "topic": "machine learning",
  "day_of_week": 2,
  "time_local": "12:00",
  "timezone": "America/Sao_Paulo",
  "is_active": true
}
```

Opcao B: `cron_expr` direto.

```json
{
  "account_id": 1,
  "topic": "machine learning",
  "cron_expr": "0 12 * * 2",
  "timezone": "America/Sao_Paulo",
  "is_active": true
}
```

Validacoes:

1. `topic`: min 2, max 255.
2. `day_of_week`: 0..6.
3. `time_local`: regex `HH:MM`.
4. Se nao enviar `cron_expr`, deve enviar `day_of_week + time_local`.
5. `account_id` invalido retorna `404`.

Exemplo:

```bash
curl -s -X POST http://localhost:8000/linkedin/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "account_id":1,
    "topic":"machine learning",
    "day_of_week":2,
    "time_local":"12:00",
    "timezone":"America/Sao_Paulo",
    "is_active":true
  }'
```

### 4.8 Atualizar agenda

`PUT /linkedin/schedules/{schedule_id}`

Regras:

1. Se enviar `cron_expr`, `day_of_week` e `time_local` passam a `null`.
2. Se enviar `day_of_week + time_local`, API recalcula `cron_expr`.

Exemplo:

```bash
curl -s -X PUT http://localhost:8000/linkedin/schedules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "topic":"LLM",
    "day_of_week":5,
    "time_local":"13:00",
    "timezone":"America/Sao_Paulo",
    "is_active":true
  }'
```

### 4.9 Publicacao imediata

`POST /linkedin/jobs/run-now`

Request body:

```json
{
  "account_id": 1,
  "topic": "computer vision"
}
```

Campos aceitos:

1. `topic`
2. `paper_url`
3. `paper_text`

Regra:

1. Deve existir ao menos um entre `topic`, `paper_url`, `paper_text`.

Exemplos:

Por tema:

```bash
curl -s -X POST http://localhost:8000/linkedin/jobs/run-now \
  -H "Content-Type: application/json" \
  -d '{
    "account_id":1,
    "topic":"computer vision"
  }'
```

Por URL de paper:

```bash
curl -s -X POST http://localhost:8000/linkedin/jobs/run-now \
  -H "Content-Type: application/json" \
  -d '{
    "account_id":1,
    "paper_url":"https://arxiv.org/abs/2407.01234"
  }'
```

Por texto de paper:

```bash
curl -s -X POST http://localhost:8000/linkedin/jobs/run-now \
  -H "Content-Type: application/json" \
  -d '{
    "account_id":1,
    "paper_text":"Title: ... Summary: ..."
  }'
```

### 4.10 Listar jobs

`GET /linkedin/jobs?limit=50`

Query params:

1. `limit` (default 50)

Exemplo:

```bash
curl -s "http://localhost:8000/linkedin/jobs?limit=20"
```

## 5) Erros comuns e diagnostico

1. `404 Conta nao encontrada`
   - `account_id` inexistente em `/schedules` ou `/linkedin/jobs/run-now`.
2. `409 Conta com esse nome ja existe`
   - Nome duplicado em `POST /linkedin/accounts`.
3. `422 Informe cron_expr ou (day_of_week + time_local)`
   - Body incompleto em criacao de agenda.
4. `422 Informe topic, paper_url ou paper_text`
   - Body sem fonte de conteudo em publicacao imediata.

## 6) Funcionamento do worker (importante para operacao)

1. Worker verifica agendas ativas em ciclos (`WORKER_POLL_SECONDS`).
2. Agenda devida gera job `pending`.
3. Processa jobs em lote (ate 10 por ciclo).
4. Tentativas:
   - tentativa 1 falhou: retry em +2 min
   - tentativa 2 falhou: retry em +4 min
   - tentativa 3 falhou: status `failed`
5. Valor maximo padrao de tentativas: `WORKER_MAX_ATTEMPTS=3`.

## 7) Seguranca e boas praticas

1. Nunca versionar tokens reais no Git.
2. Definir `TOKEN_ENCRYPTION_KEY` forte e estavel.
3. Restringir `CORS_ORIGINS` para dominios realmente usados.
4. Em ambiente exposto, proteger API/painel com autenticacao.

## 8) Operacao rapida (checklist)

1. Subir stack:

```bash
docker compose up -d --build
```

2. Validar API:

```bash
curl -s http://localhost:8000/health
```

3. Cadastrar conta:

```bash
curl -s -X POST http://localhost:8000/linkedin/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Conta1","token":"token_aqui","urn":"urn_aqui"}'
```

4. Criar agenda:

```bash
curl -s -X POST http://localhost:8000/linkedin/schedules \
  -H "Content-Type: application/json" \
  -d '{"account_id":1,"topic":"machine learning","day_of_week":2,"time_local":"12:00","timezone":"America/Sao_Paulo"}'
```

5. Publicar agora:

```bash
curl -s -X POST http://localhost:8000/linkedin/jobs/run-now \
  -H "Content-Type: application/json" \
  -d '{"account_id":1,"topic":"llm"}'
```

6. Ver status:

```bash
curl -s "http://localhost:8000/linkedin/jobs?limit=20"
```

## 9) Automacao LeetCode -> GitHub

### 9.1 Cadastrar conta GitHub (SSH)

`POST /github/accounts`

Request body:

```json
{
  "name": "github-main",
  "ssh_private_key": "-----BEGIN OPENSSH PRIVATE KEY-----...",
  "ssh_passphrase": null,
  "is_active": true
}
```

Observacoes:

1. `ssh_private_key` e input-only (nunca retorna na API).
2. Chave e passphrase sao criptografadas no banco.

### 9.2 Listar/atualizar contas GitHub

1. `GET /github/accounts`
2. `PUT /github/accounts/{account_id}`

Body de update aceita:

1. `ssh_private_key`
2. `ssh_passphrase`
3. `is_active`

### 9.3 Cadastrar repositorio GitHub

`POST /github/repositories`

```json
{
  "account_id": 1,
  "repo_ssh_url": "git@github.com:owner/leetcode-sandbox.git",
  "default_branch": "main",
  "solutions_dir": "problems",
  "commit_author_name": "AutoFeedr Bot",
  "commit_author_email": "bot@example.com",
  "selection_strategy": "random",
  "difficulty_policy": "free_any",
  "is_active": true
}
```

Endpoints relacionados:

1. `GET /github/repositories`
2. `PUT /github/repositories/{repository_id}`

### 9.4 Criar job imediato LeetCode

`POST /leetcode/jobs/run-now`

```json
{
  "repository_id": 1,
  "selection_strategy": "random",
  "difficulty_policy": "free_any",
  "problem_slug": null,
  "max_attempts": 2
}
```

Campos opcionais:

1. `selection_strategy`: `random`, `easy_first`, `sequential`
2. `difficulty_policy`: `free_any`, `free_easy`, `free_easy_medium`
3. `problem_slug`: forca problema especifico
4. `max_attempts`: limite de tentativas de correcao

### 9.5 Consultar jobs LeetCode

1. `GET /leetcode/jobs?limit=50&repository_id=1`
2. `GET /leetcode/jobs/{job_id}`
3. `GET /leetcode/jobs/{job_id}/logs`

Status possiveis:

1. `pending`
2. `running`
3. `retry`
4. `success`
5. `failed`

### 9.6 Agendar automacao LeetCode

1. `POST /leetcode/schedules`
2. `GET /leetcode/schedules`
3. `PUT /leetcode/schedules/{schedule_id}`

Body de criacao:

```json
{
  "repository_id": 1,
  "day_of_week": 1,
  "time_local": "08:30",
  "timezone": "America/Sao_Paulo",
  "selection_strategy": "random",
  "difficulty_policy": "free_any",
  "max_attempts": 2,
  "is_active": true
}
```

Regra:

1. Envie `cron_expr` ou `day_of_week + time_local`.

### 9.7 Consultar problemas ja resolvidos

`GET /leetcode/completed?repository_id=1&limit=100`

Retorna historico usado para deduplicacao de desafios no mesmo repositorio.

## 10) Configuracoes adicionais de runtime

Novas variaveis em `.env`:

1. `LEETCODE_GRAPHQL_URL`
2. `LEETCODE_HTTP_TIMEOUT_SECONDS`
3. `LEETCODE_DEFAULT_MAX_ATTEMPTS`
4. `LEETCODE_TEST_TIMEOUT_SECONDS`
5. `LEETCODE_RETRY_BASE_MINUTES`
6. `WORKER_TMP_DIR`
