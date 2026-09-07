import { expect, test } from '@playwright/test';

/**
 * M5/M6 e2e (blueprint: ship it -> discover -> remix). Drives the real
 * community loop end to end in a browser, the way a player + a remixer do:
 *
 *   publish (gate-guarded) -> appears in the public gallery -> opens on its
 *   /play/<slug> share page -> remix clones it into a NEW, private,
 *   unpublished draft in the Studio.
 *
 * Honest throughout: the publish click runs the REAL Playtester against the
 * sample's bible (no stub), the gallery only shows genuinely published games,
 * and the remix is a real copy — never an auto-published fake. Hermetic: the
 * API runs against a fresh SQLite DB with LLM keys cleared (see
 * playwright.config), so this never touches the network or a paid model.
 */

test.describe('WELD M5/M6 publish -> gallery -> remix', () => {
  test('a gate-passing game publishes, is discovered in the gallery, and is remixable', async ({
    page,
  }) => {
    // -- Publish (gate-guarded) ------------------------------------------
    await page.goto('/app/studio/scrap-sprint');
    await expect(page.getByText('SCRAP SPRINT').first()).toBeVisible({ timeout: 30_000 });

    // Before publishing, the sample must NOT appear on the public gallery.
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: /The gallery/i })).toBeVisible();
    await expect(page.getByText(/No published games yet/i)).toBeVisible();

    // Publish from the Studio. The button runs the real Playtester and only
    // flips to a live link when EVERY gate passes (never ships a broken game).
    await page.goto('/app/studio/scrap-sprint');
    await page.getByRole('button', { name: /^Publish$/i }).click();
    // The honest success state is the live share link replacing the button.
    // (Renders as "Live -> /play/<slug>"; match the share path, not the arrow.)
    const liveLink = page.getByRole('link', { name: /\/play\/scrap-sprint/i });
    await expect(liveLink).toBeVisible({ timeout: 60_000 });

    // -- Discover in the public gallery ----------------------------------
    // Reload (bypass the client Router Cache) and retry briefly: the publish
    // commits in the API the moment the live link appears, and the gallery
    // re-fetches with a short revalidate window.
    const card = page.getByRole('link', { name: /Scrap Sprint/ });
    await expect(async () => {
      await page.goto('/gallery');
      await page.reload();
      await expect(card).toBeVisible();
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    await expect(card.getByText(/Published/i)).toBeVisible();

    // -- Open the public share page --------------------------------------
    await card.click();
    await expect(page).toHaveURL(/\/play\/scrap-sprint/);
    await expect(page.getByRole('heading', { name: /Scrap Sprint/i })).toBeVisible();
    await expect(page.locator('iframe[title*="playable"]')).toBeVisible();

    // -- Remix into a new, private, unpublished draft ---------------------
    await page.getByRole('button', { name: /Remix this game/i }).click();
    // Lands in the Studio on a NEW slug (a real copy, not the original).
    await expect(page).toHaveURL(/\/app\/studio\/scrap-sprint-remix/, { timeout: 30_000 });

    // The remix is honest: it starts UNPUBLISHED, so it must not appear in the
    // gallery, while the original still does. Reload to bypass the Router Cache.
    await page.goto('/gallery');
    await page.reload();
    await expect(page.getByRole('link', { name: /Scrap Sprint \(Remix\)/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Scrap Sprint/ })).toBeVisible();
  });

  test('an unpublished game 404s on its public share page', async ({ page }) => {
    // The honest guard: a game that was never published is never exposed
    // through the share URL. (scrap-sprint-remix-N is always a fresh,
    // unpublished draft in a hermetic DB.)
    const response = await page.goto('/play/scrap-sprint-remix-2');
    expect(response?.status()).toBe(404);
  });
});
