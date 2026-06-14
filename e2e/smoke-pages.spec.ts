import { test, expect } from '@playwright/test';
import { storageStateFor } from './helpers';

/**
 * Smoke-тест новых / workspace-страниц: каждая должна реально открыться
 * (роут зарезолвился, RoleGate пропустил, контент отрисовался без краша).
 *
 * access-matrix.spec проверяет ТОЛЬКО видимость ссылок в меню; здесь —
 * что сама страница монтируется. Идём под super_admin: он авторизован
 * на всех перечисленных роутах (см. nav-config / RoleGate).
 */
const PAGES: { href: string; heading: RegExp }[] = [
  { href: '/group-transfers', heading: /Переводы между группами/i },
  { href: '/import-export', heading: /Импорт/i },
  { href: '/documents', heading: /Документы/i },
  { href: '/staff', heading: /Персонал/i },
  { href: '/hr', heading: /Кадры|HR/i },
  { href: '/olympiads', heading: /Олимпиад/i },
  { href: '/incidents', heading: /Происшеств/i },
  { href: '/urgent-issues', heading: /Срочные/i },
  { href: '/finance', heading: /Финанс/i },
  { href: '/call-center', heading: /Колл-центр/i },
  { href: '/workspace/accounting', heading: /Счет|оплат/i },
  { href: '/workspace/kitchen', heading: /Кухн|Столов|Питани/i },
  { href: '/workspace/maintenance', heading: /АХЧ|Хозяй|обслужив/i },
  { href: '/workspace/medical', heading: /Мед/i },
  { href: '/workspace/speech', heading: /Логопед/i },
  { href: '/workspace/parents', heading: /Родител/i },
];

test.describe('smoke: new & workspace pages render', () => {
  test.use({ storageState: storageStateFor('super_admin') });

  for (const { href, heading } of PAGES) {
    test(`${href} mounts for super_admin`, async ({ page }) => {
      await page.goto(href);

      // app shell отрисовался → роут зарезолвился, не белый экран
      await expect(page.locator('[class*="AppShell-navbar"]')).toBeVisible({ timeout: 30_000 });

      // RoleGate пропустил
      await expect(page.getByText('Доступ ограничен')).toHaveCount(0);

      // контент страницы появился (заголовок), а не пустой каркас / краш
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});
