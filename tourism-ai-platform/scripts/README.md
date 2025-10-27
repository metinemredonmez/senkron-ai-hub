# 🧬 Scripts — Health Tourism AI Platform (v2)

Tüm kurulum, yedekleme, migration ve environment işlemlerini yöneten **bash script koleksiyonu**.

---

## 🚀 Ana Scriptler

| Script                       | Açıklama                                                            |
| ---------------------------- | ------------------------------------------------------------------- |
| `_lib.sh`                    | Ortak yardımcı fonksiyonlar (renkli log, health-check, env yükleme) |
| `prestart.sh`                | Ortam ve bağlantı kontrolleri (DB, Redis, Qdrant)                   |
| `setup-local.sh`             | Local ortam kurulumunu otomatik yapar (env, docker, migrate)        |
| `migrate-db.sh`              | PostgreSQL migration’larını çalıştırır                              |
| `seed-db.sh`                 | Gerçek domain verisiyle veritabanını doldurur                       |
| `backup.sh`                  | PostgreSQL + MinIO yedeği alır                                      |
| `restore.sh`                 | Yedekten geri yükler                                                |
| `sync-envs.sh`               | Root `.env.local`’ı tüm servislere senkronlar                       |
| `start-dev.sh` *(opsiyonel)* | Backend’i lokal modda (Docker’sız) başlatır                         |

---

## 🔧 Kullanım Örnekleri

### 1️⃣ Ortam kurulumu

```bash
./scripts/setup-local.sh
```

* `.env.local` dosyalarını oluşturur veya kopyalar
* Docker servislerini (postgres, redis, kafka, minio, prometheus, grafana, loki, tempo) ayağa kaldırır
* Health-check’leri bekler
* `migrate-db.sh`’yi otomatik çağırır

---

### 2️⃣ Migration çalıştırma

```bash
./scripts/migrate-db.sh
```

* Backend `dist` yoksa build eder
* TypeORM migration’larını veritabanına uygular

---

### 3️⃣ Domain seed verisi ekleme

```bash
./scripts/seed-db.sh
```

* Domain için örnek sağlayıcı, kullanıcı ve paket verisi ekler

---

### 4️⃣ Backup alma

```bash
./scripts/backup.sh
```

* PostgreSQL dump oluşturur
* MinIO `/data` klasörünü kopyalar
* Tek `.tar.gz` dosyasına sıkıştırır

---

### 5️⃣ Restore (yedekten dönme)

```bash
./scripts/restore.sh backups/backup_20251015_123000.tar.gz
```

* `.tar.gz` veya `.sql` dosyasından geri yükleme yapar

---

### 6️⃣ Ortam değişkenlerini senkronize etme

```bash
./scripts/sync-envs.sh
```

* Root `.env.local` dosyasını backend, frontend ve tüm AI servislerine kopyalar

---

### 7️⃣ Lokal geliştirme başlatma *(opsiyonel)*

```bash
./scripts/start-dev.sh
```

* Backend’i Docker dışı modda başlatır
* `/api/health` yanıtını bekler

---

## 🧠 İpuçları

* Script’ler **idempotent** → birden fazla kez güvenle çalıştırılabilir.
* Her biri `_lib.sh` kullanır → renkli log, hata yönetimi, health-check fonksiyonları içerir.
* `set -Eeuo pipefail` → komut hatasında otomatik çıkış sağlar.
* `.env.local` ve container adları `.env` üzerinden özelleştirilebilir.

---

## 🧬 Ekstra Bilgi

### `_lib.sh` – Ortak Yardımcılar

Tüm script’lerin çağırdığı yardımcı kütüphane.

* **Env yükleme:** `.env.local` otomatik okunur.
* **Renkli log:** `log`, `ok`, `warn`, `err` fonksiyonları.
* **Health helpers:**

  * `wait_container <name>` → Docker health kontrolü.
  * `wait_http <url>` → HTTP endpoint kontrolü.
* **Port test:** Python tabanlı socket kontrolü.

---

### Önerilen Çalışma Sırası

```bash
# 1. Kurulum
./scripts/setup-local.sh

# 2. Migration
./scripts/migrate-db.sh

# 3. Seed
./scripts/seed-db.sh

# 4. Backup / Restore
./scripts/backup.sh
./scripts/restore.sh backups/backup_*.tar.gz

# 5. Environment Sync
./scripts/sync-envs.sh
```

---

### ✅ Sağlanan Özellikler

* **Tam otomasyon:** Docker + Node + Python servisleri birlikte test edilir.
* **Güvenli çalıştırma:** Komut hataları anında yakalanır.
* **CI/CD uyumlu:** Script’ler pipeline’da da çalışabilir.
* **Taşınabilir:** macOS + Linux destekli (brew, apt uyumlu).

---

> 📘 **Not:**
> Script’ler `scripts/` klasörü altına kaydedilmeli ve çalıştırılmadan önce yürütme izni verilmelidir:
>
> ```bash
> chmod +x scripts/*.sh
> ```
>
> Ardından `./scripts/setup-local.sh` ile tüm sistemi tek adımda kurabilirsiniz.
