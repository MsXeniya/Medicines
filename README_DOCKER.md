###Сетевая схема взаимодействия

- **Единая сеть:** `medicines-network`
- **Изоляция:** контейнеры доступны только из сети
- **Обращение:** по имени сервиса (docker-compose DNS)

```
nginx → frontend:3000
nginx → backend:5000 (Express)
nginx → fastapi:8000 (FastAPI)
fastapi → minio:9000 (S3 Storage)
```

###Порядок запуска

1. **MinIO** - запускается первым
2. **FastAPI** - ждет Min
3. **Express** - независимый сервис
4. **React** - ждет бэкенд
5. **Nginx** - ждет все сервисы


### Доступ к приложению

После запуска приложение доступно по адресам:

| **Frontend** | http://localhost/ | React приложение |
| **API** | http://localhost/api | Express Backend |
| **FastAPI Docs** | http://localhost/docs | Swagger документация |
| **MinIO** | http://localhost:9001 | S3 консоль управления |

---

## Компоненты

### Nginx (Reverse Proxy)

**Функции:**
- Принимает все входящие запросы на port 80
- Маршрутизирует трафик:
  - `/` → React Frontend
  - `/api/*` → Express Backend
  - `/api/v1/*` → FastAPI Backend (альтернативный путь)
  - `/docs` → FastAPI Документация
- Проксирует WebSocket соединения
- Устанавливает X-Forwarded headers для корректной аутентификации

**Health Check:** `GET http://localhost/` → 200 OK

### React Frontend

**Файлы:** `client-react/Dockerfile`, `client-react/.dockerignore`

**Особенности:**
- **Двухэтапная сборка:**
  1. **Builder Stage:** Компилирует React приложение (`npm run build`)
  2. **Production Stage:** Подает статику через `serve`
- **Размер:** ~300MB (после оптимизации)
- **Port:** 3000
- **Health Check:** каждые 30 сек

**Переменные окружения:**
```env
REACT_APP_API_BASE_URL=http://localhost/api
```

### FastAPI Backend

**Файлы:** `server-fastapi/Dockerfile`, `server-fastapi/.dockerignore`

**Особенности:**
- **Python:** 3.11-slim (минимальный образ)
- **Двухэтапная сборка:**
  1. **Builder Stage:** Установка Python зависимостей
  2. **Production Stage:** Запуск приложения
- **Port:** 8000
- **Особенности:** 
  - Поддержка JWT авторизации
  - Интеграция с MinIO (S3)
  - Auto-reload документация на `/docs`

**Зависимости:**
- fastapi
- uvicorn
- python-jose
- pydantic
- boto3 (S3 клиент)

### Express Backend

**Файлы:** `server/Dockerfile`, `server/.dockerignore`

**Особенности:**
- **Node.js:** 20-alpine
- **Production сборка:** только production зависимости
- **Port:** 5000
- **Данные:** сохраняются в volume `/app/data`
- **Маршруты:**
  - `POST /api/auth/login` - Авторизация
  - `POST /api/auth/register` - Регистрация
  - `GET /api/medicines` - Список лекарств
  - `POST /api/medicines` - Добавить лекарство


### MinIO (S3 Storage)

**Образ:** `minio/minio:latest`

**Особенности:**
- S3-совместимое хранилище
- Веб-консоль управления на port 9001
- Персистентное хранилище в volume `minio-data`
- Автоматическая инициализация при первом запуске

**Порты:**
- 9000 - API
- 9001 - Консоль управления

### Управление сервисами

```bash
# Запуск всех сервисов
docker-compose up -d

# Пересборка конкретного сервиса
docker-compose build fastapi

# Пересборка без кэша
docker-compose build --no-cache
```

### Логирование

```bash
# Просмотр всех логов
docker-compose logs

# Просмотр логов в real-time
docker-compose logs -f

# Последние 50 строк
docker-compose logs --tail=50 fastapi

# Логи с фильтром по времени
docker-compose logs --since 10m fastapi
```

### Взаимодействие с контейнерами

```bash
# Открыть shell в контейнере
docker-compose exec fastapi /bin/bash
docker-compose exec frontend /bin/sh
docker-compose exec backend /bin/sh

docker-compose exec fastapi python -c "print('Hello')"
docker-compose exec -T fastapi python -m pytest tests/

# просмотр процессов
docker-compose exec fastapi ps aux
```

### Проверка статуса

```bash

docker-compose ps

# health status подробно
docker-compose ps --format table

# проверка доступности
docker-compose exec -T nginx wget -q -O- http://localhost/
docker-compose exec -T nginx wget -q -O- http://fastapi:8000/docs
```

### Тестирование

```bash
# Запуск тестов FastAPI
docker-compose exec -T fastapi python -m pytest tests/ -v

# Запуск с покрытием
docker-compose exec -T fastapi python -m pytest tests/ --cov

# Запуск теста
docker-compose exec -T fastapi python -m pytest tests/test_auth.py -v
```

### Перезагрузка

```bash
# Перезагрузить все сервисы
docker-compose restart

# Перезагрузить конкретный сервис
docker-compose restart fastapi

# Пересоздать контейнер (при изменении конфига)
docker-compose up -d --force-recreate fastapi
```

---

### GitHub Actions

**Файл:** `.github/workflows/ci-cd.yml`

**Этапы pipeline:**

1. **Tests** - Запуск всех тестов
   - FastAPI тесты (pytest)
   - React тесты (jest)

2. **Build** - Сборка Docker образов для каждого сервиса

3. **Integration Tests** - Проверка через docker-compose
   - Запуск всех сервисов
   - Health checks
   - Проверка API endpoints

4. **Deploy** - Развертывание на production (только для main branch)


---

## Health Checks

```bash
# 1. логи
docker-compose logs fastapi
```

### Здоровье сервисов

```bash
# Frontend
curl http://localhost/ | head -20

# Express API
curl http://localhost/api/medicines | jq .

# FastAPI
curl http://localhost/docs | head -20

# MinIO
curl http://localhost:9000/minio/health/live
```
