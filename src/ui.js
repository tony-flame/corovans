import { UPGRADES, priceOf, canBuy, fineFor, sellMultiplier } from "./economy.js";
import { totalValue } from "./inventory.js";

export class UI {
  constructor(handlers) {
    this.handlers = handlers;
    this.$ = (id) => document.getElementById(id);

    this.hpFill = this.$("hp-fill");
    this.hpText = this.$("hp-text");
    this.stFill = this.$("st-fill");
    this.stText = this.$("st-text");
    this.goldEl = this.$("gold");
    this.wantedEl = this.$("wanted");
    this.objectiveEl = this.$("objective");
    this.promptEl = this.$("prompt");
    this.progressEl = this.$("progress");
    this.progressFill = this.$("progress-fill");
    this.messagesEl = this.$("messages");
    this.crosshair = this.$("crosshair");

    this.startEl = this.$("start");
    this.pauseEl = this.$("pause");
    this.tradeEl = this.$("trade");
    this.helpEl = this.$("help");
    this.endEl = this.$("end");
    this.endTitle = this.$("end-title");
    this.endText = this.$("end-text");

    this.$("start-btn").addEventListener("click", () => this.handlers.start?.());
    this.$("resume-btn").addEventListener("click", () => this.handlers.resume?.());
    this.$("restart-btn").addEventListener("click", () => this.handlers.restart?.());
    this.$("continue-btn").addEventListener("click", () => this.handlers.continueGame?.());
    this.$("close-help").addEventListener("click", () => this.hideHelp());
    this.$("close-trade").addEventListener("click", () => this.handlers.closeTrade?.());
    this.$("sell-btn").addEventListener("click", () => this.handlers.sell?.());
    this.$("fine-btn").addEventListener("click", () => this.handlers.fine?.());
    this.$("trade-upgrades").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-buy]");
      if (btn) this.handlers.buy?.(btn.dataset.buy);
    });

    this.hitTimer = null;
  }

  update(state) {
    const p = state.player;
    const hp = Math.max(0, Math.ceil(p.health));
    this.hpFill.style.width = `${Math.max(0, (p.health / p.maxHealth) * 100)}%`;
    this.hpText.textContent = `${hp} / ${p.maxHealth}`;
    this.stFill.style.width = `${Math.max(0, (p.stamina / p.maxStamina) * 100)}%`;
    this.stText.textContent = `${Math.ceil(p.stamina)}`;

    this.goldEl.textContent = `${state.gold} зм.`;

    if (state.wanted > 0) {
      this.wantedEl.classList.remove("hidden");
      this.wantedEl.textContent = `Розыск: ${"★".repeat(Math.min(5, state.wanted))}`;
    } else {
      this.wantedEl.classList.add("hidden");
    }
  }

  setObjective(text) {
    if (this.objectiveEl.textContent !== text) this.objectiveEl.textContent = text;
  }

  setPrompt(text) {
    if (!text) {
      this.promptEl.classList.remove("show");
      return;
    }
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
    this.promptEl.classList.add("show");
  }

  setProgress(value) {
    if (value === null) {
      this.progressEl.classList.add("hidden");
      return;
    }
    this.progressEl.classList.remove("hidden");
    this.progressFill.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  }

  message(text) {
    const el = document.createElement("div");
    el.textContent = text;
    this.messagesEl.appendChild(el);
    while (this.messagesEl.children.length > 5) {
      this.messagesEl.removeChild(this.messagesEl.firstChild);
    }
    setTimeout(() => el.classList.add("fade"), 6000);
    setTimeout(() => el.remove(), 7000);
  }

  flashHit() {
    this.crosshair.classList.add("hit");
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => this.crosshair.classList.remove("hit"), 140);
  }

  showStart() {
    this.startEl.classList.remove("hidden");
  }

  hideStart() {
    this.startEl.classList.add("hidden");
  }

  showPause() {
    this.pauseEl.classList.remove("hidden");
  }

  hidePause() {
    this.pauseEl.classList.add("hidden");
  }

  showHelp() {
    this.helpEl.classList.remove("hidden");
  }

  hideHelp() {
    this.helpEl.classList.add("hidden");
  }

  get helpOpen() {
    return !this.helpEl.classList.contains("hidden");
  }

  openTrade(state) {
    this.tradeEl.classList.remove("hidden");
    this.renderTrade(state);
  }

  closeTrade() {
    this.tradeEl.classList.add("hidden");
  }

  get tradeOpen() {
    return !this.tradeEl.classList.contains("hidden");
  }

  renderTrade(state) {
    const loot = state.inventory.items;
    const lootEl = this.$("trade-loot");
    const upgradesEl = this.$("trade-upgrades");
    this.$("trade-gold").textContent =
      `В кошеле: ${state.gold} зм. · Вес: ${loot.reduce((s, i) => s + i.weight, 0).toFixed(1)} / ${state.inventory.capacity}`;

    lootEl.innerHTML = "";
    if (loot.length === 0) {
      lootEl.innerHTML = '<div class="item empty">Добычи нет</div>';
    } else {
      for (const item of loot) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `<span>${item.name}</span><span class="val">${item.value} зм.</span>`;
        lootEl.appendChild(row);
      }
    }

    upgradesEl.innerHTML = "";
    for (const [id, def] of Object.entries(UPGRADES)) {
      const level = state.upgrades[id];
      const price = priceOf(id, level);
      const row = document.createElement("div");
      row.className = "item";
      if (price === null) {
        row.innerHTML = `<span class="up-info"><span>${def.name} <span class="note">ур. ${level}/${def.prices.length}</span></span><span class="note">${def.description}</span></span><span class="val">макс.</span>`;
      } else {
        const affordable = canBuy(state.gold, state.upgrades, id);
        row.innerHTML = `<span class="up-info"><span>${def.name} <span class="note">ур. ${level}/${def.prices.length}</span></span><span class="note">${def.description}</span></span>`;
        const btn = document.createElement("button");
        btn.textContent = `${price} зм.`;
        btn.dataset.buy = id;
        btn.disabled = !affordable;
        btn.style.padding = "2px 10px";
        btn.style.fontSize = "13px";
        row.appendChild(btn);
      }
      upgradesEl.appendChild(row);
    }

    const sellBtn = this.$("sell-btn");
    const earned = Math.round(totalValue(state.inventory) * sellMultiplier(state.upgrades));
    sellBtn.disabled = loot.length === 0;
    sellBtn.textContent = loot.length ? `Продать всё (+${earned} зм.)` : "Продать всё";

    const fineBtn = this.$("fine-btn");
    const fine = fineFor(state.wanted);
    if (fine > 0) {
      fineBtn.classList.remove("hidden");
      fineBtn.textContent = `Уладить с властями (${fine} зм.)`;
      fineBtn.disabled = state.gold < fine;
    } else {
      fineBtn.classList.add("hidden");
    }
  }

  showEnd(title, text, victory = false) {
    this.endTitle.textContent = title;
    this.endTitle.style.color = victory ? "#d8b25a" : "#c94a3e";
    this.endText.textContent = text;
    this.$("continue-btn").classList.toggle("hidden", !victory);
    this.endEl.classList.remove("hidden");
  }

  hideEnd() {
    this.endEl.classList.add("hidden");
  }
}
