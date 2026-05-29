# Variables for the Phase-2 Firestore session store (additive to variables.tf).

variable "firestore_create_database" {
  description = <<-EOT
    Whether this module should create the Firestore database. Set to false if the
    project already has a (default) Native-mode Firestore database — a GCP project
    can hold only one. When false, the module skips google_firestore_database +
    the firestore.googleapis.com enable and only manages the TTL policy / index /
    IAM against the existing database.
  EOT
  type        = bool
  default     = true
}

variable "firestore_location_id" {
  description = "Firestore location (e.g. nam5, us-central1). Immutable once the database exists."
  type        = string
  default     = "nam5"
}

variable "firestore_database_id" {
  description = "Firestore database id. The default Native database is '(default)'."
  type        = string
  default     = "(default)"
}

variable "cli_sessions_collection" {
  description = "Collection holding short-TTL CLI device-flow sessions. Must match COLLECTION in auth-proxy/src/sessions.ts."
  type        = string
  default     = "cli_sessions"
}
