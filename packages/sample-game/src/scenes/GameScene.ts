/**
 * GameScene — the Phaser presentation layer for Scrap Sprint.
 *
 * Rendering only. Every rule lives in the pure logic core (../game/logic);
 * this scene reads state, feeds intents, and draws. All visuals are drawn
 * procedurally (blueprint §71: SVG/procedural assets for V1, no external
 * asset fetching).
 */

import Phaser from 'phaser';
import {
  themeColors,
  themeWords,
  type GameBible,
  type ThemeColors,
  type ThemeWords,
} from '@weld/gamebible';
import {
  createInitialState,
  startGame,
  pauseGame,
  resumeGame,
  update,
  INPUT_IDLE,
  type GameState,
  type InputState,
  type Rules,
} from '../game/logic';
import { emitToParent } from '../bridge';

interface SimRef {
  state: GameState;
  rules: Rules;
}

export class GameScene extends Phaser.Scene {
  private sim: SimRef;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D' | 'R' | 'P', Phaser.Input.Keyboard.Key>;
  private escKey!: Phaser.Input.Keyboard.Key;

  private playerSprite!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Rectangle;
  private carriedSprite!: Phaser.GameObjects.Rectangle;
  private pickupSprites = new Map<string, Phaser.GameObjects.Container>();
  private hudScore!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private hudTimer!: Phaser.GameObjects.Text;
  private hudDelivered!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayBody!: Phaser.GameObjects.Text;
  private lastEmit = 0;

  private readonly bible: GameBible;
  private readonly COLORS: ThemeColors;
  private readonly WORDS: ThemeWords;

  constructor(sim: SimRef, bible: GameBible) {
    super({ key: 'game' });
    this.sim = sim;
    this.bible = bible;
    this.COLORS = themeColors(bible);
    this.WORDS = themeWords(bible);
  }

  create(): void {
    this.drawFloor();
    this.drawDeliveryZone();
    this.drawHazards();
    this.drawPickups();
    this.drawPlayer();
    this.drawHud();
    this.buildOverlay();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,R,P') as typeof this.wasd;
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // Click / keypress from title starts the run.
    this.input.on('pointerdown', () => this.tryStart());
  }

  private tryStart(): void {
    if (this.sim.state.status === 'title') {
      this.sim.state = startGame(this.sim.state);
    }
  }

  private restart(): void {
    const fresh = createInitialState(this.bible.level, this.sim.rules);
    this.sim.state = { ...fresh, status: 'playing' };
    this.syncPickups(true);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05); // clamp tab-switch spikes

    // Restart works from any status.
    if (Phaser.Input.Keyboard.JustDown(this.wasd.R)) {
      this.restart();
    }

