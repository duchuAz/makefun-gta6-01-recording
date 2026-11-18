// MISSIONS.JS — three jobs for a courier who owes the wrong people.
// The story moves from a diner on the north strip to the neon room, the market,
// the piers, and finally a police-lit escape through Coral Court.
import * as THREE from 'three';
import { clamp, makeBeamTexture, neonMaterial } from './neon.js';

export const MISSION_DATA = [
  {
    id: 'ledger',
    title: 'THE LEDGER',
    giver: 'RAFA MAREA',
    color: 0xffc960,
    blurb: 'A debt, a book, and a very short window.',
    reward: 1200,
    intro: {
      speaker: 'RAFA MAREA',
      text: "Teo! My favorite courier with the worst timing. The ledger at Casa Neon has every name that keeps this bay afloat. Bring it to Marina Vista before the tide turns.",
    },
    steps: [
      {
        type: 'goto',
        label: 'Meet Rafa at the Tideline Diner',
        place: 'TIDELINE DINER',
        target: [-25, 0.3, 50],
        radius: 7,
        dialogue: { speaker: 'RAFA MAREA', text: "Look at you, still breathing. The ledger is in the back booth at Casa Neon. The pink one. Don't touch the champagne." },
      },
      {
        type: 'collect',
        label: 'Collect the ledger from Casa Neon',
        place: 'CASA NEON',
        target: [57.4, 0.3, -25],
        radius: 6,
        prompt: 'E  TAKE THE LEDGER',
        dialogue: { speaker: 'LUNA VELASCO', text: "That book has my name in it three times. Make sure it gets to the marina, and we'll call the tab even." },
      },
      {
        type: 'deliver',
        label: 'Deliver the ledger to Marina Vista',
        place: 'MARINA VISTA',
        target: [143, 0.3, -35],
        radius: 8,
        dialogue: { speaker: 'RAFA MAREA', text: "No names on the book. No names on the boat. You did good, Teo. Don't spend it all on that car." },
      },
    ],
  },
  {
    id: 'neon-run',
    title: 'NEON RUN',
    giver: 'LUNA VELASCO',
    color: 0x58eadf,
    blurb: 'Three drops. One sunset. No excuses.',
    reward: 2400,
    timeLimit: 100,
    intro: {
      speaker: 'LUNA VELASCO',
      text: "My couriers went on strike and the gala starts when the neon comes on. Three drops: the market, Plaza Miramar, and the Muelle. Break the clock, Teo.",
    },
    steps: [
      {
        type: 'goto',
        label: 'Make the drop at Mercado del Mar',
        place: 'MERCADO DEL MAR',
        target: [55, 0.3, 25],
        radius: 7,
        dialogue: { speaker: 'LUNA VELASCO', text: "First parcel is under the yellow awning. Don't let the fish guy talk to you." },
      },
      {
        type: 'goto',
        label: 'Make the drop at Plaza Miramar',
        place: 'PLAZA MIRAMAR',
        target: [-62, 0.3, -25],
        radius: 7,
        dialogue: { speaker: 'LUNA VELASCO', text: "Second parcel. The fountain is just a fountain, Teo. Keep moving." },
      },
      {
        type: 'goto',
        label: 'Make the drop at Muelle Sol',
        place: 'MUELLE SOL',
        target: [146, 0.3, 63],
        radius: 8,
        dialogue: { speaker: 'LUNA VELASCO', text: "Last one. The wheel is lit tonight. If you make it before the gala, the drinks are on the house." },
      },
    ],
  },
  {
    id: 'tide-pressure',
    title: 'TIDE PRESSURE',
    giver: 'RAFA MAREA',
    color: 0xff6f9c,
    blurb: 'The beacon sings, the police dance.',
    reward: 5000,
    intro: {
      speaker: 'RAFA MAREA',
      text: "The bay is mine again, but the port cops want a piece. Plant the beacon under the Muelle, then let them follow you to Coral Court. Don't get cute.",
    },
    steps: [
      {
        type: 'stay',
        label: 'Plant the beacon at Muelle Sol',
        place: 'MUELLE SOL',
        target: [148, 0.3, 67],
        radius: 8,
        stay: 5,
        prompt: 'STAY IN THE ZONE TO PLANT THE BEACON',
        dialogue: { speaker: 'RAFA MAREA', text: "Five seconds under the boards. Then the police radio will sing your name. That's the point, remember?" },
      },
      {
        type: 'escape',
        label: 'Shake the police at Coral Court',
        place: 'CORAL COURT',
        target: [-75, 0.3, 63],
        radius: 8,
        stay: 0,
        dialogue: { speaker: 'RAFA MAREA', text: "The motel's got a back gate and the manager owes me a favor. Lose them in the pink lights and call it a night." },
      },
    ],
  },
];

