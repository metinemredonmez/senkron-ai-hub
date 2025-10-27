variable "project_name" {
  description = "Name prefix for resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for workloads"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for ingress/gateways"
  type        = list(string)
}

variable "eks_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.29"
}

variable "db_subnet_group_name" {
  description = "Optional reuse of existing DB subnet group"
  type        = string
  default     = null
}

variable "db_instance_class" {
  description = "Instance class for Postgres"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "Storage (GB) for Postgres"
  type        = number
  default     = 100
}

variable "redis_node_type" {
  description = "Node type for Elasticache Redis"
  type        = string
  default     = "cache.t4g.small"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 2
}

variable "minio_bucket_name" {
  description = "S3 bucket backing MinIO compatible storage"
  type        = string
  default     = null
}

variable "enable_grafana_workspace" {
  description = "Create an Amazon Managed Grafana workspace"
  type        = bool
  default     = false
}
