import Phaser from 'phaser';
import { parseGameBible, sampleBible } from '@weld/gamebible';
import { createGame } from './game/logic';
import { installWeldBridge } from './bridge';
import { GameScene } from './scenes/GameScene';

const bible = parseGameBible(sampleBible);

const sim = createGame(bible);

// The scene advances simRef.state each frame; the bridge always reads the
// latest snapshot, so window.__WELD__ is never stale.
const simRef = { state: sim.state, rules: sim.rules };
const bridge = installWeldBridge(() => simRef);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: bible.level.width,
  height: bible.level.height,
  backgroundColor: '#0B0D12',
  scene: [new GameScene(simRef)],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, pixelArt: false },
};

void new Phaser.Game(config);

export { bridge };
