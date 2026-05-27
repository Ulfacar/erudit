import { test, expect } from '@playwright/test';
import { ROLES, storageStateFor, expectedSidebarHrefs, allSidebarHrefs } from './helpers';

/**
 * Verifies the role -> navigation contract (nav-config.ts) actually renders per role,
 * and that the one hard-gated page (RoleGate on /grading/moderation) enforces access.
 */
for (const [key, { role }] of Object.entries(ROLES)) {
  test.describe(`[${key}] navigation access`, () => {
    test.use({ storageState: storageStateFor(key) });

    test('sidebar shows exactly the allowed top-level links', async ({ page }) => {
      await page.goto('/calendar'); // allowed for every authenticated role
      const navbar = page.locator('[class*="AppShell-navbar"]');
      await expect(navbar).toBeVisible({ timeout: 30_000 });

      const expected = expectedSidebarHrefs(role);
      const forbidden = allSidebarHrefs().filter((h) => !expected.includes(h));

      for (const href of expected) {
        await expect(
          navbar.locator(`a[href="${href}"]`).first(),
          `${key}: expected sidebar link ${href} to be visible`,
        ).toBeVisible();
      }
      for (const href of forbidden) {
        await expect(
          navbar.locator(`a[href="${href}"]`),
          `${key}: forbidden sidebar link ${href} must be hidden`,
        ).toHaveCount(0);
      }
    });

    test('moderation page is hard-gated by RoleGate', async ({ page }) => {
      await page.goto('/grading/moderation');
      const denied = page.getByText('Доступ ограничен');
      if (['super_admin', 'analyst', 'zavuch'].includes(role)) {
        await expect(denied).toHaveCount(0);
      } else {
        await expect(denied).toBeVisible();
      }
    });
  });
}
