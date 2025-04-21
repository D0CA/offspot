// Refactor du fichier playerManager.js
import * as PIXI from 'pixi.js';
import * as dragonBones from '@md5crypt/dragonbones-pixi';
import { mapConfig } from '../constants/mapConfig';

const dragonBonesFactory = dragonBones.PixiFactory.factory;
const directions = ['Front', 'Back', 'Left', 'Right'];
const ANIMATION_SPEED = 1.2;
const PLAYER_MOVE_SPEED = 3;
const PLAYER_SCALE = 1.3;
let isDragonBonesLoaded = false;
let isLoadingDragonBones = false;

PIXI.Ticker.shared.add(() => {
  dragonBonesFactory.clock.advanceTime(PIXI.Ticker.shared.deltaMS / 1000);
});

async function loadDragonBonesData() {
  if (isDragonBonesLoaded || isLoadingDragonBones) return;
  isLoadingDragonBones = true;

  await Promise.all(directions.map(async (dir) => {
    if (!dragonBonesFactory.getDragonBonesData(dir)) {
      try {
        const [skeData, texData] = await Promise.all([
          fetch(`/dragonbones/${dir}_ske.json`).then(res => res.json()),
          fetch(`/dragonbones/${dir}_tex.json`).then(res => res.json())
        ]);
        const texture = await PIXI.Assets.load(`/dragonbones/${dir}_tex.png`);
        dragonBonesFactory.parseDragonBonesData(skeData, dir);
        dragonBonesFactory.parseTextureAtlasData(texData, texture, dir);
      } catch (e) {
        console.error(`❌ Échec du chargement ou parsing DragonBones pour "${dir}" :`, e);
      }
    }
  }));

  isDragonBonesLoaded = true;
  isLoadingDragonBones = false;
}

async function waitForArmatures(timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const allLoaded = directions.every(dir =>
      dragonBonesFactory.getDragonBonesData(dir)
    );
    if (allLoaded) return;
    await new Promise(res => setTimeout(res, 100));
  }
  throw new Error("Timeout waiting for DragonBones data to be loaded.");
}

function createArmaturesForPlayer(id, data, container, anims) {
  let isSpawning = false;
  for (const dir of directions) {
    const dragonBonesData = dragonBonesFactory.getDragonBonesData(dir);
    const armatureName = dragonBonesData?.armatureNames[0];
    const armature = dragonBonesFactory.buildArmatureDisplay(armatureName, dir);
    if (armature?.animation) armature.animation.timeScale = ANIMATION_SPEED;
    if (!armature || !armature.animation) continue;

    const hasSpawnAnim = armature.animation.hasAnimation("SpawnAnim");

    if (dir === 'Front') {
      if (hasSpawnAnim) {
        try {
          armature.animation.fadeIn("SpawnAnim", 0, 1);
          isSpawning = true;
          setTimeout(() => {
            const p = container?.playerData;
            if (p) {
              p.isSpawning = false;
              p.blockInputUntil = Date.now();
            }
          }, 2000);

          armature.once(dragonBones.EventObject.COMPLETE, (event) => {
            if (event.animationState?.name === "SpawnAnim") {
              armature.animation.play("IdleAnim", 0);
              const p = container?.playerData;
              if (p) {
                p.isSpawning = false;
                p.blockInputUntil = Date.now();
                p.anims = anims;
                directions.forEach(dir => {
                  if (p.anims[dir]) {
                    p.anims[dir].visible = (dir === 'Front');
                  }
                });
              }
            }
          });
        } catch (e) {
          armature.animation.play("IdleAnim", 0);
        }
      } else {
        armature.animation.play("IdleAnim", 0);
      }
    } else {
      armature.animation.play("IdleAnim", 0);
    }

    armature.visible = dir === 'Front';
    armature.scale.set(0.2 * PLAYER_SCALE);
    container.addChild(armature);
    anims[dir] = armature;
  }
  return isSpawning;
}

