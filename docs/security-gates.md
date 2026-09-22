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

### Opção A — SonarCloud (mais rápido para a entrega)

1. `sonarcloud.io` → importe o repositório do GitHub.
2. Copie a `projectKey` e a `organization` para `sonar-project.properties`:
   ```properties
   sonar.projectKey=<org>_<repo>
   sonar.organization=<org>
   ```
3. Gere um token em `My Account → Security` e salve como `SONAR_TOKEN`.
4. Não defina `SONAR_HOST_URL` (a action assume o SonarCloud).

### Opção B — SonarQube próprio (ex.: em outra EC2)

```bash
docker run -d --name sonarqube -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_extensions:/opt/sonarqube/extensions \
  sonarqube:community
```

Login inicial `admin/admin` (troque a senha). Crie o projeto `salafacil`,
gere um token e defina `SONAR_TOKEN` + `SONAR_HOST_URL` nos segredos.

> Restrinja a porta 9000 ao seu IP: um SonarQube exposto entrega o código-fonte
> inteiro a quem passar.

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
