# Analise Completa do Projeto AutoFeedr

## 1) Intuito do projeto
O AutoFeedr automatiza um pipeline de conteudo tecnico para LinkedIn:

1. Buscar artigos recentes no arXiv por topico.
2. Gerar um texto de post com IA (Gemini) em PT-BR.
3. Traduzir o mesmo post para EN-US.
4. Publicar no LinkedIn em horarios predefinidos por usuario.

Em resumo: o projeto funciona como um "agente de curadoria e publicacao automatica" para perfis tecnicos, reduzindo trabalho manual de pesquisa, redacao e postagem.

## 2) Arquitetura geral
O projeto esta dividido em 4 modulos principais:

1. `arxiv_reciver/`
Responsavel por consultar a API do arXiv e serializar resultados.

2. `Escritor/`
Responsavel por montar prompts e chamar Gemini para gerar o texto final.

3. `Linkedin/`
Responsavel por OAuth, persistencia de token/URN e envio da postagem via API.

4. `post_scheduler/`
Responsavel por ler agenda em JSON e decidir quando um post deve ser executado.

Orquestracao central:

- `main.py` roda em loop infinito e conecta todos os modulos.

## 3) Fluxo de execucao ponta a ponta
Arquivo principal: `main.py`

1. Inicia um loop infinito.
2. Espera 30 segundos (`sleep(30)`).
3. Chama `exec_scheduler()` para verificar se existe agendamento para o minuto atual.
4. Para cada agendamento encontrado:
5. Busca artigo com `get_article(topics=[topic], per_topic=1, save_in_file=True)`.
6. Se nao houver artigo para o topico, cancela apenas aquele agendamento.
7. Gera texto com `gerar_post(...)` no modulo `Escritor`.
8. Se falhar geracao de texto, cancela apenas aquele agendamento.
9. Publica via `FazerPost(texto_post, user)` no modulo LinkedIn.

Resultado pratico: a cada horario configurado em `post_scheduler/settings.json`, o projeto tenta publicar automaticamente.

## 4) Como cada modulo funciona

### 4.1 `post_scheduler/` (detector de horario)
Arquivo: `post_scheduler/main.py`

- Le o arquivo `post_scheduler/settings.json`.
- Usa dia abreviado em ingles minusculo (`mon`, `tue`, `wed`, etc.) via `%a`.
- Compara horario no formato `HH:MM`.
- Retorna:
1. `{'found': True, 'matches': [...]}` quando ha agenda.
2. `{'found': False, 'matches': []}` quando nao ha.

Formato esperado em `settings.json`:

- Lista de usuarios.
- Cada usuario com lista de objetos `{day, time, topic}`.

### 4.2 `arxiv_reciver/` (coleta de artigos)
Arquivos principais:

- `arxiv_reciver/main.py`
- `arxiv_reciver/src/article_receiver.py`
- `arxiv_reciver/src/schema.py`

Comportamento:

- `get_article(...)` decide se usa intervalo informado (`start`, `end`) ou intervalo padrao.
- Intervalo padrao: dia anterior inteiro em UTC.
- `fetch_articles_by_topics(...)`:
1. Normaliza topicos.
2. Converte datas para timezone UTC.
3. Monta filtro `submittedDate:[YYYYMMDDHHMMSS TO YYYYMMDDHHMMSS]`.
4. Consulta arXiv com `sort_by=SubmittedDate` e ordem descendente.
5. Serializa artigos para dict JSON-friendly.
6. Inclui `intervalo_consulta` com `inicio` e `fim`.

Estrutura de artigo (`ArxivArticle`):

- `title`, `summary`, `authors`, `published`, `updated`, `url`.

Persistencia:

- Quando `save_in_file=True`, salva em `data/temp_article.json`.

### 4.3 `Escritor/` (geracao de texto com Gemini)
Arquivos:

- `Escritor/Escritor.py`
- `Escritor/src/prompt.py`
- `Escritor/src/utils.py`

Comportamento:

