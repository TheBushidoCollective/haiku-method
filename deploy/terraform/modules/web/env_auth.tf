resource "random_password" "nextauth_secret" {
  length  = 64
  special = false
}

resource "railway_variable" "nextauth_secret" {
  environment_id = var.environment_id
  service_id     = railway_service.web.id
  name           = "NEXTAUTH_SECRET"
  value          = random_password.nextauth_secret.result
}

resource "railway_variable" "nextauth_url" {
  environment_id = var.environment_id
  service_id     = railway_service.web.id
  name           = "NEXTAUTH_URL"
  value          = var.custom_domain != "" ? "https://${var.custom_domain}" : ""
}

resource "railway_variable" "google_client_id" {
  environment_id = var.environment_id
  service_id     = railway_service.web.id
  name           = "GOOGLE_CLIENT_ID"
  value          = var.google_client_id
}

resource "railway_variable" "google_client_secret" {
  environment_id = var.environment_id
  service_id     = railway_service.web.id
  name           = "GOOGLE_CLIENT_SECRET"
  value          = var.google_client_secret
}
