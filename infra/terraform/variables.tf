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
  description = "CIDR autorizado a acessar a porta 22 (INF-S1). Nunca use 0.0.0.0/0."
  type        = string

  validation {
    condition     = var.ssh_allowed_cidr != "0.0.0.0/0"
    error_message = "INF-S1: 22/tcp não pode ficar aberto para a internet inteira."
  }
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