- Carrega `GEMINI_API_KEY` do `.env`.
- Usa modelo em `GEMINI_MODEL` ou fallback `models/gemini-2.5-flash`.
- Gera primeiro um post em portugues com regras de tom, limite de caracteres e responsabilidade tecnica.
- Traduz para ingles mantendo estilo e limite.
- Monta saida final em bloco unico:
1. `「PT-BR」`
2. `「EN-US」`

Se qualquer etapa falhar, retorna `None` e cancela publicacao.

### 4.4 `Linkedin/` (autenticacao e publicacao)
Arquivos:

- `Linkedin/linkedin.py`
- `Linkedin/src/generateCode.py`
- `Linkedin/src/postLinkedin.py`
- `Linkedin/src/utils.py`

Funcionalidades:

1. `gerar_url_para_token()`
Monta URL OAuth de autorizacao do LinkedIn.

2. `gerar_token_api(usuario, codigo)`
Troca `authorization code` por `access_token` e salva em `dados.json`.

3. `gerar_urn(usuario)`
Consulta `/v2/userinfo`, extrai `sub` e salva URN em `dados.json`.

4. `FazerPost(texto, usuario)`
Le `dados.json`, pega token + urn, publica em `/v2/ugcPosts`.

Armazenamento local:

- `dados.json` guarda credenciais operacionais por usuario:
1. `token`
2. `DataToken`
3. `urn`

## 5) Dados e arquivos importantes

1. `.env`
Credenciais de API:
- `GEMINI_API_KEY`
- `client_id`
- `client_secret`
- `redirect_uri`

2. `post_scheduler/settings.json`
Define quem posta, quando e sobre qual topico.

3. `dados.json`
Estado de autenticacao dos usuarios do LinkedIn.

4. `data/temp_article.json`
Ultima coleta de artigos salva localmente.

## 6) Dependencias e infraestrutura
Dependencias principais em `requirements.txt`:

1. `arxiv`
2. `google-genai`
3. `python-dotenv`
4. `requests`

Execucao em container:

- `Dockerfile` executa `python main.py`.
- `docker-compose.yml` monta `./data` e `settings.json`, e reinicia com `unless-stopped`.

## 7) Funcionamento operacional esperado
Para funcionar em producao/local:

1. Preencher `.env` com credenciais validas.
2. Configurar agendas em `post_scheduler/settings.json`.
3. Realizar bootstrap OAuth:
- gerar URL de autorizacao,
- obter `code`,
- gerar token por usuario,
- gerar URN por usuario.
4. Garantir que `dados.json` esteja populado.
5. Rodar `python main.py` (ou via Docker).

Sem token/URN validos por usuario, a etapa de publicacao falha.

## 8) Pontos tecnicos relevantes (comportamento real atual)

1. Janela de busca padrao do arXiv usa UTC e dia anterior completo.
2. O loop roda a cada 30 segundos e pode bater duas vezes no mesmo minuto.
3. Nao existe controle de idempotencia de postagem por horario.
4. Nao existe renovacao automatica de token do LinkedIn.
5. Excecoes em JSON (`Linkedin/src/utils.py`) sao suprimidas com `except: pass`.
6. `postar_no_linkedin` usa versao da API baseada no mes anterior.
7. Projeto depende de servicos externos (arXiv, Gemini, LinkedIn); indisponibilidade afeta o fluxo.

## 9) Riscos e limites do design atual

1. Risco de post duplicado no mesmo minuto por falta de trava/deduplicacao.
2. Risco de parada total se token expirar e nao for renovado.
3. Risco de diagnostico ruim por tratamento silencioso de erro em JSON.
4. Risco de vazamento de segredo se `dados.json` for versionado/exposto.
5. Acoplamento forte ao formato de `settings.json` e `dados.json` sem validacao robusta.

## 10) Resumo final do funcionamento
O AutoFeedr e um orquestrador de publicacao tecnica automatizada: detecta horarios agendados, busca artigos recentes por topico no arXiv, usa Gemini para redigir e traduzir um post profissional e publica no LinkedIn do usuario configurado. O objetivo central e manter uma rotina automatica de conteudo tecnico com pouco trabalho manual.
