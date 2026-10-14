import { test, expect } from '@playwright/test';

// IIIF Authorization Flow 2.0: モックサーバ（scripts/auth-mock-server.mjs, ポート 3839）で、
// 案内 → ログイン窓 → 画像の読み直し → ログアウトを通して確かめる。
// 灰色の画像（未ログイン）と色付きの画像（ログイン後）は、応答の X-Auth-Image ヘッダで見分ける。

const MOCK = 'http://localhost:3839';

test('active login: prompt, popup login, full image, logout', async ({ page, context }) => {
  const kinds: string[] = [];
  page.on('response', (r) => {
    const k = r.headers()['x-auth-image'];
    if (k && r.url().includes('/iiif/img/')) kinds.push(k);
  });

  await page.goto(`/ja/viewer/?iiif-content=${encodeURIComponent(`${MOCK}/manifest.json`)}`);

  const prompt = page.locator('[data-auth-panel="prompt"]');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Please log in');
  // the degraded image is drawn under the prompt
  await expect.poll(() => kinds.includes('degraded')).toBe(true);
  expect(kinds).not.toContain('full');
  // blurred until the user logs in
  await expect(page.locator('[data-auth-blurred]').first()).toBeVisible();

  const popupPromise = context.waitForEvent('page');
  await prompt.getByRole('button', { name: 'Log in' }).click();
  const popup = await popupPromise;
  expect(popup.url()).toContain(`${MOCK}/login?origin=`);
  await popup.locator('#login').click();

  await expect(prompt).toBeHidden();
  await expect.poll(() => kinds.includes('full')).toBe(true);
  await expect(page.locator('[data-auth-blurred]')).toHaveCount(0);

  // logout: the link opens the logout window; afterwards the prompt comes back
  const out = page.locator('[data-auth-action="logout"]');
  await expect(out).toBeVisible();
  const logoutPopup = context.waitForEvent('page');
  await out.click();
  await logoutPopup;
  await expect(page.locator('[data-auth-panel="prompt"]')).toBeVisible();
});

test('already logged in: no prompt, the full image at once', async ({ page }) => {
  const kinds: string[] = [];
  page.on('response', (r) => {
    const k = r.headers()['x-auth-image'];
    if (k && r.url().includes('/iiif/img/')) kinds.push(k);
  });

  // the session cookie of an earlier visit
  await page.goto(`${MOCK}/login-do`);
  await page.goto(`/ja/viewer/?iiif-content=${encodeURIComponent(`${MOCK}/manifest.json`)}`);

  await expect.poll(() => kinds.includes('full')).toBe(true);
  await expect(page.locator('[data-auth-panel="prompt"]')).toHaveCount(0);
  await expect(page.locator('[data-auth-action="logout"]')).toBeVisible();
});
