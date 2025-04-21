import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { clamp, computeLocalCoords } from '../utils/mathUtils';
import { debounce } from '../utils/debounce';
import { setupSocketHandlers } from '../socket/socketHandler';
import { load7TVEmotes } from '../utils/7tv';

/**
 * Hook that sets up the PIXI game scene and returns refs.
 */
export function usePixiGame(mapConfig, SPEED, user, socket, localRef, setPlayerCount, updateMyXP) {
  const pixiContainer = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!pixiContainer.current || !user || !socket.current) return;
    // Clear existing canvas
    pixiContainer.current.innerHTML = '';

    // Create PIXI application
    const app = new PIXI.Application({
      backgroundAlpha: 0,
      transparent: true,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      resizeTo: window,
    });
    pixiContainer.current.appendChild(app.view);

    // ===== CURSOR HANDLING =====
    const canvas = app.view;
    // default pointer
    canvas.classList.add('custom-cursor');
    // on drag
    canvas.addEventListener('pointerdown', () => {
      canvas.classList.add('drag-mode');
    });
    canvas.addEventListener('pointerup', () => {
      canvas.classList.remove('drag-mode');
    });
    // click feedback
    canvas.addEventListener('click', () => {
      canvas.classList.add('cursor-click');
      setTimeout(() => canvas.classList.remove('cursor-click'), 150);
    });
    // ============================

    // World container
    const world = new PIXI.Container();
    world.eventMode = 'static';
    world.hitArea = app.screen;
    app.stage.addChild(world);

    // Camera container (holds map + players)
    const camera = new PIXI.Container();
    camera.sortableChildren = true; // Enable zIndex sorting
    world.addChild(camera);
    cameraRef.current = camera;

    // Clamp camera within map bounds
    const clampCamera = () => {
      const cam = cameraRef.current;
      if (!cam) return;
      const scale = cam.scale.x;
      const { width, height } = mapConfig;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const mapW = width * scale;
      const mapH = height * scale;
      cam.x = clamp(cam.x, screenW - mapW, 0);
      cam.y = clamp(cam.y, screenH - mapH, 0);
    };

    // Debounced resize handler
    const handleResize = debounce(() => {
      const cam = cameraRef.current;
      if (!cam) return;
      const { width, height } = mapConfig;
      const scaleX = window.innerWidth / width;
      const scaleY = window.innerHeight / height;
      cam.scale.set(Math.min(scaleX, scaleY) * 1.2);
      clampCamera();
      app.renderer.resize(window.innerWidth, window.innerHeight);
    }, 100);
    window.addEventListener('resize', handleResize);
    window.addEventListener('pixi-ready', handleResize);

    // Load background image
    (async () => {
      try {
        const texture = await PIXI.Assets.load(mapConfig.backgroundUrl);
        const bg = new PIXI.Sprite(texture);
        bg.anchor.set(0);
        bg.zIndex = -100; // behind all players
        cameraRef.current?.addChild(bg);
        window.dispatchEvent(new Event('pixi-ready'));
      } catch (err) {
        console.error('[PIXI] background load error', err);
      }
    })();

    // Load chat emotes
    load7TVEmotes();

    // Pan controls
    let isDragging = false;
    let dragMoved = false;
    const clickThreshold = 5; // pixels
    let start = { x: 0, y: 0 };

    world.on('pointerdown', e => {
      isDragging = true;
      dragMoved = false;
      start = { x: e.data.global.x, y: e.data.global.y };
      document.body.classList.add('dragging');
    });

    world.on('pointermove', e => {
      if (!isDragging) return;
      const dx0 = e.data.global.x - start.x;
      const dy0 = e.data.global.y - start.y;
      if (!dragMoved && Math.hypot(dx0, dy0) > clickThreshold) {
        dragMoved = true;
      }
      if (!dragMoved) return;
      const cam = cameraRef.current;
      const { x, y } = e.data.global;
      cam.x += x - start.x;
      cam.y += y - start.y;
      start = { x, y };
      clampCamera();
    });

    world.on('pointerup', e => {
      isDragging = false;
      document.body.classList.remove('dragging');
      if (!dragMoved) {
        const cam = cameraRef.current;
        const { x, y } = e.data.global;
        const { x: lx, y: ly } = computeLocalCoords(x, y, cam.x, cam.y, cam.scale.x);
        const { walkableArea } = mapConfig;
        const tx = clamp(lx, walkableArea.minX, walkableArea.maxX);
        const ty = clamp(ly, walkableArea.minY, walkableArea.maxY);
        const me = localRef.current[user.username.toLowerCase()];
        if (me && (!me.blockInputUntil || Date.now() >= me.blockInputUntil)) {
          me.targetX = tx;
          me.targetY = ty;
          me.tileX = tx;
          me.tileY = ty;
          socket.current.emit('move', { x: tx, y: ty });
        }
      }
    });

    world.on('wheel', e => {
      e.stopPropagation();
      const cam = cameraRef.current;
      const { x, y, deltaY } = e.data.originalEvent;
      const dir = deltaY > 0 ? -1 : 1;
      const oldScale = cam.scale.x;
      const newScale = clamp(oldScale + dir * 0.1, 0.5, 2);
      const rect = app.view.getBoundingClientRect();
      const { x: lx, y: ly } = computeLocalCoords(x, y, cam.x - rect.left, cam.y - rect.top, oldScale);
      cam.scale.set(newScale);
      cam.x = x - rect.left - lx * newScale;
      cam.y = y - rect.top - ly * newScale;
      clampCamera();
    });

    // Ticker: handle movement and layering with delta-time
    const tick = (delta) => {
      const step = SPEED * delta;
      Object.values(localRef.current).forEach(p => {
        if (!p || !p.container || !p.anims) return;
        const dx = p.targetX - p.container.x;
        const dy = p.targetY - p.container.y;
        const dist = Math.hypot(dx, dy);
        const moving = dist > step;

        // Move sprite
        if (p.justSpawned) {
          p.container.x = p.targetX;
          p.container.y = p.targetY;
          p.justSpawned = false;
        } else if (moving) {
          p.container.x += (dx / dist) * step;
          p.container.y += (dy / dist) * step;
        } else {
          p.container.x = p.targetX;
          p.container.y = p.targetY;
        }

        // Direction & animation
        let dir = p.currentDirection;
        if (moving) {
          dir = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'Left' : 'Right')
            : (dy > 0 ? 'Front' : 'Back');
        }
        const anim = moving ? 'WalkAnim' : 'IdleAnim';
        if (anim !== p.currentAnim || dir !== p.currentDirection) {
          const arm = p.anims[dir]?.animation;
          if (arm && arm.hasAnimation(anim)) arm.fadeIn(anim, 0, 0);
          p.currentAnim = anim;
          p.currentDirection = dir;
        }

        // Layering & visibility
        p.container.zIndex = p.container.y;
        Object.entries(p.anims).forEach(([d, animDisplay]) => animDisplay.visible = d === p.currentDirection);
      });
    };
    app.ticker.add(tick);

    // Socket handlers setup
    setupSocketHandlers({ socket: socket.current, app, playersRef: localRef, stage: cameraRef.current, user, setPlayerCount, updateMyXP });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pixi-ready', handleResize);
      world.removeAllListeners();
      app.ticker.remove(tick);
      app.destroy(true, { children: true });
    };
  }, [user, socket.current]);

  return { pixiContainer, cameraRef };
}
