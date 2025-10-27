# 🧩 Shared Module — Health Tourism AI Platform

Tüm servisler (backend, frontend, AI, mobile) arasında paylaşılan ortak modül.

## 📦 Alt Modüller

| Klasör | Amaç |
|--------|------|
| `constants/` | Uygulama genelinde sabitler (APP_NAME, feature flags vb.) |
| `types/` | Ortak tip tanımları (API, kullanıcı, rezervasyon) |
| `utils/` | Yardımcı fonksiyonlar (tarih, formatlama, hesaplama) |

## 🔧 Kullanım
```ts
import { APP_CONSTANTS } from "@shared/constants/app-constants";
import { ApiResponse } from "@shared/types/api.types";
import { formatDate } from "@shared/utils/date-utils";