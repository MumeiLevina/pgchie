const { test, expect } = require('@playwright/test');
test.use({ baseURL: 'http://127.0.0.1:8002' });
async function login(page) {
  await page.goto('/admin/'); await expect(page).toHaveURL(/\/login/);
  await page.locator('#email').fill('fixture@example.test'); await page.locator('#password').fill('TEST-FIXTURE-PASSWORD-ONLY');
  await page.locator('#loginButton').click(); await expect(page).toHaveURL(/\/admin\//);
  await expect(page.locator('#messageList')).toHaveAttribute('aria-busy', 'false');
}
test('private mailbox: real backend auth, setup state, XSS, metadata, filters, confirmation and logout (test fixtures)', async ({ page }) => {
  await login(page);
  await expect(page.locator('#sync')).toBeDisabled(); await expect(page.locator('#integrationTitle')).toContainText('Cần kết nối');
  await page.locator('#search').fill('<img'); await expect(page.locator('.message-row')).toHaveCount(1);
  await page.locator('.message-row').click(); await expect(page.locator('#detail .letter-content')).toContainText('<img');
  await expect(page.locator('#detail img')).toHaveCount(0); expect(await page.evaluate(() => window.xss)).toBeUndefined();
  await expect(page.locator('#readMessage')).toHaveText('Đánh dấu chưa đọc');
  await page.locator('#favoriteMessage').click(); await expect(page.locator('#favoriteMessage')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-view="favorites"]').click(); await expect(page.locator('.message-row')).toHaveCount(1);
  await page.locator('.message-row').click(); await page.locator('#archiveMessage').click(); await expect(page.locator('#archiveMessage')).toHaveText('Bỏ lưu trữ');
  await page.locator('[data-view="archived"]').click(); await expect(page.locator('.message-row')).toHaveCount(1);
  await page.locator('.message-row').click(); await page.locator('#deleteMessage').click(); await expect(page.locator('#deleteDialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#deleteDialog')).toBeHidden(); await expect(page.locator('.message-row')).toHaveCount(1);
  await page.locator('#deleteMessage').click(); await page.locator('#confirmDelete').click(); await expect(page.locator('#messageList')).toContainText('Hộp thư đang yên tĩnh');
  await expect(page.locator('#notice')).toContainText('Thư gốc vẫn ở Formspree');
  await page.locator('#logout').click(); await expect(page).toHaveURL(/\/login/); await page.goto('/admin/'); await expect(page).toHaveURL(/\/login/);
});
test('search, pagination, sorting, no results, backend failure and retry (test fixtures)', async ({ page }) => {
  await login(page); await page.locator('[data-view="inbox"]').click();
  await expect(page.locator('.message-row')).toHaveCount(20); await page.locator('#next').click(); await expect(page.locator('#pageLabel')).toContainText('Trang 2');
  await page.locator('#sort').selectOption('oldest'); await expect(page.locator('#pageLabel')).toContainText('Trang 1');
  await page.locator('#search').fill('nothing matches this query'); await expect(page.locator('#messageList')).toContainText('Chưa tìm thấy');
  await page.route('**/api/messages?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"backend_unavailable"}' }));
  await page.locator('#search').fill('test'); await expect(page.locator('#messageList')).toContainText('Chưa mở được');
  await page.unroute('**/api/messages?**'); await page.getByRole('button', { name: 'Thử lại' }).click(); await expect(page.locator('.message-row').first()).toBeVisible();
  await page.route('**/api/messages?**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"authentication_required"}' }));
  await page.locator('#search').fill('session expired'); await expect(page).toHaveURL(/\/login\?expired=1/); await expect(page.locator('#loginStatus')).toContainText('hết hạn');
});
for (const width of [375, 768, 1440]) test(`admin ${width}px: responsive, keyboard, reduced motion and screenshots (test fixtures)`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login'); await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true });
  await login(page); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-view="settings"]').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#settings')).toBeVisible();
  await page.locator('[data-view="overview"]').click(); await expect(page.locator('.message-row').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`mailbox-${width}.png`), fullPage: true });
});
