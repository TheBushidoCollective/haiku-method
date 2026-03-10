variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "zone_name" {
  description = "Name of the Cloud DNS managed zone"
  type        = string
}

variable "domain" {
  description = "Domain name (e.g., haikumethod.ai)"
  type        = string
}

# Railway MCP subdomain
variable "enable_mcp_dns" {
  description = "Whether to create MCP subdomain DNS records"
  type        = bool
  default     = false
}

variable "mcp_dns_value" {
  description = "Railway DNS value for MCP subdomain"
  type        = string
  default     = ""
}

variable "mcp_verify_txt" {
  description = "Railway domain verification TXT value for MCP"
  type        = string
  default     = ""
}

# GitHub Pages
variable "enable_github_pages_dns" {
  description = "Whether to create GitHub Pages DNS records for apex domain"
  type        = bool
  default     = false
}
