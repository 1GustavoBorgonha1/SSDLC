output "public_ip" {
  description = "IP elástico da instância — use como segredo EC2_HOST na pipeline."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "URL da aplicação."
  value       = "http://${aws_eip.app.public_ip}"
}

output "ssh_command" {
  description = "Comando de acesso administrativo."
  value       = "ssh -i <sua-chave.pem> ec2-user@${aws_eip.app.public_ip}"
}
