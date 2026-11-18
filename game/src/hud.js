// HUD.JS — the sun-faded interface, minimap, mission card, dialogue and overlays.
// Everything is DOM and a 2D canvas, so it stays crisp at 1280x720.
import * as THREE from 'three';
import { ROADS, SHORE_X } from './city.js';
import { MISSION_DATA } from './missions.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.minimap = document.getElementById('minimap');
    this.ctx = this.minimap?.getContext('2d');
    this.mode = 'start';
    this.handlers = {};
    this.cache = {};
    this.toasts = [];
    this.dialogueQueue = [];
    this.dialogueTime = 0;
    this.promptText = null;
    this.radio = { name: 'MAR ABIERTO 98.7', track: 'TIDE FM — SUNSET DRIVE' };
    this.shotMode = false;
    this.clipPath = null;
    this.clockMinutes = 19 * 60 + 42;
    this.missionBannerTimer = 0;
    this.init();
  }

  init() {
    this.el = {
      healthFill: document.getElementById('health-fill'),
      armorFill: document.getElementById('armor-fill'),
      healthValue: document.getElementById('health-value'),
      armorValue: document.getElementById('armor-value'),
      money: document.getElementById('money-value'),
      wantedStars: document.getElementById('wanted-stars'),
      wantedBlock: document.getElementById('wanted-block'),
      missionCard: document.getElementById('mission-card'),
      missionKicker: document.getElementById('mission-kicker'),
      missionTitle: document.getElementById('mission-title'),
      missionObjective: document.getElementById('mission-objective'),
      missionDistance: document.getElementById('mission-distance'),
      missionTimer: document.getElementById('mission-timer'),
      missionProgress: document.getElementById('mission-progress-fill'),
      missionStep: document.getElementById('mission-step'),
      speed: document.getElementById('speed-value'),
      speedUnit: document.getElementById('speed-unit'),
      vehicle: document.getElementById('vehicle-name'),
      modeLabel: document.getElementById('mode-label'),
      radioName: document.getElementById('radio-name'),
      radioTrack: document.getElementById('radio-track'),
      clock: document.getElementById('clock'),
      toastStack: document.getElementById('toast-stack'),
      dialogue: document.getElementById('dialogue'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText: document.getElementById('dialogue-text'),
      prompt: document.getElementById('interact-prompt'),
      crosshair: document.getElementById('crosshair'),
      start: document.getElementById('start-screen'),
      startNew: document.getElementById('start-new'),
      startContinue: document.getElementById('start-continue'),
      pause: document.getElementById('pause-screen'),
      pauseResume: document.getElementById('pause-resume'),
      pauseSave: document.getElementById('pause-save'),
      pauseRestart: document.getElementById('pause-restart'),
      death: document.getElementById('death-overlay'),
      deathTitle: document.getElementById('death-title'),
      deathSub: document.getElementById('death-sub'),
      loading: document.getElementById('loading'),
      eventBanner: document.getElementById('event-banner'),
      eventKicker: document.getElementById('event-kicker'),
      eventTitle: document.getElementById('event-title'),
      eventCopy: document.getElementById('event-copy'),
      saveFlash: document.getElementById('save-flash'),
      mapDistance: document.getElementById('map-distance'),
      hint: document.getElementById('help-hint'),
    };
    this.el.wantedStars.innerHTML = '';
    this.stars = [];
    for (let i = 0; i < 5; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.textContent = '★';
      this.el.wantedStars.appendChild(star);
      this.stars.push(star);
    }
    this.el.startNew?.addEventListener('click', () => this.handlers.onStart?.(false));
    this.el.startContinue?.addEventListener('click', () => this.handlers.onStart?.(true));
    this.el.pauseResume?.addEventListener('click', () => this.handlers.onResume?.());
    this.el.pauseSave?.addEventListener('click', () => this.handlers.onSave?.());
    this.el.pauseRestart?.addEventListener('click', () => this.handlers.onRestart?.());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.handlers.onHidden?.();
    });
  }

  bind(handlers) {
    this.handlers = handlers;
  }

  update(dt, state) {
    const { player, traffic, missions, city } = state;
    this.clockMinutes += dt * 0.13;
    const hours = Math.floor((this.clockMinutes / 60) % 24);
    const minutes = Math.floor(this.clockMinutes % 60);
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    this.set(this.el.clock, clock, 'clock');
    const health = Math.ceil(player.health);
    const armor = Math.ceil(player.armor);
    if (this.cache.health !== health) {
      this.cache.health = health;
      this.el.healthFill.style.width = `${Math.max(0, health)}%`;
      this.el.healthValue.textContent = String(health);
    }
    if (this.cache.armor !== armor) {
      this.cache.armor = armor;
      this.el.armorFill.style.width = `${Math.max(0, armor)}%`;
      this.el.armorValue.textContent = String(armor);
    }
    if (this.cache.money !== player.money) {
      this.cache.money = player.money;
      this.el.money.textContent = `$${player.money.toLocaleString('en-US')}`;
    }
    for (let i = 0; i < this.stars.length; i++) {
      this.stars[i].classList.toggle('on', i < traffic.wanted);
    }
    this.el.wantedBlock.classList.toggle('hot', traffic.wanted > 0);
    if (player.mode === 'car') {
      this.set(this.el.speed, String(player.speedKmh), 'speed');
      this.set(this.el.speedUnit, 'KM/H', 'unit');
      this.set(this.el.modeLabel, 'DRIVING', 'mode');
      this.set(this.el.vehicle, player.carName, 'vehicle');
      this.el.vehicle.style.opacity = '1';
    } else {
      this.set(this.el.speed, '0', 'speed');
      this.set(this.el.speedUnit, 'ON FOOT', 'unit');
      this.set(this.el.modeLabel, 'WALKING', 'mode');
      this.set(this.el.vehicle, 'TEO CRUZ · THE STRIP', 'vehicle');
    }
    this.el.crosshair.classList.toggle('visible', player.mode === 'foot' && !this.shotMode);
    this.updateMission(missions, player);
    this.set(this.el.radioName, this.radio.name, 'radio');
    this.set(this.el.radioTrack, this.radio.track, 'track');
    this.drawMinimap(state);
    this.updateDialogue(dt);
    this.updateEventBanner(dt);
    if (this.el.mapDistance) {
      const dist = missions.active ? Math.round(missions.objectiveDistance) : 0;
      this.el.mapDistance.textContent = missions.active ? `${dist} m` : '-- m';
    }
    const healthCritical = player.health < 28;
    document.body.classList.toggle('critical', healthCritical);
    if (player.mode === 'foot') {
      this.set(this.el.hint, 'WASD MOVE · SHIFT SPRINT · E ENTER CAR · CLICK FIRE · ESC PAUSE', 'hintFoot');
    } else {
      this.set(this.el.hint, 'WASD DRIVE · SPACE BRAKE · E EXIT · SHIFT BOOST · TAB RADIO · ESC PAUSE', 'hintCar');
    }
  }

  updateMission(missions, player) {
    const active = missions.active;
    const mission = active ? MISSION_DATA[missions.index] : MISSION_DATA[missions.index];
    if (!mission) return;
    const step = active ? mission.steps[missions.step] : null;
    const cardVisible = active || (missions.nextStartDelay > 0 && !missions.allComplete);
    this.el.missionCard.classList.toggle('visible', Boolean(cardVisible));
    if (!cardVisible) return;
    const key = `${missions.index}-${missions.step}-${active}`;
    if (this.cache.missionKey !== key) {
      this.cache.missionKey = key;
      this.el.missionKicker.textContent = `JOB ${String(missions.index + 1).padStart(2, '0')} · ${mission.giver}`;
      this.el.missionTitle.textContent = mission.title;
      this.el.missionStep.textContent = active ? `${String(missions.step + 1).padStart(2, '0')} / ${String(mission.steps.length).padStart(2, '0')}` : 'COMPLETE';
    }
    if (active && step) {
      this.el.missionObjective.textContent = step.label;
      const dist = Math.round(Math.hypot(player.position.x - missions.currentTarget.x, player.position.z - missions.currentTarget.z));
      this.el.missionDistance.textContent = `${dist} m · ${step.place}`;
      if (mission.timeLimit) {
        const time = Math.max(0, Math.ceil(missions.timeLeft));
        this.el.missionTimer.textContent = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
        this.el.missionTimer.classList.remove('hidden');
        this.el.missionTimer.classList.toggle('urgent', time < 20);
      } else {
        this.el.missionTimer.classList.add('hidden');
      }
      let progress = 0;
      if ((step.type === 'stay' || step.type === 'escape') && dist <= step.radius) {
        const needed = step.type === 'escape' ? 4.2 : (step.stay ?? 1);
        progress = Math.min(1, missions.stayTime / needed);
      }
      this.el.missionProgress.style.width = `${progress * 100}%`;
      this.el.missionProgress.parentElement.classList.toggle('active', progress > 0);
    } else {
      this.el.missionObjective.textContent = missions.allComplete ? 'THE BAY IS OPEN' : 'JOB COMPLETE · NEXT CALL INCOMING';
      this.el.missionDistance.textContent = missions.allComplete ? 'PUERTO SOL' : 'STANDBY';
      this.el.missionProgress.style.width = '100%';
      this.el.missionTimer.classList.add('hidden');
    }
  }

  drawMinimap(state) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { player, traffic, missions, city } = state;
    const w = this.minimap.width;
    const h = this.minimap.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 5;
    const scale = 0.58;
    const px = player.position.x;
    const pz = player.position.z;
    const mapX = (x) => cx + (x - px) * scale;
    const mapY = (z) => cy + (z - pz) * scale;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#082e41';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0b4657';
    ctx.fillRect(mapX(SHORE_X), 0, w, h);
    ctx.fillStyle = '#273b3a';
    ctx.fillRect(0, mapY(-142), w, mapY(142) - mapY(-142));
    ctx.fillStyle = '#b79563';
    ctx.fillRect(mapX(110), 0, (SHORE_X - 110) * scale, h);
    ctx.fillStyle = '#d2b078';
    ctx.fillRect(mapX(122), 0, (SHORE_X - 122) * scale, h);
    ctx.fillStyle = 'rgba(28, 39, 47, 0.88)';
    for (const z of [-75, -25, 25, 75]) {
      ctx.fillRect(mapX(-94.5), mapY(z - 19.5), 39 * scale, 39 * scale);
      ctx.fillRect(mapX(-44.5), mapY(z - 19.5), 39 * scale, 39 * scale);
      ctx.fillRect(mapX(5.5), mapY(z - 19.5), 39 * scale, 39 * scale);
      ctx.fillRect(mapX(55.5), mapY(z - 19.5), 39 * scale, 39 * scale);
    }
    ctx.strokeStyle = 'rgba(247,231,197,0.16)';
    ctx.lineWidth = 1;
    for (const road of ROADS) {
      ctx.strokeStyle = 'rgba(231,207,160,0.33)';
      ctx.lineWidth = Math.max(3, 10 * scale);
      ctx.beginPath();
      ctx.moveTo(mapX(road), 0);
      ctx.lineTo(mapX(road), h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, mapY(road));
      ctx.lineTo(w, mapY(road));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,226,172,0.13)';
    ctx.lineWidth = 0.8;
    for (const building of city.buildings) {
      const bx = mapX(building.x - building.w / 2);
      const by = mapY(building.z - building.d / 2);
      const bw = Math.max(1.2, building.w * scale);
      const bh = Math.max(1.2, building.d * scale);
      if (bx + bw < 0 || by + bh < 0 || bx > w || by > h) continue;
      ctx.strokeRect(bx, by, bw, bh);
    }
    for (const ped of traffic.getPedPositions().slice(0, 20)) {
      const x = mapX(ped.x);
      const y = mapY(ped.z);
      if (Math.hypot(x - cx, y - cy) > radius - 3) continue;
      ctx.fillStyle = 'rgba(242,220,183,0.6)';
      ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
    }
    for (const car of traffic.getTrafficPositions()) {
      const x = mapX(car.x);
      const y = mapY(car.z);
      if (Math.hypot(x - cx, y - cy) > radius - 4) continue;
      ctx.fillStyle = 'rgba(255,213,144,0.7)';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const flash = Math.sin(performance.now() * 0.008) > 0;
    for (const cop of traffic.getCopPositions()) {
      const x = mapX(cop.x);
      const y = mapY(cop.z);
      if (Math.hypot(x - cx, y - cy) > radius - 3) continue;
      ctx.fillStyle = flash ? '#ff5368' : '#5c9fff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const landmark of city.landmarks.slice(0, 16)) {
      const x = mapX(landmark.x);
      const y = mapY(landmark.z);
      if (Math.hypot(x - cx, y - cy) > radius - 6) continue;
      ctx.fillStyle = `#${new THREE.Color(landmark.color).getHexString()}`;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (missions.active) {
      const tx = mapX(missions.currentTarget.x);
      const ty = mapY(missions.currentTarget.z);
      const distToCenter = Math.hypot(tx - cx, ty - cy);
      const clampX = distToCenter > radius - 14 ? cx + ((tx - cx) / distToCenter) * (radius - 14) : tx;
      const clampY = distToCenter > radius - 14 ? cy + ((ty - cy) / distToCenter) * (radius - 14) : ty;
      ctx.strokeStyle = 'rgba(255,207,104,0.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(clampX, clampY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(clampX, clampY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffcf68';
      ctx.fillRect(-4.2, -4.2, 8.4, 8.4);
      ctx.strokeStyle = '#fff2c9';
      ctx.lineWidth = 1;
      ctx.strokeRect(-4.2, -4.2, 8.4, 8.4);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-player.heading);
    ctx.fillStyle = player.mode === 'car' ? '#ff745c' : '#ffd78f';
    ctx.strokeStyle = '#fff7e4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.4, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-5.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,232,193,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,207,104,0.3)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffdda1';
    ctx.font = '700 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - radius + 13);
    ctx.restore();
  }

  set(el, value, key) {
    if (!el) return;
    if (key && this.cache[key] === value) return;
    if (key) this.cache[key] = value;
    el.textContent = value;
  }

  setInteractPrompt(text) {
    this.promptText = text;
    if (!this.el.prompt) return;
    if (!text) {
      this.el.prompt.classList.remove('visible');
    } else {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.add('visible');
    }
  }

  showDialogue(speaker, text, seconds = 5) {
    this.dialogueQueue.push({ speaker, text, seconds });
    if (this.dialogueQueue.length > 3) this.dialogueQueue.shift();
    if (this.dialogueTime <= 0) this.advanceDialogue();
  }

  advanceDialogue() {
    const next = this.dialogueQueue.shift();
    if (!next) {
      this.dialogueTime = 0;
      this.el.dialogue.classList.remove('visible');
      return;
    }
    this.currentDialogue = next;
    this.dialogueTime = next.seconds;
    this.el.dialogueSpeaker.textContent = next.speaker;
    this.el.dialogueText.textContent = next.text;
    this.el.dialogue.classList.add('visible');
  }

  updateDialogue(dt) {
    if (this.dialogueTime > 0) {
      this.dialogueTime -= dt;
      if (this.dialogueTime <= 0) this.advanceDialogue();
    }
  }

  toast(message, tone = 'gold') {
    const el = document.createElement('div');
    el.className = `toast toast-${tone}`;
    el.textContent = message;
    this.el.toastStack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 450);
    }, 3200);
  }

  setRadio(name, track) {
    this.radio.name = name;
    this.radio.track = track;
    this.cache.radio = null;
    this.cache.track = null;
  }

  missionStart(mission) {
    this.el.missionCard.classList.add('visible', 'flash');
    setTimeout(() => this.el.missionCard.classList.remove('flash'), 900);
  }

  missionUpdate(mission, step, distance, timeLeft, stayTime, stepData) {
    // The live minimap and panel read the mission system directly on the next frame.
  }

  missionComplete(mission) {
    this.showEvent('JOB COMPLETE', mission.title, `+$${mission.reward.toLocaleString('en-US')} · ${mission.giver}`);
    this.el.missionCard.classList.add('complete');
    setTimeout(() => this.el.missionCard.classList.remove('complete'), 1200);
  }

  missionFailed(reason) {
    this.showEvent('JOB FAILED', 'THE TIDE TURNED', reason);
  }

  showEvent(kicker, title, copy, duration = 3.6) {
    this.el.eventKicker.textContent = kicker;
    this.el.eventTitle.textContent = title;
    this.el.eventCopy.textContent = copy;
    this.el.eventBanner.classList.add('visible');
    this.missionBannerTimer = duration;
  }

  updateEventBanner(dt) {
    if (this.missionBannerTimer > 0) {
      this.missionBannerTimer -= dt;
      if (this.missionBannerTimer <= 0) this.el.eventBanner.classList.remove('visible');
    }
  }

  showStart(hasSave) {
    this.mode = 'start';
    this.el.start.classList.add('visible');
    this.el.startContinue.classList.toggle('hidden', !hasSave);
    this.el.loading?.classList.add('gone');
    document.body.classList.add('at-start');
  }

  hideStart() {
    this.mode = 'playing';
    this.el.start.classList.remove('visible');
    document.body.classList.remove('at-start');
  }

  showPause() {
    this.mode = 'paused';
    this.el.pause.classList.add('visible');
  }

  hidePause() {
    this.mode = 'playing';
    this.el.pause.classList.remove('visible');
  }

  showDeath(title, subtitle) {
    this.el.deathTitle.textContent = title;
    this.el.deathSub.textContent = subtitle;
    this.el.death.classList.add('visible');
  }

  hideDeath() {
    this.el.death.classList.remove('visible');
  }

  showSave() {
    this.el.saveFlash.classList.add('visible');
    setTimeout(() => this.el.saveFlash.classList.remove('visible'), 1600);
  }

  hideLoading() {
    this.el.loading?.classList.add('gone');
  }

  setShotMode() {
    this.shotMode = true;
    document.body.classList.add('shot-mode');
    this.el.start.classList.remove('visible');
    this.el.pause.classList.remove('visible');
    this.el.death.classList.remove('visible');
    this.el.loading?.classList.add('gone');
    this.el.dialogue.classList.add('visible');
    document.body.classList.remove('at-start');
  }
}

