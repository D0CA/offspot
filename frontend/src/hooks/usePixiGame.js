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

    // Reference to canvas and drag state variables
    const canvas = app.view;
    let isDragging = false;
    let dragMoved = false;
    const clickThreshold = 5;
    let start = { x: 0, y: 0 };

    // ===== CURSOR HANDLING & DRAG CANCEL =====
    canvas.classList.add('custom-cursor');
    canvas.addEventListener('pointerdown', () => canvas.classList.add('drag-mode'));
    canvas.addEventListener('pointerup', () => canvas.classList.remove('drag-mode'));
    canvas.addEventListener('click', () => {
      canvas.classList.add('cursor-click');
      setTimeout(() => canvas.classList.remove('cursor-click'), 150);
    });
    // Cancel drag if pointer leaves canvas/UI overlay
    const cancelDrag = () => {
      if (isDragging) {
        isDragging = false;
        dragMoved = false;
        document.body.classList.remove('dragging');
      }
    };
    canvas.addEventListener('pointerleave', cancelDrag);
    canvas.addEventListener('pointercancel', cancelDrag);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelDrag();
    });
    // ============================

    // World container
    const world = new PIXI.Container();
    world.eventMode = 'static';
    world.hitArea = app.screen;
    app.stage.addChild(world);

    // Camera container
    const camera = new PIXI.Container();
    camera.sortableChildren = true;
    world.addChild(camera);
    cameraRef.current = camera;

    // Clamp function
    const clampCamera = () => {
      const cam = cameraRef.current;
      if (!cam) return;
      const scale = cam.scale.x;
      const { width, height } = mapConfig;
      cam.x = clamp(cam.x, window.innerWidth - width * scale, 0);
      cam.y = clamp(cam.y, window.innerHeight - height * scale, 0);
    };

    // Resize handler
    const handleResize = debounce(() => {
      const cam = cameraRef.current;
      if (!cam) return;
      const { width, height } = mapConfig;
      const scale = Math.min(window.innerWidth / width, window.innerHeight / height) * 1.2;
      cam.scale.set(scale);
      clampCamera();
      app.renderer.resize(window.innerWidth, window.innerHeight);
    }, 100);
    window.addEventListener('resize', handleResize);
    window.addEventListener('pixi-ready', handleResize);

    // Load background
    (async () => {
      try {
        const texture = await PIXI.Assets.load(mapConfig.backgroundUrl);
        const bg = new PIXI.Sprite(texture);
        bg.anchor.set(0);
        bg.zIndex = -100;
        cameraRef.current?.addChild(bg);
        window.dispatchEvent(new Event('pixi-ready'));
        setTimeout(() => {
          if (!window._pixiReadyDispatched) {
            window.dispatchEvent(new Event('pixi-ready'))
            window._pixiReadyDispatched = true
          }          
        }, 3000)        
      } catch (err) {
        console.error('[PIXI] background load error', err);
      }
    })();

    // Load emotes
    load7TVEmotes();

    // Pan controls with cancel handlers
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
      if (!dragMoved && Math.hypot(dx0, dy0) > clickThreshold) dragMoved = true;
      if (!dragMoved) return;
      const cam = cameraRef.current;
      cam.x += e.data.global.x - start.x;
      cam.y += e.data.global.y - start.y;
      start = { x: e.data.global.x, y: e.data.global.y };
      clampCamera();
    });
    world.on('pointerup', e => {
      isDragging = false;
      document.body.classList.remove('dragging');
      if (!dragMoved) {
        const { x, y } = e.data.global;
        const { x: lx, y: ly } = computeLocalCoords(x, y, cameraRef.current.x, cameraRef.current.y, cameraRef.current.scale.x);
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
    // Also cancel if released outside
    world.on('pointerupoutside', cancelDrag);
    world.on('pointercancel', cancelDrag);

    // Zoom
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

    // Ticker
    const tick = delta => {
      const step = SPEED * delta;
      Object.values(localRef.current).forEach(p => {
        if (!p?.container || !p.anims) return;
        const dx = p.targetX - p.container.x;
        const dy = p.targetY - p.container.y;
        const dist = Math.hypot(dx, dy);
        const moving = dist > step;
        if (p.justSpawned) {
          p.container.x = p.targetX;
          p.container.y = p.targetY;
          p.justSpawned = false;
        } else if (moving) {
          p.container.x += dx / dist * step;
          p.container.y += dy / dist * step;
        } else {
          p.container.x = p.targetX;
          p.container.y = p.targetY;
        }
        let dir = p.currentDirection;
        if (moving) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Left' : 'Right') : (dy > 0 ? 'Front' : 'Back');
        const anim = moving ? 'WalkAnim' : 'IdleAnim';
        if (anim !== p.currentAnim || dir !== p.currentDirection) {
          const arm = p.anims[dir]?.animation;
          if (arm?.hasAnimation(anim)) arm.fadeIn(anim, 0, 0);
          p.currentAnim = anim;
          p.currentDirection = dir;
        }
        p.container.zIndex = p.container.y;
        Object.entries(p.anims).forEach(([d, animDisplay]) => animDisplay.visible = d === p.currentDirection);
      });
    };
    app.ticker.add(tick);

    // Socket handlers
    setupSocketHandlers({ socket: socket.current, app, playersRef: localRef, stage: cameraRef.current, user, setPlayerCount, updateMyXP });

    // Empêche la perte d'interaction au retour d'onglet
    window.addEventListener('focus', () => {
      canvas.focus();
      canvas.style.pointerEvents = 'auto';
      canvas.tabIndex = -1;
      canvas.style.outline = 'none';
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pixi-ready', handleResize);
      document.removeEventListener('visibilitychange', cancelDrag);
      canvas.removeEventListener('pointerleave', cancelDrag);
      canvas.removeEventListener('pointercancel', cancelDrag);
      world.removeAllListeners();
      app.ticker.remove(tick);
      app.destroy(true, { children: true });
    };
  }, [user, socket.current]);

  return { pixiContainer, cameraRef };
}
