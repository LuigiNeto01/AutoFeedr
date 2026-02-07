# AutoFeedr - Documento de Referencia Atualizado

## 1) Objetivo do projeto
O AutoFeedr automatiza a rotina de publicacao tecnica no LinkedIn:

1. Consulta artigos recentes no arXiv por tema.
2. Gera um post em PT-BR com Gemini.
3. Traduz o post para EN-US.
4. Publica no LinkedIn em horarios configurados por usuario.

Objetivo pratico: manter constancia de conteudo tecnico com menor esforco manual.

## 2) Arquitetura atual (pos-refatoracoes)

### 2.1 Entrada da aplicacao
- `main.py`
  - Esta minimalista.
  - Apenas chama `run_service()` do modulo de servico.

### 2.2 Orquestracao
- `service/orchestrator.py`
  - Contem o loop principal da aplicacao.
  - Responsavel por:
1. Polling do scheduler a cada 30s.
2. Processar cada agendamento encontrado.
3. Orquestrar: arXiv -> Escritor -> LinkedIn.
4. Registrar logs estruturados de cada etapa.
5. Aplicar deduplicacao (idempotencia minima) por minuto/usuario/topico.

### 2.3 Infra compartilhada
- `shared/runtime.py`
  - `configure_logging()`: configura logging em JSON.
  - `log_event()`: padroniza logs com `fields`.
  - `ExecutionStateStore`: persistencia de execucoes processadas em `data/execution_state.json`, com limpeza por retencao.

### 2.4 Scheduler
- `post_scheduler/main.py`
  - Le `post_scheduler/settings.json`.
  - Compara dia (`mon`, `tue`, ...) e horario (`HH:MM`).
  - Retorna:
1. `found`
2. `matches`
3. `minute` (minuto resolvido no scheduler, usado na deduplicacao)
  - Tambem registra logs estruturados do processo de matching.

### 2.5 Coleta de artigos
- `arxiv_reciver/main.py`
- `arxiv_reciver/src/article_receiver.py`
- `arxiv_reciver/src/schema.py`

Comportamento:
- Busca por topicos com ordenacao por data de submissao.
- Intervalo padrao: dia anterior completo em UTC.
- Pode salvar resultados em `data/temp_article.json`.

### 2.6 Escritor (Gemini)
- `Escritor/Escritor.py`
- `Escritor/src/prompt.py`
- `Escritor/src/utils.py`

Melhorias importantes ja aplicadas:
1. Migracao para SDK nova `google.genai` (dependencia `google-genai`).
2. Validacao de `GEMINI_API_KEY`.
3. Controle de tamanho do texto para evitar falha no LinkedIn:
   - limite por secao (PT e EN),
   - limite final do post bilingue: **3000 caracteres**.

### 2.7 LinkedIn
- `Linkedin/linkedin.py`
- `Linkedin/src/generateCode.py`
- `Linkedin/src/postLinkedin.py`
- `Linkedin/src/utils.py`

Melhorias importantes ja aplicadas:
1. Validacao de env vars (`client_id`, `client_secret`, `redirect_uri`).
2. Timeout em requests externas.
3. Tratamento de erro mais explicito (sem `raise` invalido em string).
4. Remocao de log de token sensivel.
5. Validacoes de usuario/token/urn antes de postar.
6. Segunda protecao de tamanho do texto (3000 caracteres) antes do POST.
7. Persistencia JSON sem suprimir excecao silenciosamente.

## 3) Fluxo de execucao atual

1. `main.py` chama `run_service()`.
2. `run_service()`:
   - inicializa logger JSON,
   - inicializa `ExecutionStateStore`,
   - entra em loop com `sleep(30)`.
3. A cada ciclo:
   - chama `exec_scheduler()`,
   - se nao houver match, registra e continua.
4. Se houver match:
   - atualiza estado de deduplicacao (`state_store.refresh()`),
   - para cada agendamento:
     - se ja processado no mesmo minuto/usuario/topico, ignora,
     - busca artigo no arXiv,
     - gera post (PT + EN) com limite de tamanho,
     - publica no LinkedIn,
     - marca execucao como processada.

## 4) Logging e observabilidade

Formato atual:
- JSON por linha no stdout (ideal para `docker logs`).
- Campos padrao:
1. `ts`
2. `level`
3. `logger`
4. `msg`
- Campos de contexto via `fields` (ex.: `user`, `topic`, `minute`, `fetch_ms`, `linkedin_ms`).

Eventos relevantes ja padronizados:
- `service_start`
- `scheduler_check_start`
- `scheduler_no_match`
- `schedule_processing_start`
- `schedule_skipped_duplicate`
- `article_found` / `article_not_found`
- `post_generated` / `post_generation_failed`
- `linkedin_post_success` / `linkedin_post_failed`
- `schedule_processing_failed`

## 5) Idempotencia (evitar postagem duplicada)

Mecanismo atual:
- Chave: `"{minute}|{user}|{topic}"`.
- Armazenamento: `data/execution_state.json`.
- Retencao: 7 dias (limpeza automatica no `refresh()`).

Efeito:
- Evita repost do mesmo agendamento no mesmo minuto, mesmo com polling a cada 30s.

## 6) Configuracao e dados operacionais

Arquivos principais:
1. `.env`
2. `post_scheduler/settings.json`
3. `dados.json` (token/urn por usuario LinkedIn)
4. `data/temp_article.json`
5. `data/execution_state.json` (deduplicacao)

Variaveis de ambiente usadas:
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (opcional; default atual no escritor: `gemini-2.5-flash`)
- `client_id`
- `client_secret`
- `redirect_uri`

## 7) Dependencias atuais
`requirements.txt`:
1. `arxiv`
2. `google-genai`
3. `python-dotenv`
4. `requests`

## 8) Infra Docker atual

`Dockerfile`:
- Base `python:3.11-slim`
- Executa `python main.py`

`docker-compose.yml`:
- Servico `autofeedr`
- Monta:
1. `./data:/app/data`
2. `./post_scheduler/settings.json:/app/post_scheduler/settings.json:ro`
- Restart: `unless-stopped`

## 9) Fuso horario e horarios de execucao (producao atual)

Contexto conhecido do ambiente de producao:
- Host: `eyelid`
- Caminho: `/opt/AutoFeedr`
- Execucao: Docker

Verificacao feita diretamente no host/container em **7 de fevereiro de 2026**:
1. Host em `Etc/UTC`
2. Container `autofeedr` em `Etc/UTC`

Conclusao pratica:
- Os horarios de `post_scheduler/settings.json` sao interpretados em **UTC**.
- Exemplo: `tue 12:00` significa 12:00 UTC.

## 10) Riscos e proximos pontos de evolucao

Riscos ainda existentes:
1. Nao ha fila persistente de jobs (se cair no horario, nao ha replay automatico).
2. Nao ha renovacao automatica de token LinkedIn.
3. Dependencia total de APIs externas (arXiv/Gemini/LinkedIn).

Melhorias recomendadas:
1. Configurar timezone explicito por env (`APP_TZ`) para reduzir ambiguidades.
2. Adicionar replay de janela perdida apos restart.
3. Adicionar retries com backoff para falhas transientes (429/5xx).
4. Evoluir observabilidade com metricas agregadas.

## 11) Resumo executivo
O projeto evoluiu de um script unico para uma arquitetura mais limpa e operacional:
- `main.py` minimalista,
- orquestracao isolada em `service/`,
- infraestrutura compartilhada em `shared/`,
- logging estruturado,
- deduplicacao persistente,
- escritor e LinkedIn mais robustos e seguros.