    if (this.sim.state.status === 'title') {
      if (
        Phaser.Input.Keyboard.JustDown(this.wasd.W) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.up)
      ) {
        this.tryStart();
      }
    } else if (this.sim.state.status === 'playing') {
      if (
        Phaser.Input.Keyboard.JustDown(this.escKey) ||
        Phaser.Input.Keyboard.JustDown(this.wasd.P)
      ) {
        this.sim.state = pauseGame(this.sim.state);
      }
    } else if (this.sim.state.status === 'paused') {
      if (
        Phaser.Input.Keyboard.JustDown(this.escKey) ||
        Phaser.Input.Keyboard.JustDown(this.wasd.P)
      ) {
        this.sim.state = resumeGame(this.sim.state);
      }
    }

    const input: InputState =
      this.sim.state.status === 'playing'
        ? {
            up: !!(this.cursors.up?.isDown || this.wasd.W.isDown),
            down: !!(this.cursors.down?.isDown || this.wasd.S.isDown),
            left: !!(this.cursors.left?.isDown || this.wasd.A.isDown),
            right: !!(this.cursors.right?.isDown || this.wasd.D.isDown),
          }
        : INPUT_IDLE;

    const before = this.sim.state;
    const after = update(before, this.sim.rules, input, dt);
    if (after !== before) {
      const deliveredNow = after.delivered > before.delivered;
      const hitNow = after.lives < before.lives;
      this.sim.state = after;
      if (deliveredNow) this.flashFurnace();
      if (hitNow) this.cameras.main.shake(120, 0.006);
      if (before.status === 'playing' && after.status !== 'playing') {
        this.syncOverlay();
      }
      this.syncPickups();
    }

    this.syncSprites();
    this.syncHud();
    if (before.status !== this.sim.state.status) this.syncOverlay();

    // Throttled live-state broadcast for the embedding Studio (~5 Hz).
    const now = performance.now();
    if (now - this.lastEmit > 200) {
      this.lastEmit = now;
      emitToParent(this.sim.state, this.sim.rules);
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  private drawFloor(): void {
    const { width, height } = this.bible.level;
    this.add.rectangle(width / 2, height / 2, width, height, this.COLORS.floor);
    const g = this.add.graphics();
    g.lineStyle(1, this.COLORS.grid, 0.5);
    for (let x = 0; x <= width; x += 60) g.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 60) g.lineBetween(0, y, width, y);
    // Border.
    g.lineStyle(3, this.COLORS.grid, 1);
    g.strokeRect(1, 1, width - 2, height - 2);
  }

  private drawDeliveryZone(): void {
    const z = this.bible.level.delivery_zone;
    this.add
      .rectangle(z.x + z.width / 2, z.y + z.height / 2, z.width, z.height, this.COLORS.goalDark)
      .setStrokeStyle(2, this.COLORS.goal);
    this.add
      .text(z.x + z.width / 2, z.y + z.height / 2, z.label, {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '14px',
        color: '#0B0D12',
      })
      .setOrigin(0.5)
      .setData('zoneLabel', true);
    // Glow strip above furnace mouth.
    this.add.rectangle(z.x + z.width / 2, z.y + z.height + 4, z.width * 0.8, 6, this.COLORS.goal, 0.7);
  }

  private drawHazards(): void {
    for (const h of this.bible.level.hazards) {
      this.add.circle(h.x, h.y, h.radius, this.COLORS.hazard, 0.16);
      this.add.circle(h.x, h.y, h.radius, 0x000000, 0).setStrokeStyle(2, this.COLORS.hazard, 0.9);
      this.add.circle(h.x, h.y, 5, this.COLORS.hazard);
    }
  }

  private drawPickups(): void {
    for (const p of this.bible.level.pickups) {
      const c = this.add.container(p.x, p.y);
      const body = this.add.rectangle(0, 0, 22, 22, this.COLORS.pickup).setRotation(Math.PI / 4);
      const core = this.add.rectangle(0, 0, 9, 9, this.COLORS.pickupCore).setRotation(Math.PI / 4);
      c.add([body, core]);
      this.tweens.add({
        targets: c,
        angle: 180,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.pickupSprites.set(p.id, c);
    }
  }

  private drawPlayer(): void {
    this.playerBody = this.add.rectangle(0, 0, 26, 26, this.COLORS.player);
    const visor = this.add.rectangle(7, -4, 10, 8, this.COLORS.playerTrim);
    const tread = this.add.rectangle(0, 15, 30, 6, 0x39415a);
    this.carriedSprite = this.add
      .rectangle(0, -22, 14, 14, this.COLORS.pickup)
      .setRotation(Math.PI / 4)
      .setVisible(false);
    this.playerSprite = this.add.container(
      this.sim.state.player.x,
      this.sim.state.player.y,
      [tread, this.playerBody, visor, this.carriedSprite],
    );
  }

  private drawHud(): void {
    const mono = { fontFamily: '"IBM Plex Mono", monospace', fontSize: '16px', color: this.COLORS.text };
    this.hudScore = this.add.text(16, 12, '', mono).setScrollFactor(0);
    this.hudDelivered = this.add.text(16, 34, '', { ...mono, color: this.COLORS.dim }).setScrollFactor(0);
    this.hudTimer = this.add
      .text(this.bible.level.width - 16, 12, '', { ...mono, fontSize: '22px' })
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.hudLives = this.add
      .text(this.bible.level.width - 16, 42, '', { ...mono, color: '#FF5C1A' })
      .setOrigin(1, 0)
      .setScrollFactor(0);
  }

  private buildOverlay(): void {
    const { width, height } = this.bible.level;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x0b0d12, 0.82);
    this.overlayTitle = this.add
      .text(width / 2, height / 2 - 40, '', {
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: '42px',
        color: this.COLORS.text,
      })
      .setOrigin(0.5);
    this.overlayBody = this.add
      .text(width / 2, height / 2 + 24, '', {
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '15px',
        color: this.COLORS.dim,
        align: 'center',
      })
      .setOrigin(0.5);
    this.overlay = this.add.container(0, 0, [shade, this.overlayTitle, this.overlayBody]);
    this.syncOverlay();
  }

  private syncOverlay(): void {
    const s = this.sim.state.status;
    const show = s !== 'playing';
    this.overlay.setVisible(show);
    if (!show) return;

    const w = this.WORDS;
    const target = this.sim.rules.winTarget;
    const map: Record<string, [string, string]> = {
      title: [
        this.bible.game.title.toUpperCase(),
        `${this.bible.win_condition.description}\nWASD / arrows to move · avoid ${w.hazard}\nPress any key or click to start`,
      ],
      paused: ['PAUSED', 'Esc / P to resume · R to restart'],
      game_over: [
        'RUN OVER',
        `${this.sim.state.loseReason === 'timer_zero' ? 'The timer ran out.' : 'You ran out of health.'}\nDelivered ${this.sim.state.delivered}/${target} · Score ${this.sim.state.score}\nPress R to run it back`,
      ],
      win: [
        'DELIVERED',
        `All ${target} ${w.pickupPlural} delivered to the ${w.goal}. Score ${this.sim.state.score}.\nPress R to play again`,
      ],
    };
    const [title, body] = map[s] ?? ['', ''];
    this.overlayTitle.setText(title);
    this.overlayBody.setText(body);
  }

  private syncSprites(): void {
    const p = this.sim.state.player;
    this.playerSprite.setPosition(p.x, p.y);
    this.carriedSprite.setVisible(this.sim.state.carried);
    // Invulnerability blink.
    this.playerBody.setAlpha(p.invulnerableFor > 0 ? (Math.floor(this.time.now / 90) % 2 ? 0.35 : 1) : 1);
  }

  private syncPickups(force = false): void {
    for (const p of this.sim.state.pickups) {
      const sprite = this.pickupSprites.get(p.id);
      if (!sprite) continue;
      if (force) sprite.setVisible(true);
      else if (p.collected && sprite.visible) {
        sprite.setVisible(false);
      }
    }
  }

  private flashFurnace(): void {
    const z = this.bible.level.delivery_zone;
    const flash = this.add.circle(z.x + z.width / 2, z.y + z.height / 2, 10, this.COLORS.goal, 0.9);
    this.tweens.add({
      targets: flash,
      radius: 90,
      alpha: 0,
      duration: 420,
      onComplete: () => flash.destroy(),
    });
  }

  private syncHud(): void {
    const s = this.sim.state;
    this.hudScore.setText(`SCORE ${s.score}`);
    this.hudDelivered.setText(`${this.WORDS.pickupCaps} ${s.delivered}/${this.sim.rules.winTarget}`);
    this.hudTimer.setText(`${Math.ceil(s.timer).toString().padStart(2, '0')}s`);
    this.hudLives.setText('HP ' + '▮'.repeat(s.lives));
    if (s.timer <= 10 && s.status === 'playing') this.hudTimer.setColor('#FF5C1A');
    else this.hudTimer.setColor(this.COLORS.text);
  }
}
