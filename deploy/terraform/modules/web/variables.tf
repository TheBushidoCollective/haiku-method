# Required
variable "project_id" {
  description = "Railway project ID"
  type        = string
}

variable "environment_id" {
  description = "Railway environment ID"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL connection URL"
  type        = string
  sensitive   = true
}

# Service Configuration
variable "service_name" {
  description = "Name of the web service"
  type        = string
  default     = "web"
}

variable "github_repo" {
  description = "GitHub repository (owner/repo format)"
  type        = string
}

variable "branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

variable "root_directory" {
  description = "Root directory for the service"
  type        = string
  default     = "web"
}

# Google OAuth (required)
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

# Custom Domain
variable "custom_domain" {
  description = "Custom domain for the web service (optional)"
  type        = string
  default     = ""
}
