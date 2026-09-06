import { expect, test } from '@playwright/test';

/**
 * M0 e2e smoke (blueprint §94): landing → app → studio → real game boots →
 * read-only bridge responds → input changes state.
 */

/** Shape of the read-only WELD bridge installed on window.__WELD__. */
interface WeldBridge {
  getGameStatus(): string;
  getPlayerState(): { x: number; y: number; alive: boolean };
  getGameState(): {
    status: string;
    score: number;
    objectives: { target: number };
  };
}

type WeldWindow = Window & { __WELD__?: WeldBridge };

test.describe('WELD M0 smoke', () => {
  test('landing page loads with the core promise and a working demo embed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tell us what');
    await expect(page.getByText(/Describe it\. Build it\. Break it\. Ship it\./i).first()).toBeVisible();

    // The playable demo iframe is present and loads.
    const frame = page.frameLocator('iframe[title*="Scrap Sprint"]');
    await expect(page.locator('iframe[title*="Scrap Sprint"]')).toBeVisible();
    // Game canvas eventually exists inside the frame.
    await expect(frame.locator('canvas')).toBeVisible({ timeout: 30_000 });
  });

  test('projects home lists the deterministic sample and links to the Studio', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();
    const card = page.getByRole('link', { name: /Scrap Sprint/ });
    await expect(card).toBeVisible();
    await expect(card.getByText(/deterministic sample/i)).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/app\/studio\/scrap-sprint/);
  });

  test('studio boots the real game and the __WELD__ bridge reports live state', async ({ page }) => {
    await page.goto('/app/studio/scrap-sprint');
    await expect(page.getByText('SCRAP SPRINT').first()).toBeVisible({ timeout: 30_000 });

    // The game iframe exists; read its bridge.
    const frameHandle = await page.waitForSelector('iframe[title*="playable preview"]');
    const frame = await frameHandle.contentFrame();
    expect(frame).not.toBeNull();

    // Wait for the bridge, then start the game and move.
    await frame!.waitForFunction(() => (window as WeldWindow).__WELD__ !== undefined, null, {
      timeout: 30_000,
    });

    // Start the game (any key) and verify status flips to playing.
    await frameHandle.click();
    await page.keyboard.press('w');
    await frame!.waitForFunction(() => (window as WeldWindow).__WELD__?.getGameStatus() === 'playing');

    // Hold movement — player position must change (controls work).
    const before = await frame!.evaluate(() => (window as WeldWindow).__WELD__!.getPlayerState());
    await page.keyboard.down('d');
    await page.waitForTimeout(600);
    await page.keyboard.up('d');
    const after = await frame!.evaluate(() => (window as WeldWindow).__WELD__!.getPlayerState());
    expect(after.x).toBeGreaterThan(before.x);

    // Snapshot is structured and numeric.
    const snap = await frame!.evaluate(() => (window as WeldWindow).__WELD__!.getGameState());
    expect(snap.status).toBe('playing');
    expect(typeof snap.score).toBe('number');
    expect(snap.objectives.target).toBe(5);

    // No uncaught console errors from the game frame.
  });

  test('studio shows the Game Bible contract from the API', async ({ page }) => {
    await page.goto('/app/studio/scrap-sprint');
    await expect(page.getByText('Game Bible · v1')).toBeVisible();
    await expect(page.getByText(/Deliver 5 scrap/i)).toBeVisible();
  });
});
