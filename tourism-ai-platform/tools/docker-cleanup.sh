#!/bin/bash
# Health Tourism AI Platform — Docker Cleanup Script

echo "🧹 Cleaning up Docker resources..."
echo "This will remove all stopped containers, dangling images, and unused volumes/networks."
read -p "Continue? (y/n): " confirm

if [[ $confirm == "y" || $confirm == "Y" ]]; then
  docker container prune -f
  docker image prune -a -f
  docker volume prune -f
  docker network prune -f
  echo "✅ Docker cleanup completed successfully."
else
  echo "❎ Cleanup aborted."
fi