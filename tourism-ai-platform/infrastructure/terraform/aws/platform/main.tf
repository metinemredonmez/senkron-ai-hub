locals {
  name_prefix = var.project_name
  db_username = "ai_user"
  db_name     = "health_tourism"
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = "${local.name_prefix}-eks"
  cluster_version = var.eks_version
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  enable_irsa = true

  eks_managed_node_groups = {
    default = {
      instance_types = ["t3a.large"]
      min_size       = 2
      max_size       = 6
      desired_size   = 3
      subnet_ids     = var.private_subnet_ids
      tags = {
        Name = "${local.name_prefix}-nodes"
      }
    }
  }

  tags = {
    Environment = "prod"
    Project     = local.name_prefix
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Postgres access from EKS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id, module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${local.name_prefix}-rds-sg"
    Project = local.name_prefix
  }
}

resource "aws_db_subnet_group" "this" {
  count = var.db_subnet_group_name == null ? 1 : 0

  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name    = "${local.name_prefix}-db-subnets"
    Project = local.name_prefix
  }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-postgres"
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_allocated_storage * 2
  db_name                 = local.db_name
  username                = local.db_username
  password                = random_password.db_password.result
  skip_final_snapshot     = true
  deletion_protection     = false
  publicly_accessible     = false
  backup_retention_period = 7
  storage_encrypted       = true
  storage_type            = "gp3"
  auto_minor_version_upgrade = true

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = coalesce(var.db_subnet_group_name, aws_db_subnet_group.this[0].name)

  tags = {
    Name    = "${local.name_prefix}-postgres"
    Project = local.name_prefix
  }
}

resource "random_password" "db_password" {
  length  = 20
  special = true
}

resource "aws_secretsmanager_secret" "db" {
  name = "${local.name_prefix}/database"
  tags = {
    Project = local.name_prefix
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = local.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    database = local.db_name
  })
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Redis access from EKS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id, module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${local.name_prefix}-redis"
  replication_group_description = "Redis for ${local.name_prefix} platform"
  node_type                     = var.redis_node_type
  number_cache_clusters         = var.redis_num_cache_nodes
  automatic_failover_enabled    = true
  transit_encryption_enabled    = true
  at_rest_encryption_enabled    = true
  security_group_ids            = [aws_security_group.redis.id]
  subnet_group_name             = aws_elasticache_subnet_group.redis.name
  engine_version                = "7.0"
  port                          = 6379
  auth_token                    = random_password.redis_token.result
}

resource "random_password" "redis_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis" {
  name = "${local.name_prefix}/redis"
  tags = {
    Project = local.name_prefix
  }
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    auth_token = random_password.redis_token.result
    primary_endpoint = aws_elasticache_replication_group.redis.primary_endpoint_address
    reader_endpoint  = aws_elasticache_replication_group.redis.reader_endpoint_address
  })
}

resource "random_id" "bucket_suffix" {
  count      = var.minio_bucket_name == null ? 1 : 0
  byte_length = 4
}

resource "aws_s3_bucket" "objectstore" {
  count = var.minio_bucket_name == null ? 1 : 0

  bucket = var.minio_bucket_name == null ? format("%s-artifacts-%s", local.name_prefix, random_id.bucket_suffix[0].hex) : var.minio_bucket_name
  force_destroy = true
  tags = {
    Project = local.name_prefix
  }
}

resource "aws_s3_bucket_public_access_block" "objectstore" {
  count  = length(aws_s3_bucket.objectstore) == 0 ? 0 : 1
  bucket = aws_s3_bucket.objectstore[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_grafana_workspace" "this" {
  count = var.enable_grafana_workspace ? 1 : 0

  name          = "${local.name_prefix}-grafana"
  account_access_type = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"]
  permission_type         = "SERVICE_MANAGED"
}

output "cluster_name" {
  value       = module.eks.cluster_name
  description = "Name of the EKS cluster"
}

output "cluster_endpoint" {
  value       = module.eks.cluster_endpoint
  description = "EKS API server endpoint"
}

output "cluster_ca_certificate" {
  value       = module.eks.cluster_certificate_authority_data
  description = "EKS cluster CA data"
}

output "node_security_group_id" {
  value       = module.eks.node_security_group_id
  description = "Security group attached to worker nodes"
}

output "db_secret_arn" {
  value       = aws_secretsmanager_secret.db.arn
  description = "Secrets Manager ARN for Postgres credentials"
}

output "redis_secret_arn" {
  value       = aws_secretsmanager_secret.redis.arn
  description = "Secrets Manager ARN for Redis credentials"
}

output "object_store_bucket" {
  value       = var.minio_bucket_name == null ? aws_s3_bucket.objectstore[0].bucket : var.minio_bucket_name
  description = "S3 bucket backing MinIO-compatible storage"
}

output "grafana_workspace_id" {
  value       = var.enable_grafana_workspace ? aws_grafana_workspace.this[0].id : null
  description = "Managed Grafana workspace ID"
}
