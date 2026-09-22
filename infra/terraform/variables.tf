variable "aws_region" {
  description = "Região AWS onde a instância será criada."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Nome do ambiente (compõe as tags e o nome dos recursos)."
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "Tipo da instância EC2."
  type        = string
  default     = "t3.micro"
}

variable "ssh_public_key" {
  description = "Conteúdo da chave pública SSH autorizada na instância (INF-S4)."
  type        = string
}

variable "ssh_allowed_cidr" {
  description = <<-EOT
    CIDR autorizado a acessar a porta 22 (INF-S1).

    Restrinja ao seu IP (ex.: "203.0.113.10/32") se o deploy for manual.
    Use "0.0.0.0/0" apenas se a pipeline do GitHub Actions fizer o deploy via
    SSH (job "Deploy na EC2" em .github/workflows/ci-cd.yml): os runners
    hospedados pelo GitHub não têm um bloco de IPs pequeno e estável para
    liberar, então a alternativa a "0.0.0.0/0" é não ter deploy automatizado.
    A mitigação é a autenticação exclusiva por chave (sem senha — padrão do
    Amazon Linux 2023) e a rotação da chave em infra/terraform/variables.tf
    (ssh_public_key) sempre que necessário.
  EOT
  type        = string
}

variable "http_allowed_cidr" {
  description = "CIDR autorizado a acessar a porta 80."
  type        = string
  default     = "0.0.0.0/0"
}

variable "root_volume_size" {
  description = "Tamanho do disco raiz em GiB."
  type        = number
  default     = 16
}

variable "eligible_azs" {
  description = "Zonas de disponibilidade elegíveis para a subnet da instância. Ajuste se a conta restringir o tipo de instância em alguma AZ (comum em contas de laboratório/Academy)."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c", "us-east-1d", "us-east-1f"]
}

variable "instance_profile_name" {
  description = "Nome do instance profile IAM a anexar na instância (CKV2_AWS_41, habilita SSM Session Manager). Em contas AWS Academy Learner Lab use \"LabInstanceProfile\" (já existe; a conta não permite criar roles novas). Fora da Academy, aponte para um profile com o mínimo de permissões necessárias, ou defina null para não anexar nenhum."
  type        = string
  default     = "LabInstanceProfile"
}
