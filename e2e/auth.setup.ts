import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import { ROLES, EXTRA_ACCOUNTS, PASSWORD, storageStateFor } from './helpers';

const accounts: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.login])),
  ...Object.fromEntries(Object.entries(EXTRA_ACCOUNTS).map(([k, v]) => [k, v.login])),
};

setup.beforeAll(() => {
  fs.mkdirSync('e2e/.auth', { recursive: true });
});

for (const [key, login] of Object.entries(accounts)) {
  setup(`authenticate ${key} (${login})`, async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Введите логин').fill(login);
    await page.getByPlaceholder('Введите пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Войти' }).click();

    // signIn() sets the session-token cookie on success. Wait for that directly,
    // independent of the client-side redirect to /dashboard (which can be slow to
    // compile on first hit and is irrelevant to capturing auth state).
    await expect
      .poll(
        async () => {
          const cookies = await page.context().cookies();
          return cookies.some((c) => /(?:next-auth|authjs)\.session-token/.test(c.name));
        },
        { timeout: 30_000, message: `${login}: session-token cookie should appear after login` },
      )
      .toBeTruthy();

    await page.context().storageState({ path: storageStateFor(key) });
  });
}
