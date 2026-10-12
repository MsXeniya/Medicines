Playwright E2E тесты для приложения Medicines

## Требования:
- Node.js 18+ и npm
- Фронтенд на http://localhost:3000
- (Опционально) Бэкенд на http://localhost:8000

## Установка:

```bash
cd client-react
npm install -D @playwright/test
npx playwright install
```

## Запуск тестов (режим со стабами - фронтенд только):

1. Запустить фронтенд (в отдельном терминале):
```bash
cd client-react
npm start
```

2. Запустить E2E тесты (в другом терминале):
```bash
npm run test:e2e
```

По умолчанию тесты подменяют (stub) API-запросы, поэтому бэкенд не требуется.

## Запуск против реального бэкенда (ВНИМАНИЕ — может изменять данные):

1. Резервная копия данных:
```powershell
cd server-fastapi\server\data
copy users.json users.json.bak
copy medicines.json medicines.json.bak
```

2. Запустить бэкенд (в отдельном терминале):
```powershell
cd server-fastapi
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

3. Запустить фронтенд (в ещё одном терминале):
```bash
cd client-react
npm start
```

4. Запустить E2E тесты с реальным бэкендом (в четвёртом терминале):
```bash
cd client-react
$env:PLAYWRIGHT_USE_REAL_BACKEND='true'
npm run test:e2e
```

## Примечания:

- **Тесты со стабами (по умолчанию)**: Быстро, не требует бэкенда, для разработки
- **Тесты с реальным бэкендом**: Интеграционное тестирование, можно изменять данные
- Используйте session переменные (`$env:VAR='value'`) для временных изменений в PowerShell
- Если нужна полная изоляция, используйте `SERVER_USERS_PATH` и `SERVER_MEDICINES_PATH` для копий данных
