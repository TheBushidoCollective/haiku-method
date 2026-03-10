output "service_id" {
  description = "Web service ID"
  value       = railway_service.web.id
}

output "service_name" {
  description = "Web service name"
  value       = railway_service.web.name
}

output "custom_domain_dns_value" {
  description = "DNS record value for custom domain (if configured)"
  value       = var.custom_domain != "" ? railway_custom_domain.web[0].dns_record_value : null
}
