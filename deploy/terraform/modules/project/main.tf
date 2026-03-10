resource "railway_project" "this" {
  name           = var.name
  description    = var.description
  has_pr_deploys = var.has_pr_deploys
  team_id        = var.workspace_id

  default_environment = {
    name = var.default_environment_name
  }
}
