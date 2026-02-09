# Deploy automatico para `main`

Este projeto usa GitHub Actions para deploy automatico na VPS `eyelid`.

## Como funciona

1. Todo push na branch `main` dispara `.github/workflows/deploy-main.yml`.
2. O workflow conecta por SSH na VPS.
3. Executa:
   - `git fetch origin main`
   - `git checkout main`
   - `git reset --hard origin/main`
   - `docker compose up -d --build`
   - health check em `http://127.0.0.1:8000/health`

## Teste antes do merge

- O mesmo workflow tambem roda em `pull_request` para `main`, mas apenas o job de validacao.
- O job de deploy real nao roda no PR; roda somente em push para `main`.

## Secrets necessarios (GitHub > Settings > Secrets and variables > Actions)

1. `EYELID_HOST`
   - Ex: `124.198.128.136`
2. `EYELID_USER`
   - Ex: `root`
3. `EYELID_SSH_PORT`
   - Ex: `22` (ou outra porta se usar)
4. `EYELID_SSH_PRIVATE_KEY`
   - Chave privada que tenha acesso SSH ao host

## Recomendacoes

1. Criar um usuario de deploy dedicado em vez de usar `root`.
2. Restringir a chave SSH a comandos/host de deploy.
3. Manter `main` protegida com PR + status checks.
