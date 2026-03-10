# -----------------------------------------------------------------------------
# Project Configuration
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the Railway project"
  type        = string
  default     = "haiku-web"
}

variable "github_repo" {
  description = "GitHub repository for deployments (owner/repo format)"
  type        = string
  default     = "TheBushidoCollective/haiku-method"
}

variable "production_branch" {
  description = "Branch to deploy to production"
  type        = string
  default     = "main"
}

# -----------------------------------------------------------------------------
# Environment Configuration
# -----------------------------------------------------------------------------

variable "enable_pr_environments" {
  description = "Enable automatic PR preview environments"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Web Service Configuration
# -----------------------------------------------------------------------------

variable "web_root_directory" {
  description = "Root directory for the web service"
  type        = string
  default     = "web"
}

variable "web_custom_domain" {
  description = "Custom domain for production"
  type        = string
  default     = "mcp.haikumethod.ai"
}

# -----------------------------------------------------------------------------
# Secrets (sensitive - pass via TF_VAR_* or terraform.tfvars)
# -----------------------------------------------------------------------------

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}
