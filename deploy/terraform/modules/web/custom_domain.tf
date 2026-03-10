resource "railway_custom_domain" "web" {
  count          = var.custom_domain != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.web.id
  domain         = var.custom_domain
}
