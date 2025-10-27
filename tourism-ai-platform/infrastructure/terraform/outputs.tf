output "eks_cluster_name" {
  value       = module.platform.cluster_name
  description = "Name of the EKS cluster hosting the Health Tourism AI Platform"
}

output "eks_cluster_endpoint" {
  value       = module.platform.cluster_endpoint
  description = "EKS API server endpoint"
}

output "postgres_secret_arn" {
  value       = module.platform.db_secret_arn
  description = "AWS Secrets Manager ARN containing Postgres credentials"
}

output "redis_secret_arn" {
  value       = module.platform.redis_secret_arn
  description = "AWS Secrets Manager ARN containing Redis auth token and endpoints"
}

output "object_store_bucket" {
  value       = module.platform.object_store_bucket
  description = "S3 bucket used for MinIO-compatible object storage"
}

output "grafana_workspace_id" {
  value       = module.platform.grafana_workspace_id
  description = "Managed Grafana workspace ID (if created)"
}
