# -----------------------------------------------------------------------------
# HAIKU Web App + MCP Server - Railway Infrastructure
# -----------------------------------------------------------------------------

module "project" {
  source = "./modules/project"

  name           = var.project_name
  description    = "HAIKU Method - Web dashboard and MCP server for shared workspace memory"
  has_pr_deploys = var.enable_pr_environments
}

module "postgres" {
  source = "./modules/postgres"

  project_id     = module.project.id
  environment_id = module.project.default_environment_id
  database       = "haiku"
  username       = "haiku"
}

module "web" {
  source = "./modules/web"

  project_id     = module.project.id
  environment_id = module.project.default_environment_id

  # GitHub source
  github_repo    = var.github_repo
  branch         = var.production_branch
  root_directory = var.web_root_directory

  # Database
  database_url = module.postgres.connection_url

  # Google OAuth
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret

  # Custom domain
  custom_domain = var.web_custom_domain
}

# -----------------------------------------------------------------------------
# GCP DNS (optional - only if gcp_project_id is set)
# -----------------------------------------------------------------------------

module "dns" {
  source = "./modules/dns"
  count  = var.gcp_project_id != "" ? 1 : 0

  project_id = var.gcp_project_id
  zone_name  = var.gcp_dns_zone_name
  domain     = var.domain

  # MCP subdomain → Railway
  enable_mcp_dns = var.web_custom_domain != ""
  mcp_dns_value  = module.web.custom_domain_dns_value
  mcp_verify_txt = var.mcp_domain_verify_txt

  # GitHub Pages for apex domain
  enable_github_pages_dns = true
}
