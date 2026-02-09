# AutoFeedr

Automatiza a busca de artigos no arXiv, gera texto com o Gemini e publica no LinkedIn em horarios definidos.

## Requisitos
- Python 3.10+
- Conta e credenciais do LinkedIn
- Chave da API do Gemini

## Instalacao
```bash
pip install -r requirements.txt
```

Crie o arquivo `.env` com base no exemplo:
```bash
copy .env.example .env
```

## Variaveis de ambiente
- `GEMINI_API_KEY`
- `client_id`
- `client_secret`
- `redirect_uri`

## Configuracao de agenda
Edite `post_scheduler/settings.json` para definir usuarios, dias e horarios.

## Execucao
```bash
python main.py
```

## Estrutura
- `arxiv_reciver/`: busca e serializacao de artigos do arXiv
- `Escritor/`: prompts e geracao de texto com Gemini
- `Linkedin/`: autenticacao e postagem no LinkedIn
- `post_scheduler/`: agenda de execucao
- `data/`: arquivos temporarios gerados

## CI/CD
- Workflow de deploy automatico: `.github/workflows/deploy-main.yml`
- Guia de configuracao: `docs/DEPLOY_PIPELINE.md`
