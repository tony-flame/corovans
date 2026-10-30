export class Input {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;

    window.addEventListener("keydown", (e) => {
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      const first = !this.keys.has(e.code);
      this.keys.add(e.code);
      if (first) this.handlers.keyDown?.(e.code);
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      this.handlers.keyUp?.(e.code);
    });

    window.addEventListener("blur", () => this.reset());

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      this.mouseButtons.add(e.button);
      if (e.button === 0) this.handlers.attack?.();
      else if (e.button === 2) this.handlers.blockStart?.();
      e.preventDefault();
    });

    // На document: при pointer lock mouseup на canvas ловится не всегда.
    document.addEventListener("mouseup", (e) => {
      this.mouseButtons.delete(e.button);
      if (e.button === 2) this.handlers.blockEnd?.();
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("pointerlockchange", () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouseButtons.clear();
      if (wasLocked !== this.locked) this.handlers.lockChange?.(this.locked);
    });

    document.addEventListener("pointerlockerror", () => {
      this.handlers.lockError?.();
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  isBlocking() {
    return this.mouseButtons.has(2);
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  clear() {
    this.keys.clear();
    this.mouseButtons.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  reset() {
    this.keys.clear();
    this.mouseButtons.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  requestLock() {
    if (this.locked) return;
    const result = this.canvas.requestPointerLock?.();
    if (result && typeof result.catch === "function") result.catch(() => {});
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
