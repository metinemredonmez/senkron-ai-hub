# 🧰 Tools Directory — Health Tourism AI Platform (Version 2.0)

Bu klasör, sistem bakım ve test görevlerini kolaylaştırmak için hazırlanmış yardımcı araçları içerir.

## 🔧 Scripts

| Script | Açıklama |
|--------|-----------|
| `db-seed.ts` | PostgreSQL’e sağlık turizmi odaklı test verisi ekler |
| `clear-cache.ts` | Redis & Qdrant cache’lerini temizler |
| `check-health.ts` | Tüm servislerin `/health` endpoint’lerini kontrol eder |
| `docker-cleanup.sh` | Eski Docker container, image ve volume’leri güvenle temizler |

## 🧭 Kullanım

```bash
# PostgreSQL'e başlangıç verilerini yükle
yarn ts-node tools/db-seed.ts

# Cache veritabanlarını temizle
yarn ts-node tools/clear-cache.ts

# Servis sağlık durumlarını kontrol et
yarn ts-node tools/check-health.ts

# Docker ortamını temizle
chmod +x tools/docker-cleanup.sh
./tools/docker-cleanup.sh