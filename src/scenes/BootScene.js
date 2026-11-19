import Phaser from 'phaser';
import { generateTextures } from '../systems/textures.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.json('asset_manifest', 'assets/overrides/manifest.json');
  }

  create() {
    const manifest = this.cache.json.get('asset_manifest');
    const list = manifest && Array.isArray(manifest.overrides) ? manifest.overrides : [];
    let queued = 0;
    for (const entry of list) {
      if (!entry || !entry.key || !entry.file) continue;
      this.load.image(entry.key, `assets/overrides/${entry.file}`);
      queued++;
    }
    if (queued > 0) {
      this.load.once('complete', () => {
        generateTextures(this);
        this.scene.start('Menu');
      });
      this.load.start();
      return;
    }
    generateTextures(this);
    this.scene.start('Menu');
  }
}
