resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.name}-vpc"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name = "${var.name}-igw"
  }
}

locals {
  availability_zones = length(var.azs) > 0 ? var.azs : slice(data.aws_availability_zones.available.names, 0, length(var.public_subnet_cidrs))
}

data "aws_availability_zones" "available" {}

resource "aws_subnet" "public" {
  for_each                = { for idx, cidr in var.public_subnet_cidrs : idx => cidr }
  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  map_public_ip_on_launch = true
  availability_zone       = local.availability_zones[tonumber(each.key)]
  tags = {
    Name = "${var.name}-public-${each.key}"
  }
}

resource "aws_subnet" "private" {
  for_each          = { for idx, cidr in var.private_subnet_cidrs : idx => cidr }
  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = local.availability_zones[tonumber(each.key) % length(local.availability_zones)]
  tags = {
    Name = "${var.name}-private-${each.key}"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name = "${var.name}-public"
  }
}

resource "aws_route" "public_igw" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  for_each = aws_subnet.public
  domain   = "vpc"
  tags = {
    Name = "${var.name}-nat-${each.key}"
  }
}

resource "aws_nat_gateway" "this" {
  for_each          = aws_subnet.public
  allocation_id     = aws_eip.nat[each.key].id
  subnet_id         = each.value.id
  connectivity_type = "public"
  tags = {
    Name = "${var.name}-nat-${each.key}"
  }
}

locals {
  nat_key_by_az = { for key, subnet in aws_subnet.public : subnet.availability_zone => key }
}

resource "aws_route_table" "private" {
  for_each = aws_nat_gateway.this
  vpc_id   = aws_vpc.this.id
  tags = {
    Name = "${var.name}-private-${each.key}"
  }
}

resource "aws_route" "private_nat" {
  for_each               = aws_route_table.private
  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[each.key].id
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[local.nat_key_by_az[each.value.availability_zone]].id
}
