# Runbook — subir o ambiente na AWS

Tempo estimado: 20 minutos. Custo: t3.micro + EIP (elegível ao free tier).

## 0. Pré-requisitos

- Conta AWS com credenciais no ambiente (`aws configure` ou variáveis).
- Terraform ≥ 1.6, AWS CLI, `ssh`.
- Repositório no GitHub com Actions habilitado.

## 1. Gerar o par de chaves de deploy

```bash
ssh-keygen -t ed25519 -f ~/.ssh/salafacil -C "deploy@salafacil" -N ""
cat ~/.ssh/salafacil.pub     # chave pública → terraform.tfvars
cat ~/.ssh/salafacil         # chave privada → segredo EC2_SSH_KEY
```

## 2. Provisionar a instância

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# edite: ssh_public_key e ssh_allowed_cidr (seu IP/32 — INF-S1)
curl -s https://checkip.amazonaws.com    # descobre o seu IP

terraform init
terraform plan
terraform apply
terraform output public_ip               # este é o segredo EC2_HOST
```

A instância sobe com Docker instalado e `/opt/salafacil` pronto (`user_data.sh`).
Confirme com:

```bash
ssh -i ~/.ssh/salafacil ec2-user@$(terraform output -raw public_ip) 'docker --version && docker compose version'
```

## 3. Configurar os segredos do repositório

`Settings → Secrets and variables → Actions`:

| Segredo | Valor |
|---|---|
| `EC2_HOST` | saída `public_ip` do Terraform |
| `EC2_SSH_KEY` | conteúdo de `~/.ssh/salafacil` (chave privada completa) |
| `APP_JWT_SECRET` | `openssl rand -base64 48` |
| `SONAR_TOKEN` | token do SonarQube/SonarCloud |
| `SONAR_HOST_URL` | URL do SonarQube (omita para SonarCloud) |

Crie também o ambiente `production` (`Settings → Environments`) — é ele que
protege o job de deploy.

## 4. Primeiro deploy

Um push na `main` dispara a pipeline. Quando o job `deploy` terminar:

```bash
curl http://<EC2_HOST>/health
# {"status":"ok","version":"<sha>","uptimeSeconds":12}
```

## 5. Carga inicial (uma vez)

```bash
ssh -i ~/.ssh/salafacil ec2-user@<EC2_HOST>
cd /opt/salafacil
docker compose run --rm \
  -e SEED_ADMIN_PASSWORD='<senha-forte>' \
  -e SEED_PROFESSOR_PASSWORD='<senha-forte>' \
  app node dist/seed.js
```

Acesse `http://<EC2_HOST>` e entre com `admin@uni.edu`.

## 6. Operação

| Tarefa | Comando (na instância, em `/opt/salafacil`) |
|---|---|
| Ver logs | `docker compose logs -f --tail=100` |
| Reiniciar | `docker compose restart` |
| Rollback manual | editar `APP_IMAGE` em `.env` para a tag anterior e `docker compose up -d` |
| Backup do banco | `docker run --rm -v salafacil_salafacil-data:/d -v $PWD:/b alpine cp /d/salafacil.db /b/backup-$(date +%F).db` |
| Uso de disco | `docker system df` |

## 7. Destruir o ambiente

```bash
cd infra/terraform && terraform destroy
```

> O volume `salafacil-data` vive dentro da instância: destruir a EC2 apaga o
> banco. Faça o backup do passo 6 antes.

## Problemas comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| `deploy` falha em `docker compose pull` | pacote GHCR privado | torne o pacote público ou faça `docker login ghcr.io` com um PAT na instância |
| Smoke test falha e reverte | `APP_JWT_SECRET` ausente/curto (NFR-S3) | corrija o segredo e redispare o workflow |
| `curl` na porta 80 não responde | Security Group ou contêiner parado | `docker compose ps`; confira as regras do SG |
| SSH recusado | seu IP mudou | atualize `ssh_allowed_cidr` e `terraform apply` |
