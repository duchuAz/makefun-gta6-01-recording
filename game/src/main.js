// MAIN.JS — composition root, controls, save state and the animation loop.
// Puerto Sol boots here: sky, city, player, traffic, missions, HUD and radio.
import * as THREE from 'three';
import { World } from './world.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { applyShot, SHOTS } from './shots.js';

const SAVE_KEY = 'puerto-sol-neon-tide-save-v1';

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.world = new World(this.canvas);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.city = new City(this.world.scene, this.world);
    this.player = new Player(this.world.scene, this.world, this.city, this.audio);
    this.traffic = new Traffic(this.world.scene, this.city, this.audio);
    this.missions = new Missions(this.world.scene, this.city, this.hud, this.player, this.traffic, this.audio);
    this.clock = new THREE.Clock();
    this.keys = new Set();
    this.interactQueued = false;
    this.started = false;
    this.paused = false;
    this.dead = false;
    this.shotMode = false;
    this.shotName = null;
    this.saveClock = 0;
    this.elapsed = 0;
    this.drag = null;
    this.saved = this.readSave();
  }

  async boot() {
    this.world.build();
    this.city.build();
    this.player.build();
    this.traffic.build();
    this.city.update(0);
    this.audio.onStation = (station) => {
      this.hud.setRadio(station.name, station.track);
    };
    this.hud.setRadio(this.audio.stationInfo.name, this.audio.stationInfo.track);
    this.bindUI();
    this.bindInput();
    const shot = new URLSearchParams(window.location.search).get('shot');
    if (shot && SHOTS[shot]) {
      this.shotMode = true;
      this.shotName = shot;
      this.started = true;
      this.hud.setShotMode();
      applyShot(shot, this);
      this.hud.update(0.016, this.state());
      this.flushHudPrompt();
      this.renderShot();
      window.__puertoSol = this;
      this.loop();
      return;
    }
    this.hud.showStart(Boolean(this.saved));
    this.hud.hideLoading();
    this.attractCamera();
    this.rendererWarmup();
    window.__puertoSol = this;
    this.loop();
  }

  rendererWarmup() {
    this.world.camera.position.set(120, 64, 90);
    this.world.camera.lookAt(10, 8, 0);
    this.world.render();
  }

  bindUI() {
    this.hud.bind({
      onStart: (continueRun) => this.start(continueRun),
      onResume: () => this.resume(),
      onSave: () => this.save(),
      onRestart: () => this.restart(),
      onHidden: () => { if (this.started) this.save(true); },
    });
    this.player.onWasted = () => this.wasted();
    this.player.onGunshot = () => {
      this.traffic.onGunshot();
      this.hud.toast('SHOTS FIRED · STARS RISING', 'red');
    };
    this.player.onModeChange = (mode) => {
      this.hud.toast(mode === 'car' ? 'SOLARA 88 · ENGINE READY' : 'ON FOOT · TEO CRUZ', 'teal');
    };
    this.traffic.onCrime = (message, stars) => {
      if (!message) return;
      if (message === 'Heat is cooling') this.hud.toast(message.toUpperCase(), 'teal');
      else if (message === 'You lost the police') this.hud.toast(message.toUpperCase(), 'teal');
      else if (message !== 'Traffic collision') this.hud.toast(message.toUpperCase(), stars > 0 ? 'red' : 'gold');
    };
  }

  bindInput() {
    window.addEventListener('keydown', (event) => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Escape') {
        if (!this.started || this.shotMode) return;
        if (this.paused) this.resume();
        else this.pause();
        return;
      }
      if (!this.started || this.shotMode) return;
      if (this.paused || this.dead) return;
      this.keys.add(event.code);
      if (event.code === 'KeyE' || event.code === 'Enter') this.interact();
      if (event.code === 'Tab') this.switchStation();
      if (event.code === 'KeyM') this.toggleMute();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.started || this.paused || this.shotMode || this.dead) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
      this.canvas.setPointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.player.applyLook(dx, dy);
    });
    const endDrag = (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      const shouldFire = this.drag.moved < 7 && this.player.mode === 'foot' && event.button !== 2;
      this.drag = null;
      if (shouldFire) this.player.tryShoot();
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', () => { this.drag = null; });
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      if (!this.started || this.shotMode) return;
      this.player.zoom(event.deltaY);
    }, { passive: false });
  }

  interact() {
    if (this.player.mode === 'car') {
      if (this.player.exitCar()) this.setCameraSoon();
      return;
    }
    const wantsMission = this.missions.active && this.missions.currentStep?.type === 'collect' && this.missions.objectiveDistance <= (this.missions.currentStep.radius ?? 6);
    if (wantsMission) {
      this.interactQueued = true;
      return;
    }
    if (this.player.nearCar) {
      if (this.player.enterCar()) this.setCameraSoon();
      return;
    }
    this.interactQueued = true;
  }

  setCameraSoon() {
    this.player.cameraShake = Math.min(this.player.cameraShake, 0.15);
    this.player.setCameraImmediate();
  }

  switchStation() {
    const station = this.audio.toggleStation();
    this.hud.setRadio(station.name, station.track);
    this.hud.toast(`RADIO · ${station.name}`, 'teal');
  }

  toggleMute() {
    if (!this.audio.started) return;
    this.audio.master.gain.value = this.audio.master.gain.value > 0.02 ? 0.0001 : 0.62;
    this.hud.toast(this.audio.master.gain.value > 0.02 ? 'SOUND ON' : 'SOUND OFF', 'teal');
  }

  start(continueRun = false) {
    this.audio.init();
    this.audio.setPaused(false);
    this.hud.hideStart();
    this.started = true;
    this.paused = false;
    this.dead = false;
    if (continueRun && this.saved) {
      this.applySave(this.saved);
      this.hud.toast('WELCOME BACK TO PUERTO SOL', 'gold');
    } else {
      this.newRun();
    }
    this.hud.setInteractPrompt(null);
    this.player.setCameraImmediate();
    this.clock.getDelta();
  }

  newRun() {
    this.player.money = 850;
    this.player.health = 100;
    this.player.armor = 35;
    this.player.car.health = 100;
    this.player.car.position.set(96.8, 0.06, 28);
    this.player.car.heading = 0;
    this.player.car.speed = 0;
    this.player.mode = 'car';
    this.player.characterGroup.visible = false;
    this.player.carModel.position.copy(this.player.car.position);
    this.player.carModel.rotation.y = 0;
    this.traffic.clearWanted();
    this.missions.start(0);
    this.hud.toast('PUERTO SOL · NEON TIDE', 'pink');
  }

  applySave(save) {
    this.player.money = Number(save.money) || 850;
    this.player.health = Number(save.health) || 100;
    this.player.armor = Number(save.armor) || 0;
    this.player.car.health = Number(save.carHealth) || 100;
    const car = save.car ?? {};
    this.player.car.position.set(car.x ?? 96.8, 0.06, car.z ?? 28);
    this.player.car.heading = car.heading ?? 0;
    this.player.car.speed = 0;
    this.player.carModel.position.copy(this.player.car.position);
    this.player.carModel.rotation.y = this.player.car.heading;
    if (car.mode === 'foot' && save.foot) {
      this.player.mode = 'foot';
      this.player.foot.position.set(save.foot.x, 0.3, save.foot.z);
      this.player.foot.heading = save.foot.heading ?? 0;
      this.player.footYaw = save.foot.heading ?? 0;
      this.player.characterGroup.visible = true;
      this.player.characterGroup.position.copy(this.player.foot.position);
      this.player.characterGroup.rotation.y = this.player.foot.heading;
    } else {
      this.player.mode = 'car';
      this.player.characterGroup.visible = false;
    }
    this.traffic.clearWanted();
    if (save.mission) {
      this.missions.start(save.mission.index ?? 0);
      if (Number.isInteger(save.mission.step) && save.mission.step > 0) {
        this.missions.step = Math.min(save.mission.step, 2);
        this.missions.configureStep();
      }
    } else {
      this.missions.start(0);
    }
  }

  save(silent = false) {
    if (!this.started || this.shotMode) return;
    const data = {
      v: 1,
      savedAt: Date.now(),
      money: this.player.money,
      health: this.player.health,
      armor: this.player.armor,
      carHealth: this.player.car.health,
      mission: { index: this.missions.index, step: this.missions.step },
      car: {
        x: this.player.car.position.x,
        z: this.player.car.position.z,
        heading: this.player.car.heading,
        mode: this.player.mode,
      },
      foot: this.player.mode === 'foot' ? {
        x: this.player.foot.position.x,
        z: this.player.foot.position.z,
        heading: this.player.foot.heading,
      } : null,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.saved = data;
      if (!silent) this.hud.showSave();
    } catch (error) {
      if (!silent) this.hud.toast('SAVE UNAVAILABLE', 'red');
    }
  }

  readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const save = JSON.parse(raw);
      return save && save.v === 1 ? save : null;
    } catch (error) {
      return null;
    }
  }

  restart() {
    this.saved = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (error) { /* private mode */ }
    this.hud.hidePause();
    this.paused = false;
    this.dead = false;
    this.player.respawning = false;
    this.player.mode = 'car';
    this.player.characterGroup.visible = false;
    this.player.cameraPitch = 0.27;
    this.newRun();
    this.player.setCameraImmediate();
  }

  pause() {
    this.paused = true;
    this.hud.showPause();
    this.audio.setPaused(true);
    this.save(true);
  }

  resume() {
    this.paused = false;
    this.hud.hidePause();
    this.audio.setPaused(false);
    this.clock.getDelta();
  }

  wasted() {
    if (this.dead) return;
    this.dead = true;
    this.hud.showDeath('WASTED', 'THE BAY SPITS YOU BACK OUT');
    this.hud.setInteractPrompt(null);
    this.traffic.clearWanted();
    this.audio.sfx('fail');
    window.setTimeout(() => {
      if (this.shotMode) return;
      this.player.respawn();
      this.player.money = Math.max(0, this.player.money - 500);
      this.dead = false;
      this.hud.hideDeath();
      this.hud.toast('HOSPITAL BILL · -$500', 'red');
      this.hud.showDialogue('TEO', 'Cheap stitches, expensive lesson. Back on the boulevard.', 4);
      this.player.setCameraImmediate();
    }, 2400);
  }

  attractCamera() {
    const angle = performance.now() * 0.000035;
    const camera = this.world.camera;
    camera.position.set(Math.cos(angle) * 150, 66, Math.sin(angle) * 150 + 20);
    camera.lookAt(5, 12, 0);
    this.world.update(0, 12, { x: 20, z: 0 });
  }

  readInput() {
    const pressed = this.keys;
    return {
      forward: pressed.has('KeyW') || pressed.has('ArrowUp'),
      back: pressed.has('KeyS') || pressed.has('ArrowDown'),
      left: pressed.has('KeyA') || pressed.has('ArrowLeft'),
      right: pressed.has('KeyD') || pressed.has('ArrowRight'),
      run: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
      brake: pressed.has('Space'),
      interact: this.interactQueued,
    };
  }

  state() {
    return {
      player: this.player,
      traffic: this.traffic,
      missions: this.missions,
      city: this.city,
      time: this.elapsed,
    };
  }

  flushHudPrompt() {
    if (!this.started) return;
    if (this.missions.promptVisible) return;
    if (this.player.mode === 'foot' && this.player.nearCar) {
      this.hud.setInteractPrompt('E  ENTER SOLARA 88');
    } else if (this.player.mode === 'car' && Math.abs(this.player.car.speed) < 3.1) {
      this.hud.setInteractPrompt('E  EXIT VEHICLE');
    } else {
      this.hud.setInteractPrompt(null);
    }
  }

  update(dt) {
    this.elapsed += dt;
    const input = this.readInput();
    this.player.update(dt, input);
    this.traffic.update(dt, this.player);
    this.missions.update(dt, input);
    this.interactQueued = false;
    this.city.update(this.elapsed);
    this.world.update(dt, this.elapsed, this.player.position);
    this.audio.update(dt, this.state());
    this.player.updateCamera(dt);
    this.hud.update(dt, this.state());
    this.flushHudPrompt();
    this.saveClock += dt;
    if (this.saveClock > 24) {
      this.saveClock = 0;
      this.save(true);
    }
  }

  updateAttract(dt) {
    this.elapsed += dt;
    this.player.update(dt, { forward: false, back: false, left: false, right: false, run: false, brake: false, interact: false });
    this.traffic.update(dt, this.player);
    this.city.update(this.elapsed);
    this.world.update(dt, this.elapsed, { x: 30, z: 0 });
    this.audio.update(dt, this.state());
    this.hud.update(dt, this.state());
    this.attractCamera();
  }

  renderShot() {
    this.city.update(8);
    this.world.update(0, 8, this.player.position);
    this.world.render();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    if (this.shotMode) {
      this.renderShot();
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused || this.dead) {
      this.world.render();
      return;
    }
    if (!this.started) {
      this.updateAttract(dt);
    } else {
      this.update(dt);
    }
    this.world.render();
  }
}

new Game().boot();

