terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # INF-S6 — em produção o estado fica fora do repositório. Para o laboratório
  # o backend local é aceitável; descomente para usar S3 + DynamoDB:
  # backend "s3" {
  #   bucket         = "salafacil-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "salafacil-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "salafacil"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
