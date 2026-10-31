import { UPGRADES, priceOf, canBuy, fineFor, sellMultiplier } from "./economy.js";
import { totalValue } from "./inventory.js";
import { contractName } from "./contracts.js";
import { STYLE_LABELS, STYLE_HINTS, archetypeLabel } from "./style.js";
import { UNLOCKS, UNLOCK_ORDER, canUnlock } from "./profile.js";
import { phaseLabel } from "./daynight.js";

export class UI {
  constructor(handlers) {
    this.handlers = handlers;
    this.$ = (id) => document.getElementById(id);

    this.hpFill = this.$("hp-fill");
    this.hpText = this.$("hp-text");
    this.stFill = this.$("st-fill");
    this.stText = this.$("st-text");
    this.noiseFill = this.$("noise-fill");
    this.noiseText = this.$("noise-text");
    this.bleedEl = this.$("bleed");
    this.goldEl = this.$("gold");
    this.repEl = this.$("rep");
    this.phaseEl = this.$("phase");
    this.wantedEl = this.$("wanted");
    this.objectiveEl = this.$("objective");
    this.promptEl = this.$("prompt");
    this.progressEl = this.$("progress");
    this.progressFill = this.$("progress-fill");
    this.messagesEl = this.$("messages");
    this.crosshair = this.$("crosshair");
    this.contractEl = this.$("contract");
    this.fameEl = this.$("fame");

    this.overhealEl = this.$("overheal-bar");
    this.overhealFill = this.$("overheal-fill");
    this.overhealText = this.$("overheal-text");
    this.courtesanEl = this.$("courtesan");

    this.startEl = this.$("start");
    this.pauseEl = this.$("pause");
    this.tradeEl = this.$("trade");
    this.helpEl = this.$("help");
    this.endEl = this.$("end");
    this.endTitle = this.$("end-title");
    this.endText = this.$("end-text");

    this.$("start-btn").addEventListener("click", () => this.handlers.start?.());
    this.$("continue-btn")?.addEventListener("click", () => this.handlers.continueGame?.());
    this.$("load-btn")?.addEventListener("click", () => this.handlers.load?.());
    this.$("resume-btn").addEventListener("click", () => this.handlers.resume?.());
    this.$("restart-btn").addEventListener("click", () => this.handlers.restart?.());
    this.$("close-help").addEventListener("click", () => this.handlers.closeHelp?.());
    this.$("close-trade").addEventListener("click", () => this.handlers.closeTrade?.());
    this.$("sell-btn").addEventListener("click", () => this.handlers.sell?.());
    this.$("fine-btn").addEventListener("click", () => this.handlers.fine?.());
    this.$("trade-upgrades").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-buy]");
      if (btn) this.handlers.buy?.(btn.dataset.buy);
    });
    this.$("contract-board").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-contract]");
      if (btn) this.handlers.acceptContract?.(Number(btn.dataset.contract));
    });
    this.$("unlocks").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-unlock]");
      if (btn) this.handlers.unlock?.(btn.dataset.unlock);
    });
    this.$("loot-pick").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-take]");
      if (btn) this.handlers.takeLoot?.(Number(btn.dataset.take));
    });
    this.$("loot-done").addEventListener("click", () => this.handlers.finishLoot?.());
    this.$("courtesan-pay").addEventListener("click", () => this.handlers.courtesanPay?.());
    this.$("courtesan-ask").addEventListener("click", () => this.handlers.courtesanAsk?.());
    this.$("courtesan-leave").addEventListener("click", () => this.handlers.courtesanLeave?.());
    this.$("advice-close").addEventListener("click", () => this.handlers.closeAdvice?.());
    this.$("console-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = this.$("console-input");
      const value = input.value;
      input.value = "";
      this.handlers.consoleCommand?.(value);
    });

    this.hitTimer = null;
    this.fameText = "";
  }

  update(state) {
    const p = state.player;
    const hp = Math.max(0, Math.ceil(p.health));
    this.hpFill.style.width = `${Math.max(0, (p.health / p.maxHealth) * 100)}%`;
    this.hpText.textContent = `${hp} / ${p.maxHealth}`;
    this.stFill.style.width = `${Math.max(0, (p.stamina / p.maxStamina) * 100)}%`;
    this.stText.textContent = `${Math.ceil(p.stamina)}`;

    if (this.noiseFill) {
      const noise = Math.max(0, Math.min(1, state.noiseLevel || 0));
      this.noiseFill.style.width = `${noise * 100}%`;
      if (this.noiseText) this.noiseText.textContent = this.noiseLabel(noise);
    }

    this.goldEl.textContent = `${state.gold} зм.`;

    // Запас бодрости: отдельная полоска, только когда он есть.
    if (this.overhealEl) {
      const over = Math.max(0, Math.min(25, p.overheal || 0));
      if (over > 0.05) {
        this.overhealEl.classList.remove("hidden");
        this.overhealFill.style.width = `${(over / 25) * 100}%`;
        this.overhealText.textContent = `+${Math.ceil(over)}`;
      } else {
        this.overhealEl.classList.add("hidden");
      }
    }

    if (this.repEl) this.repEl.textContent = `Репутация: ${state.reputation || 0}`;
    if (this.phaseEl) {
      const wet = state.wet && state.weatherLabel ? ` · ${state.weatherLabel}` : "";
      this.phaseEl.textContent = `${phaseLabel(state.phase || "day")}${wet}`;
    }

    if (state.wanted > 0) {
      this.wantedEl.classList.remove("hidden");
      this.wantedEl.textContent = `Розыск: ${"★".repeat(Math.min(5, state.wanted))}`;
    } else {
      this.wantedEl.classList.add("hidden");
    }

    if (this.bleedEl) {
      if (state.bleed && state.bleed.remaining > 0) {
        this.bleedEl.classList.remove("hidden");
        this.bleedEl.textContent = `Кровотечение: ${Math.ceil(state.bleed.remaining)} с`;
      } else {
        this.bleedEl.classList.add("hidden");
      }
    }

    this.renderContract(state);
    this.renderFame(state);
  }

  noiseLabel(noise) {
    if (noise < 0.2) return "тихо";
    if (noise < 0.7) return "шумно";
    return "очень шумно";
  }

  renderContract(state) {
    if (!this.contractEl) return;
    const contract = state.activeContract;
    if (!contract) {
      this.contractEl.classList.add("hidden");
      return;
    }
    this.contractEl.classList.remove("hidden");
    const deadline =
      contract.deadline && state.contractTimeLeft !== null && state.contractTimeLeft !== undefined
        ? ` · осталось ${Math.max(0, Math.ceil(state.contractTimeLeft))} с`
        : "";
    this.contractEl.textContent = `Контракт: ${contractName(contract.type)} — ${contract.description}${deadline}`;
  }

  renderFame(state) {
    if (!this.fameEl) return;
    const label = STYLE_LABELS[state.styleKey] || STYLE_LABELS.neutral;
    const hint = STYLE_HINTS[state.styleKey] || STYLE_HINTS.neutral;
    const camp = archetypeLabel(state.archetype);
    const text = `${label} · ${camp}. ${hint}`;
    if (text !== this.fameText) {
      this.fameText = text;
      this.fameEl.textContent = text;
    }
    this.fameEl.classList.toggle("hidden", state.styleKey === "neutral" && !state.suppressFame);
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

  showStart(hasSave) {
    this.startEl.classList.remove("hidden");
    const loadBtn = this.$("load-btn");
    if (loadBtn) loadBtn.classList.toggle("hidden", !hasSave);
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

  // ── Куртизанка ────────────────────────────────────────────────────

  openCourtesan(view) {
    this.courtesanEl.classList.remove("hidden");
    this.$("courtesan-name").textContent = view.displayName;
    this.$("courtesan-temper").textContent = `${view.temperLabel} · ${view.description}`;
    this.$("courtesan-line").textContent = view.line;
    this.$("courtesan-info").textContent = view.info;

    const rumorEl = this.$("courtesan-rumor");
    rumorEl.innerHTML = "";
    rumorEl.classList.add("hidden");

    const payBtn = this.$("courtesan-pay");
    payBtn.disabled = !view.canPay;
    // Привязанность меняет не только цену, но и надпись на кнопке.
    payBtn.textContent = view.free ? "Остаться (бесплатно)" : `Заплатить ${view.price} зм.`;

    const askBtn = this.$("courtesan-ask");
    askBtn.disabled = Boolean(view.rumorUsed);
    askBtn.textContent = view.rumorUsed ? "Больше нечего сказать" : "Что слышно?";
  }

  showCourtesanRumor(text) {
    const el = this.$("courtesan-rumor");
    el.classList.remove("hidden");
    el.innerHTML = "";
    const row = document.createElement("div");
    row.className = "item";
    row.textContent = text;
    el.appendChild(row);

    // Слух выдаётся один раз за визит: кнопку гасим сразу,
    // иначе её можно жать бесконечно и фармить подсказки.
    const askBtn = this.$("courtesan-ask");
    askBtn.disabled = true;
    askBtn.textContent = "Больше нечего сказать";
  }

  setCourtesanLine(text) {
    this.$("courtesan-line").textContent = text;
  }

  closeCourtesan() {
    this.courtesanEl.classList.add("hidden");
  }

  get courtesanOpen() {
    return !this.courtesanEl.classList.contains("hidden");
  }

  // ── Консоль разработчика ──────────────────────────────────────────

  openConsole() {
    this.$("console").classList.remove("hidden");
    const input = this.$("console-input");
    input.value = "";
    setTimeout(() => input.focus(), 0);
  }

  closeConsole() {
    this.$("console").classList.add("hidden");
  }

  get consoleOpen() {
    return !this.$("console").classList.contains("hidden");
  }

  consolePrint(text, kind = "out") {
    const log = this.$("console-log");
    const line = document.createElement("div");
    line.className = kind;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    // Историю не копим бесконечно.
    while (log.children.length > 200) log.removeChild(log.firstChild);
  }

  consoleClear() {
    this.$("console-log").innerHTML = "";
  }

  consoleFocus() {
    this.$("console-input").focus();
  }

  consoleInput() {
    return this.$("console-input");
  }

  // ── Панель целей и советов ────────────────────────────────────────

  openAdvice(panel) {
    this.$("advice").classList.remove("hidden");
    this.$("advice-objective").textContent = panel.objective;
    this.$("advice-progress").textContent =
      `${panel.progress.current} / ${panel.progress.goal} зм. (${panel.progress.percent}%)` +
      (panel.act ? ` · ${panel.act.label}` : "");

    const tips = this.$("advice-tips");
    tips.innerHTML = "";
    if (!panel.tips.length) {
      tips.innerHTML = '<div class="item empty">Советов нет — всё идёт как надо.</div>';
    } else {
      for (const tip of panel.tips) {
        const row = document.createElement("div");
        row.className = "item";
        row.textContent = tip;
        tips.appendChild(row);
      }
    }
  }

  closeAdvice() {
    this.$("advice").classList.add("hidden");
  }

  get adviceOpen() {
    return !this.$("advice").classList.contains("hidden");
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
    const earned = Math.round(totalValue(state.inventory) * sellMultiplier(state.upgrades, state.priceModifier || 1));
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

    this.renderContractBoard(state);
    this.renderUnlocks(state);
  }

  renderContractBoard(state) {
    const board = this.$("contract-board");
    if (!board) return;
    const offers = state.contractOffer || [];
    board.innerHTML = "";

    if (state.activeContract) {
      const active = document.createElement("div");
      active.className = "item contract-active";
      active.textContent = `В работе: ${contractName(state.activeContract.type)} — ${state.activeContract.description}`;
      board.appendChild(active);
      return;
    }

    if (offers.length === 0) {
      board.innerHTML = '<div class="item empty">Заказов нет. Мардо ждёт следующего каравана.</div>';
      return;
    }

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const row = document.createElement("div");
      row.className = "item";
      const info = document.createElement("span");
      info.className = "up-info";
      info.innerHTML = `<span>${contractName(offer.type)} <span class="note">+${offer.reward.gold} зм. · +${offer.reward.rep} реп.</span></span><span class="note">${offer.description}</span>`;
      row.appendChild(info);
      const btn = document.createElement("button");
      btn.textContent = "Взять";
      btn.dataset.contract = String(i);
      btn.style.padding = "2px 10px";
      btn.style.fontSize = "13px";
      row.appendChild(btn);
      board.appendChild(row);
    }
  }

  renderUnlocks(state) {
    const wrap = this.$("unlocks");
    if (!wrap) return;
    const profile = state.profile;
    wrap.innerHTML = "";

    const head = document.createElement("div");
    head.className = "item";
    head.innerHTML = `<span>Репутация: <b>${profile.reputation || 0}</b></span><span class="note">копится за контракты и тихие кражи</span>`;
    wrap.appendChild(head);

    for (const id of UNLOCK_ORDER) {
      const def = UNLOCKS[id];
      const owned = profile.unlocks[id] > 0;
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `<span class="up-info"><span>${def.name}</span><span class="note">${def.description}</span></span>`;
      if (owned) {
        const tag = document.createElement("span");
        tag.className = "val";
        tag.textContent = "куплено";
        row.appendChild(tag);
      } else {
        const btn = document.createElement("button");
        btn.textContent = `${def.cost} реп.`;
        btn.dataset.unlock = id;
        btn.disabled = !canUnlock(profile, id);
        btn.style.padding = "2px 10px";
        btn.style.fontSize = "13px";
        row.appendChild(btn);
      }
      wrap.appendChild(row);
    }
  }

  openLoot(items) {
    this.$("loot").classList.remove("hidden");
    this.renderLoot(items);
  }

  renderLoot(items) {
    const list = this.$("loot-pick");
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = '<div class="item empty">Фургон пуст</div>';
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `<span class="up-info"><span>${item.name}</span><span class="note">${item.weight} кг</span></span><span class="val">${item.value} зм.</span>`;
      const btn = document.createElement("button");
      btn.textContent = "Взять";
      btn.dataset.take = String(i);
      btn.style.padding = "2px 10px";
      btn.style.fontSize = "13px";
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  closeLoot() {
    this.$("loot").classList.add("hidden");
  }

  get lootOpen() {
    return !this.$("loot").classList.contains("hidden");
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

  get endOpen() {
    return !this.endEl.classList.contains("hidden");
  }
}
