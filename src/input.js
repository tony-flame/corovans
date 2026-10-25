export class Input {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.keys = new Set();
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

    window.addEventListener("blur", () => this.keys.clear());

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 && this.locked) {
        this.handlers.attack?.();
        e.preventDefault();
      }
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("pointerlockchange", () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (wasLocked !== this.locked) this.handlers.lockChange?.(this.locked);
    });

    document.addEventListener("pointerlockerror", () => {
      this.handlers.lockError?.();
    });
  }

  isDown(code) {
    return this.keys.has(code);
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
