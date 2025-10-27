output "vpc_id" {
  value       = aws_vpc.this.id
  description = "ID of the provisioned VPC"
}

output "public_subnet_ids" {
  value       = [for s in aws_subnet.public : s.id]
  description = "Public subnet IDs"
}

output "private_subnet_ids" {
  value       = [for s in aws_subnet.private : s.id]
  description = "Private subnet IDs"
}

output "azs" {
  value       = local.availability_zones
  description = "Availability zones used by the VPC"
}
