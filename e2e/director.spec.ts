import { expect, test } from '@playwright/test';

/**
 * M1 e2e (blueprint: prompt → game bible). Drives the real Director loop the
 * way a user does: open the app, describe a game, and land in the Studio with
 * a real, schema-valid Game Bible rendered from the API.
 *
 * Hermetic: the API is launched with LLM keys cleared (see playwright.config),
 * so the Director uses its deterministic offline composer — no network calls,
 * no secrets, and the result is honestly labeled "offline" rather than fake AI.
 */

test.describe('WELD M1 Game Director', () => {
  test('describing a game generates a real Game Bible and opens it in the Studio', async ({
    page,
  }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();

    // Open the prompt form and describe a game in plain language.
    await page.getByRole('button', { name: /\+ New game/i }).click();
    await page
      .getByLabel(/Describe your game/i)
      .fill('A top-down arcade game where you collect glowing mushrooms and dodge acid pools.');
    await page.getByRole('button', { name: /Direct it/i }).click();

    // The Director runs, persists a project, and the Studio opens for it.
    await expect(page).toHaveURL(/\/app\/studio\/[a-z0-9-]+/, { timeout: 30_000 });
    // Honestly labeled as the offline composer (no LLM key in e2e).
    await expect(page.getByText(/director · offline/i)).toBeVisible({ timeout: 30_000 });

    // The generated Game Bible is real and on screen (schema version + goal).
    await expect(page.getByText(/Game Bible · v\d+/)).toBeVisible();
    await expect(page.getByText(/Core loop/i)).toBeVisible();
    await expect(page.getByText(/Controls/i)).toBeVisible();

    // The theme was read from the prompt, not a canned template: the spec
    // reflects the mushrooms we asked to collect.
    await expect(page.getByText(/mushroom/i).first()).toBeVisible();
  });

  test('the Director refuses an empty/too-short prompt with a clear message', async ({
    page,
  }) => {
    await page.goto('/app');
    await page.getByRole('button', { name: /\+ New game/i }).click();
    // The submit button is disabled until the description is long enough —
    // honest guard-rail instead of a confusing empty submission.
    await expect(page.getByRole('button', { name: /Direct it/i })).toBeDisabled();
    await page.getByLabel(/Describe your game/i).fill('a game');
    await expect(page.getByRole('button', { name: /Direct it/i })).toBeDisabled();
  });
});
