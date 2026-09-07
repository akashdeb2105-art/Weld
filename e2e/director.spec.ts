import { expect, test } from '@playwright/test';

/**
 * M1/M2 e2e (blueprint: describe -> review the spec -> playable game). Drives
 * the real loop the way a user does: open the app, describe a game, REVIEW the
 * Game Bible the Director drafts (editing a field, as a user would), confirm,
 * and land in the Studio with a real, schema-valid Game Bible that actually
 * PLAYS in the browser, booted from its own bible.
 *
 * Hermetic: the API is launched with LLM keys cleared (see playwright.config),
 * so the Director uses its deterministic offline composer -- no network calls,
 * no secrets, and the result is honestly labeled "offline" rather than fake AI.
 */

/** Shape of the read-only WELD bridge installed on window.__WELD__. */
interface WeldBridge {
  getGameStatus(): string;
  getGameState(): {
    status: string;
    objectives: { target: number };
  };
}

type WeldWindow = Window & { __WELD__?: WeldBridge };

const PROMPT =
  'A top-down arcade game where you collect glowing mushrooms and dodge acid pools.';

test.describe('WELD M1 Game Director', () => {
  test('describing a game drafts a reviewable spec, then builds a playable game', async ({
    page,
  }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Your games' })).toBeVisible();

    // Open the prompt form and describe a game in plain language.
    await page.getByRole('button', { name: /\+ New game/i }).click();
    await page.getByLabel(/Describe your game/i).fill(PROMPT);

    // Step 1 (review-before-create): draft the spec. Nothing is built yet.
    await page.getByRole('button', { name: /Draft the spec/i }).click();

    // The Director drafts the spec and shows it for review, honestly labeled.
    await expect(page.getByText(/Review the Game Bible/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/AI Director \(offline\)/i)).toBeVisible();

    // The theme was read from the prompt: the drafted title reflects mushrooms.
    await expect(page.getByLabel(/^Title$/i)).toHaveValue(/mushroom/i);

    // The user tweaks the spec during review -- retitle it before building.
    await page.getByLabel(/^Title$/i).fill('Mushroom Run');

    // Step 2: confirm -> the project is created from exactly what we reviewed.
    await page.getByRole('button', { name: /Build this game/i }).click();

    // The Studio opens for the new project.
    await expect(page).toHaveURL(/\/app\/studio\/[a-z0-9-]+/, { timeout: 30_000 });
    // Honestly labeled as the offline composer (no LLM key in e2e).
    await expect(page.getByText(/director · offline/i)).toBeVisible({ timeout: 30_000 });

    // The generated Game Bible is real and on screen (schema version + goal).
    await expect(page.getByText(/Game Bible · v\d+/)).toBeVisible();
    await expect(page.getByText(/Core loop/i)).toBeVisible();
    await expect(page.getByText(/Controls/i)).toBeVisible();

    // The edited spec is what got built: the Studio reflects the review edit.
    await expect(page.getByText(/Mushroom Run/i).first()).toBeVisible();

    // -- M2: the game the user described is actually PLAYABLE in the Studio --
    // The iframe points at this project's own game (not the hardcoded sample).
    const iframe = page.locator('iframe[title*="playable preview"]');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', /\/games\/[a-z0-9-]+$/);

    // The game boots and installs its read-only bridge.
    const frameHandle = await iframe.elementHandle();
    const frame = await frameHandle!.contentFrame();
    expect(frame).not.toBeNull();
    await frame!.waitForFunction(() => (window as WeldWindow).__WELD__ !== undefined, null, {
      timeout: 30_000,
    });
    const snap = await frame!.evaluate(() => (window as WeldWindow).__WELD__!.getGameState());
    // Booted from the generated bible (deliver 5), rendering real state.
    expect(snap.objectives.target).toBe(5);
    expect(snap.status).toBe('title');
  });

  test('the Director refuses an empty/too-short prompt with a clear message', async ({
    page,
  }) => {
    await page.goto('/app');
    await page.getByRole('button', { name: /\+ New game/i }).click();
    // The draft button is disabled until the description is long enough --
    // honest guard-rail instead of a confusing empty submission.
    await expect(page.getByRole('button', { name: /Draft the spec/i })).toBeDisabled();
    await page.getByLabel(/Describe your game/i).fill('a game');
    await expect(page.getByRole('button', { name: /Draft the spec/i })).toBeDisabled();
  });
});
