# Infraestrutura do SalaFácil — SPEC-006 §1.
# Controles INF-S1 a INF-S6 de SPEC-004 §4.

locals {
  name = "salafacil-${var.environment}"
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
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
  security_group_id = aws_security_group.app.id
  description       = "HTTP publico para a aplicacao"
  cidr_ipv4         = var.http_allowed_cidr
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.app.id
  description       = "SSH restrito ao CIDR de administracao"
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
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0]
  vpc_security_group_ids      = [aws_security_group.app.id]
  key_name                    = aws_key_pair.deploy.key_name
  associate_public_ip_address = true
  monitoring                  = true
  ebs_optimized               = true

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