function createPlayerContainer(data, id, scale) {
  const container = new PIXI.Container();
  container.sortableChildren = true;

  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.25);
  shadow.drawEllipse(0, 0, 80, 20);
  shadow.endFill();
  shadow.y = 110;
  shadow.zIndex = -1;
  container.addChild(shadow);

  const anims = {};
  const isSpawning = createArmaturesForPlayer(id, data, container, anims);

  const nameText = new PIXI.Text(data.username, {
    fontSize: 20 * PLAYER_SCALE,
    fill: 'white',
    fontWeight: 'bold',
    fontFamily: 'Cherry Bomb One',
    resolution: 2,
  });
  nameText.anchor.set(0.5, -0.5);
  nameText.y = 80;

  const strokeContainer = new PIXI.Container();
  const offsets = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  offsets.forEach(([dx, dy]) => {
    const outline = new PIXI.Text(data.username, {
      fontSize: 20 * PLAYER_SCALE,
      fill: '#ffae51',
      fontWeight: 'bold',
      fontFamily: 'Cherry Bomb One',
      resolution: 2,
    });
    outline.anchor.set(0.5, -0.5);
    outline.x = dx;
    outline.y = nameText.y + dy;
    strokeContainer.addChild(outline);
  });

  strokeContainer.addChild(nameText);
  container.addChild(strokeContainer);

  const levelText = new PIXI.Text(`Niv ${data.level || 1}`, {
    fontSize: 14 * PLAYER_SCALE,
    fill: '#ffae51',
    fontFamily: 'Poppins',
    fontWeight: 'bold',
  });
  levelText.anchor.set(0.5, -2.25);
  levelText.y = nameText.y - 10;
  container.addChild(levelText);

  if (data.x == null || data.y == null) {
    data.x = 400;
    data.y = 400;
  }

  scale = Math.max(0.01, scale);
  const scaledX = data.x * scale;
  const scaledY = data.y * scale;

  container.x = scaledX;
  container.y = scaledY;

  container.scale.set(0.6 * PLAYER_SCALE);

  const FEET_OFFSET_Y = 85 * PLAYER_SCALE;
  container.children.forEach(child => {
    child.y -= FEET_OFFSET_Y;
  });

  return { container, anims, nameText, levelText, isSpawning };
}

export async function createOrUpdatePlayers(serverPlayers, localPlayers, stage, socketId, liveLevels, scale = 1) {
  await loadDragonBonesData();
  await waitForArmatures();

  for (const id in serverPlayers) {
    const data = serverPlayers[id];

    if (!localPlayers[id]) {
      const { container, anims, nameText, levelText, isSpawning } = createPlayerContainer(data, id, scale);

      localPlayers[id] = {
        username: data.username,
        container,
        anims,
        currentDirection: 'Front',
        nameText,
        levelText,
        justSpawned: true,
        isSpawning,
        blockInputUntil: Date.now() + 2000,
        targetX: data.x,
        targetY: data.y,
        tileX: data.x,
        tileY: data.y,
        chatBubble: null,
        level: data.level,
        xp: data.xp || 0,
        requiredXP: data.requiredXP || 100,
        lastPositionTime: Date.now(),
        idleTimeout: null,
        currentAnim: 'IdleAnim',
      };

      container.playerData = localPlayers[id];
      container.zIndex = 10_000;
      stage.addChild(container);
    } else {
      const p = localPlayers[id];
      p.tileX = data.x;
      p.tileY = data.y;
      if (id !== socketId) {
        p.targetX = data.x;
        p.targetY = data.y;
      }
      const newLevel = data.level ?? 1;
      if (p.level !== newLevel) {
        p.levelText.text = `Niv ${newLevel}`;
        p.level = newLevel;
      }
      p.container.zIndex = 1000 + p.container.y;
    }
  }

  for (const id in localPlayers) {
    if (!serverPlayers[id]) {
      const player = localPlayers[id]
      try {
        if (player.chatBubble) {
          player.chatBubble.destroy({ children: true })
        }
        player.container.destroy({ children: true })
      } catch (e) {
        console.warn('💥 Erreur destruction player container', e)
      }
      stage.removeChild(player.container)
      delete localPlayers[id]
    }
  }  
}
