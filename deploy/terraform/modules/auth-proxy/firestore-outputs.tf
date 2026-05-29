# Outputs for the Phase-2 Firestore session store (additive to outputs.tf).

output "firestore_database_id" {
  description = "Firestore database backing the CLI device-flow session store."
  value       = var.firestore_database_id
}

output "cli_sessions_collection" {
  description = "Collection holding CLI device-flow sessions."
  value       = var.cli_sessions_collection
}
