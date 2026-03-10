# -----------------------------------------------------------------------------
# HAIKU Web App + MCP Server - Railway Infrastructure
# -----------------------------------------------------------------------------

module "project" {
  source = "./modules/project"

  name           = var.project_name
  description    = "HAIKU Method - Web dashboard and MCP server for shared workspace memory"
  has_pr_deploys = var.enable_pr_environments
  workspace_id   = var.railway_workspace_id
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
