# Infraestrutura do SalaFácil — SPEC-006 §1.
# Controles INF-S1 a INF-S6 de SPEC-004 §4.

locals {
  name = "salafacil-${var.environment}"
}

data "aws_vpc" "default" {
  default = true
}

# Nem toda AZ da conta suporta o tipo de instancia padrao (ex.: t3.micro nao
# esta disponivel em us-east-1e na AWS Academy Learner Lab). O filtro abaixo
# restringe a busca as AZs elegiveis configuradas em var.eligible_azs.
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "availability-zone"
    values = var.eligible_azs
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# INF-S4 — acesso exclusivamente por par de chaves.
resource "aws_key_pair" "deploy" {
  key_name   = "${local.name}-deploy"
  public_key = var.ssh_public_key
}

# INF-S1 — 80 público, 22 restrito ao CIDR informado.
resource "aws_security_group" "app" {
  name        = "${local.name}-sg"
  description = "Acesso HTTP publico e SSH restrito para a aplicacao SalaFacil"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  # checkov:skip=CKV_AWS_260: risco aceito por decisão de arquitetura — v1 é
  # uma unica EC2 publica sem ALB/WAF na frente (SPEC-006 §1); a porta 80
  # atende a aplicacao web diretamente e precisa ficar acessivel a internet.
  security_group_id = aws_security_group.app.id
  description       = "HTTP publico para a aplicacao"
  cidr_ipv4         = var.http_allowed_cidr
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  # checkov:skip=CKV_AWS_24: risco aceito e documentado em variables.tf
  # (ssh_allowed_cidr) — os runners do GitHub Actions nao publicam um CIDR
  # pequeno e estavel, entao o deploy automatizado via SSH exige 0.0.0.0/0.
  # Mitigacao: autenticacao exclusivamente por chave (sem senha).
  security_group_id = aws_security_group.app.id
  description       = "SSH (ver variables.tf: ssh_allowed_cidr documenta o trade-off)"
  cidr_ipv4         = var.ssh_allowed_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  description       = "Saida liberada para pull de imagens e atualizacoes"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_instance" "app" {
  # checkov:skip=CKV_AWS_88: risco aceito por decisão de arquitetura — v1 é
  # uma unica EC2 sem ALB/NAT na frente (SPEC-006 §1); o IP publico é o unico
  # ponto de entrada da aplicacao e do deploy via SSH.
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.app.id]
  key_name                    = aws_key_pair.deploy.key_name
  associate_public_ip_address = true
  monitoring                  = true
  ebs_optimized               = true
  # CKV2_AWS_41 — instance profile IAM (habilita SSM Session Manager).
  # var.instance_profile_name aponta para "LabInstanceProfile" por padrão em
  # contas AWS Academy Learner Lab, onde não é possível criar roles novas.
  iam_instance_profile = var.instance_profile_name

  # INF-S2 — IMDSv2 obrigatório: mitiga SSRF contra o endpoint de metadados.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  # INF-S3 — disco raiz criptografado.
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  user_data                   = file("${path.module}/user_data.sh")
  user_data_replace_on_change = false

  tags = {
    Name = local.name
  }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${local.name}-eip"
  }
}
