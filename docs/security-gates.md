# Portões de segurança no deploy

Implementam SPEC-004 §3. Todos rodam em `.github/workflows/ci-cd.yml`,
antes de qualquer imagem chegar à AWS.

| Portão | Ferramenta | O que detecta | Bloqueia? |
|---|---|---|---|
| SEC-1 | SonarQube / SonarCloud | vulnerabilidades e bugs no código, hotspots, cobertura, duplicação | sim, via Quality Gate |
| SEC-2 | `npm audit` | dependências com CVE `high`/`critical` | sim |
| SEC-3 | Trivy | CVEs na imagem Docker (SO + libs) | sim |
| SEC-4 | Gitleaks | chaves e tokens commitados | sim |
| SEC-5 | Checkov | IaC insegura no Terraform | sim |
| SEC-6 | GitHub Code Scanning | centraliza os SARIF de Trivy e Checkov | não |

## Configurar o SonarQube (SEC-1)

### Opção A — SonarCloud (mais rápido; não é o que esta entrega usa)

1. `sonarcloud.io` → importe o repositório do GitHub.
2. Copie a `projectKey` e a `organization` para `sonar-project.properties`:
   ```properties
   sonar.projectKey=<org>_<repo>
   sonar.organization=<org>
   ```
3. Gere um token em `My Account → Security` e salve como `SONAR_TOKEN`.
4. Não defina `SONAR_HOST_URL` (a action assume o SonarCloud).

### Opção B — SonarQube próprio na mesma EC2 (usado nesta entrega)

O container roda **só em `127.0.0.1:9000`** — nunca exposto à internet, nem
via Security Group. A pipeline chega até ele por um túnel SSH que reaproveita
a mesma chave do deploy (`EC2_SSH_KEY`), sem abrir porta nova nenhuma:

```bash
# na EC2 — antes disso, garanta swap e vm.max_map_count (o Elasticsearch
# embutido do SonarQube exige >= 262144 e o t3.micro tem só 916 MB de RAM):
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
sudo sysctl -w vm.max_map_count=262144

docker run -d --name sonarqube --restart unless-stopped \
  -p 127.0.0.1:9000:9000 \
  -e SONAR_SEARCH_JAVAOPTS="-Xms512m -Xmx512m" \
  -e SONAR_WEB_JAVAOPTS="-Xmx256m -Xms128m" \
  -e SONAR_CE_JAVAOPTS="-Xmx256m -Xms128m" \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_extensions:/opt/sonarqube/extensions \
  --ulimit nofile=131072:131072 --ulimit nproc=8192:8192 \
  sonarqube:community
```

Login inicial `admin/admin` (a API recusa esse par nas primeiras requisições
autenticadas — troque a senha e gere o token via `/api/user_tokens/generate`).
Crie o projeto `salafacil`, gere um token e salve só como `SONAR_TOKEN`
(`SONAR_HOST_URL` fica fixo em `http://localhost:9000` no workflow, atrás do
túnel — não é segredo, não precisa de secret).

O job `Qualidade e SAST` do workflow abre o túnel antes do scan
(`ssh -f -N -L 127.0.0.1:9000:127.0.0.1:9000 ec2-user@$EC2_HOST`) e espera
`/api/system/status` responder `UP` antes de prosseguir.

### Quality Gate exigido

Em `Quality Gates → Create`, sobre **código novo**:

| Condição | Limite |
|---|---|
| Vulnerabilidades | 0 |
| Security hotspots revisados | 100% |
| Bugs Blocker/Critical | 0 |
| Cobertura | ≥ 80% |
| Linhas duplicadas | ≤ 3% |

A cobertura chega pelo `app/coverage/lcov.info` gerado por `npm run test:coverage`.

## Rodar os portões localmente

```bash
cd app && npm run lint && npm run typecheck && npm run test:coverage && npm audit --audit-level=high

# Trivy na imagem
docker build -t salafacil:local . && trivy image --severity CRITICAL,HIGH salafacil:local

# Checkov na IaC
checkov -d infra/terraform

# Gitleaks
gitleaks detect --source . --no-banner
```

## Quando um portão falha

- **SEC-2/SEC-3**: atualize a dependência ou a imagem base. Só use `--ignore`
  com uma justificativa registrada no PR e prazo para remover.
- **SEC-1**: corrija o apontamento. Marcar um hotspot como "safe" exige
  descrever por que ele não é explorável no contexto da aplicação.
- **SEC-4**: rotacione o segredo vazado **antes** de reescrever o histórico —
  o que foi publicado deve ser considerado comprometido.
- **SEC-5**: corrija o recurso Terraform. Um `skip_check` precisa de comentário
  explicando o risco aceito.
