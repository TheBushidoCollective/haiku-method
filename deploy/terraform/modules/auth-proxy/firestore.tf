# ---------------------------------------------------------------------------
# Firestore — CLI device-flow session store (Phase 2)
#
# Backs the /cli/start → /cli/complete → /cli/poll handshake in
# auth-proxy/src/cli.ts. Sessions are short-lived (10 min) and self-expire via
# an `expires_at` field; the TTL policy below is the backstop sweep behind the
# function's opportunistic delete-on-read.
#
# A GCP project holds exactly one Firestore database. If the project already has
# a (default) Native-mode database, set firestore_create_database = false so this
# module manages only the TTL policy + IAM against the existing database.
# ---------------------------------------------------------------------------

resource "google_project_service" "firestore" {
  count              = var.firestore_create_database ? 1 : 0
  project            = var.project_id
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_firestore_database" "sessions" {
  count = var.firestore_create_database ? 1 : 0

  project                 = var.project_id
  name                    = var.firestore_database_id
  location_id             = var.firestore_location_id
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_ENABLED"

  depends_on = [google_project_service.firestore]
}

# TTL policy: Firestore deletes a document once the timestamp/numeric field named
# here is in the past. The function writes `expires_at` (epoch seconds) on every
# CLI session.
resource "google_firestore_field" "cli_sessions_ttl" {
  project    = var.project_id
  database   = var.firestore_database_id
  collection = var.cli_sessions_collection
  field      = "expires_at"

  ttl_config {}

  # Leave normal indexing alone; only attach the TTL config.
  index_config {}

  depends_on = [google_firestore_database.sessions]
}

# Single-field index on `state` so /cli/complete can look a session up by state.
# (Single-field equality is auto-indexed by default; declared explicitly so the
#  query contract is visible and survives any exemption changes.)
resource "google_firestore_field" "cli_sessions_state" {
  project    = var.project_id
  database   = var.firestore_database_id
  collection = var.cli_sessions_collection
  field      = "state"

  index_config {
    indexes {
      order       = "ASCENDING"
      query_scope = "COLLECTION"
    }
  }

  depends_on = [google_firestore_database.sessions]
}

# IAM — the function's runtime service account needs datastore access to read /
# write CLI session docs. The auth-proxy Cloud Function runs as the project's
# compute default service account (same SA the pristine module notes is granted
# secretmanager.secretAccessor manually).
data "google_project" "this" {
  project_id = var.project_id
}

resource "google_project_iam_member" "runtime_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com"
}
