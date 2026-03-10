# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "project_id" {
  description = "Railway project ID"
  value       = module.project.id
}

output "web_service_id" {
  description = "Web service ID"
  value       = module.web.service_id
}

output "postgres_service_id" {
  description = "PostgreSQL service ID"
  value       = module.postgres.service_id
}

output "web_url" {
  description = "Web service URL (Railway-generated or custom domain)"
  value       = var.web_custom_domain != "" ? "https://${var.web_custom_domain}" : "https://${module.web.service_name}.up.railway.app"
}