export class Missions {
  constructor(scene, city, hud, player, traffic, audio) {
    this.scene = scene;
    this.city = city;
    this.hud = hud;
    this.player = player;
    this.traffic = traffic;
    this.audio = audio;
    this.index = 0;
    this.step = 0;
    this.active = false;
    this.completed = false;
    this.allComplete = false;
    this.stayTime = 0;
    this.timeLeft = 0;
    this.nextStartDelay = 0;
    this.pendingIndex = 0;
    this.promptVisible = false;
    this.time = 0;
    this.marker = new THREE.Group();
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.buildTextView = false;
    this.beamTexture = makeBeamTexture();
    this.currentTarget = new THREE.Vector3();
    this.buildMarker();
  }

  buildMarker() {
    const gold = 0xffcf68;
    this.markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.14, 6, 40),
      new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }),
    );
    this.markerRing.rotation.x = -Math.PI / 2;
    this.markerRing.position.y = 0.14;
    this.marker.add(this.markerRing);
    this.markerDisk = new THREE.Mesh(
      new THREE.CircleGeometry(3.0, 36),
      new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.18, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
    );
    this.markerDisk.rotation.x = -Math.PI / 2;
    this.markerDisk.position.y = 0.12;
    this.marker.add(this.markerDisk);
    this.markerInner = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.8, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff3c7, transparent: true, opacity: 0.42, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
    );
    this.markerInner.rotation.x = -Math.PI / 2;
    this.markerInner.position.y = 0.16;
    this.marker.add(this.markerInner);
    this.beamMat = new THREE.MeshBasicMaterial({ map: this.beamTexture, color: 0xffce75, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    for (let i = 0; i < 2; i++) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 20), this.beamMat);
      beam.position.y = 10;
      beam.rotation.y = i * Math.PI / 2;
      this.marker.add(beam);
    }
    this.markerDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), neonMaterial(0xffdd8a, 1.4));
    this.markerDiamond.position.y = 4.2;
    this.marker.add(this.markerDiamond);
    this.markerLight = new THREE.PointLight(0xffbd62, 6, 14, 2);
    this.markerLight.position.y = 1;
    this.marker.add(this.markerLight);
  }

  startInitial() {
    this.start(0);
  }

  start(index = 0) {
    if (index >= MISSION_DATA.length) {
      this.allComplete = true;
      this.active = false;
      this.marker.visible = false;
      return;
    }
    const mission = MISSION_DATA[index];
    this.index = index;
    this.step = 0;
    this.active = true;
    this.completed = false;
    this.stayTime = 0;
    this.timeLeft = mission.timeLimit ?? 0;
    this.nextStartDelay = 0;
    this.traffic.clearWanted();
    this.configureStep();
    this.hud.missionStart?.(mission);
    this.hud.showDialogue?.(mission.intro.speaker, mission.intro.text, 7.5);
    this.hud.toast?.(`NEW JOB · ${mission.title}`, 'pink');
    this.audio?.sfx('mission');
  }

  configureStep() {
    const mission = MISSION_DATA[this.index];
    const step = mission.steps[this.step];
    const [x, y, z] = step.target;
    this.currentTarget.set(x, y, z);
    this.marker.position.set(x, y, z);
    this.marker.visible = true;
    const color = mission.color;
    this.markerRing.material.color.setHex(color);
    this.markerDisk.material.color.setHex(color);
    this.markerDiamond.material.color.setHex(color).multiplyScalar(1.3);
    this.beamMat.color.setHex(color);
    this.markerLight.color.setHex(color);
    this.stayTime = 0;
    this.promptVisible = false;
    if (step.dialogue && this.step > 0) this.hud.showDialogue?.(step.dialogue.speaker, step.dialogue.text, 5.5);
    this.hud.missionUpdate?.(mission, this.step, 0);
    this.audio?.sfx('objective');
  }

  update(dt, input) {
    this.time += dt;
    this.animateMarker(dt);
    if (!this.active) {
      if (this.nextStartDelay > 0) {
        this.nextStartDelay -= dt;
        if (this.nextStartDelay <= 0) {
          this.pendingIndex += 1;
          if (this.pendingIndex < MISSION_DATA.length) this.start(this.pendingIndex);
        }
      }
      return;
    }
    const mission = MISSION_DATA[this.index];
    const step = mission.steps[this.step];
    if (mission.timeLimit) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) {
        this.fail('The clock beat you to the last drop.');
        return;
      }
    }
    const distance = Math.hypot(this.player.position.x - step.target[0], this.player.position.z - step.target[2]);
    const inside = distance <= step.radius;
    let prompt = null;
    if (inside && (step.type === 'stay' || step.type === 'escape')) {
      this.stayTime += dt;
      if (step.type === 'stay') prompt = step.prompt ?? 'STAY IN THE ZONE';
      if (step.type === 'escape') prompt = 'HOLD THE SAFEHOUSE UNTIL THE HEAT DIES';
      if (step.stay && this.stayTime >= step.stay) this.completeStep();
      if (step.type === 'escape' && this.stayTime > 4.2) this.completeStep();
    } else if (inside && (step.type === 'collect')) {
      prompt = step.prompt ?? 'E  INTERACT';
      if (input.interact) this.completeStep();
    } else if (inside && (step.type === 'goto' || step.type === 'deliver')) {
      this.completeStep();
    } else {
      if (!inside) this.stayTime = Math.max(0, this.stayTime - dt * 2);
    }
    if (this.step >= mission.steps.length) return;
    this.setPrompt(prompt);
    this.hud.missionUpdate?.(mission, this.step, distance, this.timeLeft, this.stayTime, step);
  }

  animateMarker(dt) {
    if (!this.marker.visible) return;
    this.markerRing.rotation.z += dt * 0.45;
    this.markerInner.rotation.z -= dt * 0.7;
    this.markerDiamond.rotation.y += dt * 1.6;
    this.markerDiamond.position.y = 4.2 + Math.sin(this.time * 2.1) * 0.35;
    this.markerDisk.material.opacity = 0.16 + Math.sin(this.time * 2.4) * 0.05;
  }

  setPrompt(text) {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    this.promptVisible = Boolean(text);
    this.hud.setInteractPrompt?.(text);
  }

  completeStep() {
    const mission = MISSION_DATA[this.index];
    const step = mission.steps[this.step];
    this.audio?.sfx(step.type === 'collect' ? 'pickup' : 'objective');
    this.hud.toast?.(step.type === 'deliver' ? 'DROP CONFIRMED' : 'OBJECTIVE CLEARED', 'teal');
    this.setPrompt(null);
    const beaconJob = mission.id === 'tide-pressure' && this.step === 0;
    this.step += 1;
    if (beaconJob) {
      this.applyMissionHeat();
      this.hud.showDialogue?.('POLICE RADIO', 'All units, beacon signal from Muelle Sol. Suspect is in a red Solara. Block the coast road.', 5.5);
    }
    if (this.step >= mission.steps.length) {
      this.completeMission();
    } else {
      this.stayTime = 0;
      this.configureStep();
    }
  }

  completeMission() {
    const mission = MISSION_DATA[this.index];
    this.active = false;
    this.marker.visible = false;
    this.player.addMoney(mission.reward);
    this.audio?.sfx('success');
    this.hud.missionComplete?.(mission);
    this.hud.toast?.(`$${mission.reward.toLocaleString('en-US')} EARNED`, 'gold');
    if (mission.id === 'tide-pressure') {
      this.traffic.clearWanted();
      this.allComplete = true;
      this.hud.showDialogue?.('RAFA MAREA', "The bay belongs to us tonight, Teo. Radio says the sunrise is going to be loud.", 8);
      this.hud.toast?.('STORY COMPLETE · THE BAY IS OPEN', 'pink');
    } else {
      this.pendingIndex = this.index;
      this.nextStartDelay = 6;
      this.hud.showDialogue?.(mission.giver, mission.id === 'ledger' ? "The marina is clean. But the market is still waiting. One more job, and you're square with me." : "The gala is saved. Now the hard part: staying out of the papers.", 6);
    }
  }

  fail(reason) {
    if (!this.active) return;
    this.active = false;
    this.marker.visible = false;
    this.traffic.clearWanted();
    this.hud.missionFailed?.(reason);
    this.hud.toast?.('MISSION FAILED · RETRYING', 'red');
    this.hud.showDialogue?.('LUNA VELASCO', "That was painful to watch. Catch your breath. We'll run it again in a minute.", 5);
    this.audio?.sfx('fail');
    this.pendingIndex = this.index - 1;
    this.nextStartDelay = 7;
  }

  applyMissionHeat() {
    if (MISSION_DATA[this.index]?.id === 'tide-pressure') this.traffic.addWanted(2, 'The beacon is singing');
  }

  animateIdle(dt) {
    this.time += dt;
    this.animateMarker(dt);
  }

  get currentMission() {
    return this.active ? MISSION_DATA[this.index] : null;
  }

  get currentStep() {
    return this.active ? MISSION_DATA[this.index].steps[this.step] : null;
  }

  get objectiveDistance() {
    if (!this.active) return 0;
    return Math.hypot(this.player.position.x - this.currentTarget.x, this.player.position.z - this.currentTarget.z);
  }

  showForShot(index, stepIndex) {
    this.index = index;
    this.step = stepIndex;
    this.active = true;
    this.completed = false;
    this.timeLeft = MISSION_DATA[index].timeLimit ?? 0;
    this.marker.visible = true;
    this.configureStep();
    this.hud.missionStart?.(MISSION_DATA[index]);
    this.hud.missionUpdate?.(MISSION_DATA[index], this.step, this.objectiveDistance, this.timeLeft, 0, MISSION_DATA[index].steps[this.step]);
    this.setPrompt(this.currentStep?.prompt ?? null);
  }

  placeMarkerAt(x, z) {
    this.currentTarget.set(x, 0.3, z);
    this.marker.position.set(x, 0.3, z);
  }
}

