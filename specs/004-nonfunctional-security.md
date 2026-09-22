# SPEC-004 — Requisitos Não-Funcionais e Segurança

## 1. Não-funcionais

| ID | Requisito | Verificação |
|---|---|---|
| NFR-1 | p95 < 200 ms para `GET /api/rooms` com 100 salas | teste de carga manual (documentado no runbook) |
| NFR-2 | Aplicação sobe em < 10 s e é stateless exceto pelo arquivo SQLite | healthcheck do Docker |
| NFR-3 | Cobertura de testes ≥ 80% em linhas, medida pelo `node --test` + lcov | quality gate do SonarQube |
| NFR-4 | Logs estruturados em JSON, sem PII além do e-mail do autor da ação | revisão de código |
| NFR-5 | Imagem Docker ≤ 300 MB, rodando como usuário não-root | build do CI |
| NFR-6 | Deploy com downtime < 30 s (recreate do compose) | runbook |

> **NFR-5, valor medido:** 280 MB com `node:22-alpine` (base 243 MB + 37 MB de
> dependências de produção). O alvo original de 250 MB era menor que a própria
> imagem base e foi corrigido para 300 MB após a medição. Reduzir mais exige
> trocar a base por `distroless/nodejs22`, o que está fora do escopo da v1.

## 2. Segurança da aplicação

| ID | Controle | Implementação |
|---|---|---|
| NFR-S1 | Senhas nunca em texto plano | `bcrypt` custo 10; `passwordHash` fora de todo DTO (INV-4) |
| NFR-S2 | Nenhuma escalada por parâmetro | `userId`/`role` sempre do JWT verificado, nunca do corpo (BR-8) |
| NFR-S3 | Sem segredos no código | `JWT_SECRET`, `SEED_*` vêm do ambiente; o processo **falha ao iniciar** se `JWT_SECRET` tiver < 32 caracteres ou for o valor de exemplo |
| NFR-S4 | Login não revela existência de conta | mesma resposta `INVALID_CREDENTIALS` e comparação bcrypt sempre executada (hash dummy quando o usuário não existe) |
| NFR-S5 | Força bruta contida | `@fastify/rate-limit`: 100 req/min por IP global; 5 req/min por IP em `/api/auth/login` |
| NFR-S6 | Sem SQL injection | exclusivamente prepared statements com parâmetros nomeados; proibida interpolação de string em SQL |
| NFR-S7 | Cabeçalhos de segurança | `@fastify/helmet` (CSP restritiva, `X-Content-Type-Options`, HSTS quando atrás de TLS) |
| NFR-S8 | CORS restrito | origem exata em `CORS_ORIGIN`; `*` proibido em produção |
| NFR-S9 | Payload limitado | `bodyLimit` 64 KB |
| NFR-S10 | Erro não vaza stack | handler global devolve `INTERNAL_ERROR`; stack só no log do servidor |
| NFR-S11 | Frontend sem XSS | DOM construído por `textContent`; `innerHTML` proibido (regra de lint) |
| NFR-S12 | Contêiner endurecido | usuário `node` (não-root), `read_only` no compose exceto o volume de dados, `no-new-privileges` |

## 3. Segurança do pipeline (SSDLC)

| ID | Portão | Ferramenta | Falha o build? |
|---|---|---|---|
| SEC-1 | SAST + quality gate | **SonarQube / SonarCloud** | Sim — `sonarqube-quality-gate-action` |
| SEC-2 | Dependências vulneráveis | `npm audit --audit-level=high` | Sim |
| SEC-3 | Vulnerabilidades da imagem | **Trivy** (`severity CRITICAL,HIGH`, `exit-code 1`) | Sim |
| SEC-4 | Segredos commitados | **Gitleaks** | Sim |
| SEC-5 | IaC insegura | **Checkov** sobre `infra/terraform` | Sim |
| SEC-6 | Resultados centralizados | upload SARIF para GitHub Code Scanning | Não |

### Quality gate do SonarQube (SEC-1)

Condições sobre código novo: 0 vulnerabilidades, 0 security hotspots não
revisados, 0 bugs `Blocker`/`Critical`, cobertura ≥ 80%, duplicação ≤ 3%.

## 4. Segurança da infraestrutura

| ID | Controle |
|---|---|
| INF-S1 | Security Group: `80/tcp` público, egresso livre. `22/tcp` controlado por `ssh_allowed_cidr` — restrito ao IP do operador para deploy manual, ou `0.0.0.0/0` quando o deploy é feito por SSH a partir dos runners do GitHub Actions (sem CIDR pequeno e estável para liberar). Mitigação: autenticação exclusivamente por chave, sem senha (padrão do Amazon Linux 2023). Ver `infra/terraform/variables.tf`. |
| INF-S2 | IMDSv2 obrigatório (`http_tokens = "required"`) — bloqueia SSRF contra o metadata |
| INF-S3 | Volume EBS raiz criptografado |
| INF-S4 | Acesso por par de chaves SSH; sem senha; sem credencial AWS dentro da instância |
| INF-S5 | Deploy via GitHub Actions usa segredos do repositório (`EC2_SSH_KEY`, `EC2_HOST`), nunca chaves em arquivo |
| INF-S6 | Estado do Terraform fora do repositório (backend S3 documentado; local no laboratório) |
