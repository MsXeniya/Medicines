import { test, expect, Page, Route } from '@playwright/test';

test('Сценарий входа (стабы по умолчанию, реальный бэкенд при конфигурации)', async ({ page }: { page: Page }) => {
  const useReal = process.env.PLAYWRIGHT_USE_REAL_BACKEND === 'true';

  if (!useReal) {
    // Заглушка endpoint-а логина для возврата токенов и профиля в детерминированных тестах
    await page.route('**/api/auth/login', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'atk', refreshToken: 'rtk', role: 'user', permissions: ['medicines:read'] }),
      });
    });

    await page.route('**/api/auth/profile', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 2, username: 'e2euser', role: 'user', permissions: ['medicines:read'] } }),
      });
    });
  }

  await page.goto('/login');
  await page.fill('#username', 'e2euser');
  await page.fill('#password', 'pwd');
  await page.click('button:has-text("Войти")');

  // После входа в навбаре должен отобразиться пользователь (вспомогательный селектор по классу)
  await expect(page.locator('.navbar-user')).toBeVisible();
});
