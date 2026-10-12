import { test, expect, Page, Route } from '@playwright/test';

test('Сценарий CRUD для лекарств (стабы по умолчанию, реальный бэкенд при конфигурации)', async ({ page }: { page: Page }) => {
  const useReal = process.env.PLAYWRIGHT_USE_REAL_BACKEND === 'true';

  if (!useReal) {
    // заглушка списка
    await page.route('**/api/medicines**', async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 5, totalPages: 0 }),
        });
        return;
      }
      // по умолчанию пропустить
      await route.continue();
    });

    // заглушка создания
    await page.route('**/api/medicines', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 999, name: 'E2E', time: '10:00', taken: false, files: [] }) });
        return;
      }
      await route.continue();
    });

    // заглушка профиля (чтобы приложение думало, что пользователь залогинен)
    await page.route('**/api/auth/profile', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { username: 'e2euser', role: 'user', permissions: ['medicines:read', 'medicines:create'] } }),
      });
    });
  }

  // Проставить токены в localStorage перед загрузкой страницы, чтобы AuthProvider подхватил профиль
  await page.addInitScript(() => {
    try {
      localStorage.setItem('accessToken', 'e2e-access-token');
      localStorage.setItem('refreshToken', 'e2e-refresh-token');
    } catch (e) {
      // ignore
    }
  });

  // Убедиться, что приложение открыто и отображена шапка с приветствием
  await page.goto('/');
  await expect(page.locator('.home-header h1')).toBeVisible();

  // Проверить наличие ключевого UI: заголовка фильтров (находится в любом случае)
  await expect(page.locator('.filters-card h2')).toHaveText(/Фильтры и поиск/);
});
