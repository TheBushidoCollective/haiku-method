terraform {
  required_version = ">= 1.0"

  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Terraform Cloud for remote state and VCS-triggered runs
  cloud {
    organization = "bushido-collective"

    workspaces {
      name = "haiku-web"
    }
  }
}

provider "railway" {
  # Token is read from RAILWAY_TOKEN environment variable
  # Get a token from: https://railway.app/account/tokens
}
