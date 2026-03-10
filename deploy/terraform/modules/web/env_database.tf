resource "railway_variable" "database_url" {
  environment_id = var.environment_id
  service_id     = railway_service.web.id
  name           = "DATABASE_URL"
  value          = var.database_url
}
