// TRAFFIC.JS — sun-drunk commuters, beachgoers and the Puerto Sol police force.
// Civilian cars loop the boulevards; police cars wake up when the wanted stars do.
import * as THREE from 'three';
import { ROADS } from './city.js';
import { PALETTE, mulberry32, clamp, flatMaterial, neonMaterial, makeGlowTexture } from './neon.js';

const BODY_COLORS = [0xe8d7b4, 0x44b6ae, 0xff745c, 0x426a8c, 0xe1a54f, 0xc56d8d, 0x8bb28c, 0xf0e7d1];
const PED_COLORS = [0xff7f64, 0x52c7b4, 0xf3cf6b, 0xe67ba5, 0x78a1db, 0xf0dfc6, 0x9ddb8d, 0xd38b5f];
const SKIN_TONES = [0x9a6045, 0xc0805e, 0x6e4836, 0xd29a72, 0x83533b];

export class Traffic {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.rng = mulberry32(4471);
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.wanted = 0;
    this.evadeTime = 0;
    this.closestCop = Infinity;
    this.time = 0;
    this.copCooldown = 0;
    this.playerHitCooldown = 0;
    this.group = new THREE.Group();
    this.group.name = 'street-life';
    this.scene.add(this.group);
    this.headlightTexture = makeGlowTexture('rgba(255,243,198,0.95)', 'rgba(255,190,90,0)');
    this.redGlow = makeGlowTexture('rgba(255,62,78,0.9)', 'rgba(255,30,40,0)');
    this.blueGlow = makeGlowTexture('rgba(76,159,255,0.9)', 'rgba(50,100,255,0)');
    this.onCrime = null;
  }

  build() {
    this.buildCivilianTraffic();
    this.buildPedestrians();
    this.buildPoliceFleet();
    return this;
  }

  buildCivilianTraffic() {
    for (let i = 0; i < 15; i++) {
      const axis = i % 2 === 0 ? 'x' : 'z';
      const line = ROADS[Math.floor(this.rng() * ROADS.length)];
      const dir = this.rng() > 0.5 ? 1 : -1;
      const lane = dir > 0 ? 3.15 : -3.15;
      const along = -124 + this.rng() * 248;
      const style = Math.floor(this.rng() * 3);
      const color = BODY_COLORS[i % BODY_COLORS.length];
      const car = this.buildCivilianCar(color, style);
      const state = {
        group: car.group,
        wheels: car.wheels,
        axis,
        line,
        dir,
        lane,
        along,
        speed: 7.5 + this.rng() * 7,
        baseSpeed: 7.5 + this.rng() * 7,
        honkCooldown: this.rng() * 20,
      };
      this.positionTrafficCar(state);
      this.group.add(car.group);
      this.cars.push(state);
    }
    // one parked taxi near the diner, one little bus at the mercado
    const taxi = this.buildCivilianCar(0xf2c351, 1);
    taxi.group.position.set(-33, 0.08, 48.4);
    taxi.group.rotation.y = Math.PI / 2;
    this.group.add(taxi.group);
    const bus = this.buildBus();
    bus.position.set(74, 0.08, 45.2);
    bus.rotation.y = Math.PI / 2;
    this.group.add(bus);
  }

  buildCivilianCar(color, style) {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.42 });
    const dark = flatMaterial(0x1a2229, { roughness: 0.7, metalness: 0.25 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x173049, roughness: 0.18, metalness: 0.7 });
    const lightMat = neonMaterial(0xfff1c9, 1.6);
    const redMat = neonMaterial(0xff384f, 1.5);
    const width = style === 2 ? 2.05 : 1.88;
    const bodyHeight = style === 2 ? 1.1 : 0.55;
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyHeight, 4.1), paint);
    body.position.y = 0.58 + (bodyHeight - 0.55) * 0.5;
    body.castShadow = true;
    group.add(body);
    if (style !== 2) {
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.52, style === 1 ? 1.7 : 1.95), glass);
      cabin.position.set(0, 1.03, 0.2);
      cabin.castShadow = true;
      group.add(cabin);
      if (style === 1) {
        const roofSign = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.32), neonMaterial(0xffd76b, 1.2));
        roofSign.position.set(0, 1.42, 0.1);
        group.add(roofSign);
      }
    } else {
      const windows = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.42, 2.8), glass);
      windows.position.set(0, 1.25, 0.2);
      group.add(windows);
    }
    for (const side of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.06), lightMat);
      head.position.set(side * width * 0.32, 0.66, -2.07);
      group.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.06), redMat);
      tail.position.set(side * width * 0.32, 0.69, 2.07);
      group.add(tail);
    }
    const wheels = [];
    for (const [sx, sz] of [[-0.92, -1.3], [0.92, -1.3], [-0.92, 1.3], [0.92, 1.3]]) {
      const spin = new THREE.Group();
      spin.position.set(sx * (width / 1.88), 0.4, sz);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), dark);
      tire.rotation.z = Math.PI / 2;
      spin.add(tire);
      group.add(spin);
      wheels.push(spin);
    }
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, 0.15, 0.2), dark);
    bumper.position.set(0, 0.48, -2.12);
    group.add(bumper);
    return { group, wheels };
  }

  buildBus() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 8), flatMaterial(0x59b9ae));
    body.position.y = 1.55;
    group.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.35, 8.02), flatMaterial(0xffd069));
    stripe.position.y = 1.8;
    group.add(stripe);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.75, 6.9), new THREE.MeshStandardMaterial({ color: 0x17324a, roughness: 0.2, metalness: 0.6 }));
    windows.position.y = 2.2;
    group.add(windows);
    for (const [sx, sz] of [[-1.05, -2.6], [1.05, -2.6], [-1.05, 2.6], [1.05, 2.6]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.35, 12), flatMaterial(0x171b20));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.52, sz);
      group.add(wheel);
    }
    const light = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.05), neonMaterial(0xffedbd, 1.4));
    light.position.set(0, 1.0, -4.02);
    group.add(light);
    return group;
  }

  buildPedestrians() {
    const centers = [-75, -25, 25, 75];
    for (let i = 0; i < 24; i++) {
      const sx = centers[Math.floor(this.rng() * centers.length)];
      const sz = centers[Math.floor(this.rng() * centers.length)];
      const outfit = PED_COLORS[Math.floor(this.rng() * PED_COLORS.length)];
      const skin = SKIN_TONES[Math.floor(this.rng() * SKIN_TONES.length)];
      const ped = this.buildPedestrian(outfit, skin, i);
      const state = {
        ...ped,
        cx: sx,
        cz: sz,
        phase: this.rng(),
        speed: 0.022 + this.rng() * 0.02,
        half: 17.9,
        alive: true,
        knocked: 0,
        home: ped.group.position.clone(),
      };
      this.placePedestrian(state);
      this.group.add(ped.group);
      this.peds.push(state);
    }
    // a cluster of people by the beach bar and the pier entrance
    for (let i = 0; i < 6; i++) {
      const ped = this.buildPedestrian(PED_COLORS[(i + 3) % PED_COLORS.length], SKIN_TONES[i % SKIN_TONES.length], 40 + i);
      const state = {
        ...ped,
        cx: 123 + this.rng() * 13,
        cz: 88 + this.rng() * 10,
        phase: this.rng(),
        speed: 0.014 + this.rng() * 0.01,
        half: 8 + this.rng() * 4,
        alive: true,
        knocked: 0,
        home: ped.group.position.clone(),
        beach: true,
      };
      this.placePedestrian(state);
      this.group.add(ped.group);
      this.peds.push(state);
    }
  }

  buildPedestrian(outfitColor, skinColor, index) {
    const group = new THREE.Group();
    const outfit = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xede2c9 : 0x283142, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.24), outfit);
    torso.position.y = 1.22;
    torso.castShadow = true;
    group.add(torso);
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.22), dark);
    hips.position.y = 0.91;
    group.add(hips);
    const legPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.1, 0.88, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.16), dark);
      leg.position.y = -0.34;
      pivot.add(leg);
      group.add(pivot);
      legPivots.push(pivot);
    }
    const armPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.28, 1.43, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.57, 0.12), skin);
      arm.position.y = -0.27;
      pivot.add(arm);
      group.add(pivot);
      armPivots.push(pivot);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 7), skin);
    head.position.y = 1.66;
    head.castShadow = true;
    group.add(head);
    if (index % 4 === 0) {
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.07, 10), flatMaterial(0xf0d29a));
      hat.position.y = 1.81;
      group.add(hat);
    } else if (index % 5 === 0) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), flatMaterial(0x2a1d1a));
      bun.position.set(0, 1.76, 0.17);
      group.add(bun);
    }
    return { group, legs: legPivots, arms: armPivots, walk: index * 1.7, head };
  }

  placePedestrian(ped) {
    if (ped.beach) {
      const angle = ped.phase * Math.PI * 2;
      ped.group.position.set(ped.cx + Math.cos(angle) * ped.half, 0.2, ped.cz + Math.sin(angle) * ped.half * 0.6);
      ped.group.rotation.y = -angle;
      return;
    }
    const perimeter = ped.half * 8;
    const s = ((ped.phase % 1) + 1) % 1 * perimeter;
    const side = Math.floor(s / (ped.half * 2));
    const local = s - side * ped.half * 2;
    let x = ped.cx;
    let z = ped.cz;
    let heading = 0;
    if (side === 0) { x += -ped.half + local; z -= ped.half; heading = -Math.PI / 2; }
    else if (side === 1) { x += ped.half; z += -ped.half + local; heading = Math.PI; }
    else if (side === 2) { x += ped.half - local; z += ped.half; heading = Math.PI / 2; }
    else { x -= ped.half; z += ped.half - local; heading = 0; }
    ped.group.position.set(x, 0.28, z);
    ped.group.rotation.y = heading;
  }

  buildPoliceFleet() {
    for (let i = 0; i < 4; i++) this.cops.push(this.buildCop());
  }

  buildCop() {
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xece8d9, roughness: 0.4, metalness: 0.3 });
    const black = new THREE.MeshStandardMaterial({ color: 0x171d26, roughness: 0.36, metalness: 0.45 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x163047, roughness: 0.16, metalness: 0.7 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xb9c2c5, roughness: 0.2, metalness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.56, 4.42), white);
    body.position.y = 0.67;
    body.castShadow = true;
    group.add(body);
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 4.43), black);
      stripe.position.set(side * 0.74, 0.67, 0);
      group.add(stripe);
    }
    const doors = new THREE.Mesh(new THREE.BoxGeometry(2, 0.46, 1.5), black);
    doors.position.set(0, 0.72, 0.1);
    group.add(doors);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.85), glass);
    cabin.position.set(0, 1.22, 0.18);
    group.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.1, 1.8), white);
    roof.position.set(0, 1.53, 0.18);
    group.add(roof);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.18, 0.36), chrome);
    bar.position.set(0, 1.68, 0.15);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.3), neonMaterial(0xff263f, 2.6));
    red.position.set(-0.3, 1.76, 0.15);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.3), neonMaterial(0x2d7dff, 2.6));
    blue.position.set(0.3, 1.76, 0.15);
    group.add(blue);
    const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.redGlow, color: 0xff4a5c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    redGlow.position.set(-0.3, 1.9, 0.15);
    redGlow.scale.set(4, 2.6, 1);
    group.add(redGlow);
    const blueGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.blueGlow, color: 0x5ab6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    blueGlow.position.set(0.3, 1.9, 0.15);
    blueGlow.scale.set(4, 2.6, 1);
    group.add(blueGlow);
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 0.26), black);
    pushBar.position.set(0, 0.53, -2.28);
    group.add(pushBar);
    const doorMark = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.06), neonMaterial(0xffd069, 1.2));
    doorMark.position.set(0, 0.8, 0.87);
    group.add(doorMark);
    const wheels = [];
    for (const [sx, sz] of [[-0.98, -1.4], [0.98, -1.4], [-0.98, 1.4], [0.98, 1.4]]) {
      const spin = new THREE.Group();
      spin.position.set(sx, 0.46, sz);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), flatMaterial(0x12171c));
      tire.rotation.z = Math.PI / 2;
      spin.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.31, 8), chrome);
      hub.rotation.z = Math.PI / 2;
      spin.add(hub);
      group.add(spin);
      wheels.push(spin);
    }
    const headlights = [];
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), neonMaterial(0xfff4d1, 1.8));
      lamp.position.set(side * 0.62, 0.76, -2.23);
      group.add(lamp);
      headlights.push(lamp);
    }
    group.visible = false;
    this.group.add(group);
    return {
      group, red, blue, redGlow, blueGlow, wheels, headlights,
      position: new THREE.Vector3(), heading: 0, speed: 0, active: false,
      stuck: 0, hitCooldown: 0, sirenPhase: Math.random() * 6,
    };
  }

  positionTrafficCar(car) {
    if (car.axis === 'x') {
      car.group.position.set(car.along, 0.06, car.line + car.lane);
      car.group.rotation.y = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      car.group.position.set(car.line + car.lane, 0.06, car.along);
      car.group.rotation.y = car.dir > 0 ? Math.PI : 0;
    }
  }

  update(dt, player) {
    this.time += dt;
    this.lastPlayerPosition = player.position.clone();
    this.lastPlayerHeading = player.heading;
    this.copCooldown = Math.max(0, this.copCooldown - dt);
    this.playerHitCooldown = Math.max(0, this.playerHitCooldown - dt);
    this.updateTraffic(dt, player);
    this.updatePedestrians(dt, player);
    this.updatePolice(dt, player);
    this.updateWanted(dt, player);
  }

  updateTraffic(dt, player) {
    for (const car of this.cars) {
      const playerPos = player.position;
      const dx = car.group.position.x - playerPos.x;
      const dz = car.group.position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7 && player.mode === 'car') car.speed = car.baseSpeed * 0.25;
      else car.speed = clamp(car.speed + car.baseSpeed * 0.3 * dt, 0.5, car.baseSpeed);
      car.along += car.dir * car.speed * dt;
      if (car.along > 134) car.along = -134;
      if (car.along < -134) car.along = 134;
      this.positionTrafficCar(car);
      for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt / 0.34;
      if (dist < 3.0 && player.mode === 'car' && this.playerHitCooldown <= 0 && Math.abs(player.car.speed) > 5) {
        this.playerHitCooldown = 1.4;
        player.damage(5 + Math.abs(player.car.speed) * 0.12);
        player.car.speed *= 0.55;
        player.cameraShake = Math.max(player.cameraShake, 0.35);
        this.audio?.sfx('crash');
        this.onCrime?.('Traffic collision', 0);
      }
      car.honkCooldown -= dt;
      if (dist < 16 && car.honkCooldown <= 0 && Math.random() < 0.008) {
        car.honkCooldown = 25 + Math.random() * 30;
        this.audio?.sfx('horn');
      }
    }
  }

  updatePedestrians(dt, player) {
    for (const ped of this.peds) {
      if (ped.knocked > 0) {
        ped.knocked -= dt;
        if (ped.knocked <= 0) {
          ped.alive = true;
          ped.group.rotation.z = 0;
          ped.group.position.copy(ped.home);
          ped.group.children.forEach((c) => { c.visible = true; });
        }
        continue;
      }
      ped.phase += ped.speed * dt;
      this.placePedestrian(ped);
      ped.walk += dt * (ped.speed * 100 + 5);
      const swing = Math.sin(ped.walk) * 0.5;
      ped.legs[0].rotation.x = swing;
      ped.legs[1].rotation.x = -swing;
      ped.arms[0].rotation.x = -swing * 0.7;
      ped.arms[1].rotation.x = swing * 0.7;
      ped.group.position.y = (ped.beach ? 0.2 : 0.28) + Math.abs(Math.sin(ped.walk)) * 0.025;
      const dist = ped.group.position.distanceTo(player.position);
      if (dist < 2.2 && player.mode === 'car' && Math.abs(player.car.speed) > 7) {
        ped.alive = false;
        ped.knocked = 6;
        ped.group.rotation.z = Math.PI * 0.47;
        ped.group.position.y = 0.5;
        player.cameraShake = Math.max(player.cameraShake, 0.5);
        this.audio?.sfx('scream');
        this.addWanted(1);
        this.onCrime?.('Hit and run', 1);
      }
    }
  }

  updatePolice(dt, player) {
    this.closestCop = Infinity;
    for (const cop of this.cops) {
      if (!cop.active) continue;
      const target = player.position;
      const dx = target.x - cop.position.x;
      const dz = target.z - cop.position.z;
      const dist = Math.hypot(dx, dz);
      this.closestCop = Math.min(this.closestCop, dist);
      const desired = Math.atan2(-dx, -dz);
      let diff = ((desired - cop.heading + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += diff * Math.min(1, dt * 2.6);
      const targetSpeed = dist > 12 ? 27 : 13;
      cop.speed = clamp(cop.speed + (targetSpeed - cop.speed) * dt * 1.3, 0, 31);
      cop.position.x += -Math.sin(cop.heading) * cop.speed * dt;
      cop.position.z += -Math.cos(cop.heading) * cop.speed * dt;
      const resolved = this.city.resolveCircle(cop.position.x, cop.position.z, 1.2);
      if (resolved.hit) {
        cop.position.x = resolved.x;
        cop.position.z = resolved.z;
        cop.heading += (resolved.nx * Math.cos(cop.heading) - resolved.nz * Math.sin(cop.heading)) * 2.4 * dt * 4;
        cop.speed *= 0.55;
        cop.stuck += dt;
      } else {
        cop.stuck = Math.max(0, cop.stuck - dt * 0.5);
      }
      if (cop.stuck > 2.4) {
        this.placeCopBehind(cop, player, 32);
        cop.stuck = 0;
      }
      const bounds = this.city.clampToLand(cop.position.x, cop.position.z);
      cop.position.x = bounds.x;
      cop.position.z = bounds.z;
      cop.group.position.set(cop.position.x, 0.06, cop.position.z);
      cop.group.rotation.y = cop.heading;
      cop.group.rotation.z = -diff * 0.04;
      for (const wheel of cop.wheels) wheel.rotation.x += cop.speed * dt / 0.4;
      cop.sirenPhase += dt * 5.4;
      const flash = Math.sin(cop.sirenPhase) > 0;
      cop.red.visible = flash;
      cop.blue.visible = !flash;
      cop.redGlow.material.opacity = flash ? 0.9 : 0.08;
      cop.blueGlow.material.opacity = flash ? 0.08 : 0.9;
      cop.hitCooldown -= dt;
      if (dist < 3.1 && cop.hitCooldown <= 0) {
        cop.hitCooldown = 1.5;
        player.damage(4 + this.wanted * 1.4);
        if (player.mode === 'car') player.car.speed *= 0.7;
        player.cameraShake = Math.max(player.cameraShake, 0.48);
        this.audio?.sfx('crash');
      }
    }
    if (this.wanted > 0) this.audio?.siren(true, this.closestCop);
    else this.audio?.siren(false, Infinity);
  }

  updateWanted(dt, player) {
    if (this.wanted <= 0) {
      this.evadeTime = 0;
      return;
    }
    if (this.closestCop > 48) {
      this.evadeTime += dt;
      if (this.evadeTime > 12) {
        this.evadeTime = 0;
        this.wanted = Math.max(0, this.wanted - 1);
        if (this.wanted === 0) {
          this.clearPoliceCars();
          this.onCrime?.('You lost the police', 0);
        } else {
          this.syncPoliceCount();
          this.onCrime?.('Heat is cooling', 0);
        }
      }
    } else {
      this.evadeTime = Math.max(0, this.evadeTime - dt * 2);
    }
  }

  addWanted(count = 1, message = null) {
    const previous = this.wanted;
    this.wanted = clamp(this.wanted + count, 0, 5);
    this.evadeTime = 0;
    if (this.wanted !== previous) {
      this.syncPoliceCount();
      if (message) this.onCrime?.(message, this.wanted);
    }
  }

  clearWanted() {
    this.wanted = 0;
    this.clearPoliceCars();
  }

  syncPoliceCount() {
    const count = Math.min(this.cops.length, this.wanted + 1);
    for (let i = 0; i < this.cops.length; i++) {
      const cop = this.cops[i];
      if (i < count) {
        if (!cop.active) {
          cop.active = true;
          cop.group.visible = true;
          cop.speed = 0;
          const anchor = {
            position: this.lastPlayerPosition ?? new THREE.Vector3(97, 0, 20),
            heading: this.lastPlayerHeading ?? 0,
            mode: 'car',
          };
          this.placeCopBehind(cop, anchor, 28 + i * 13);
        }
      } else {
        cop.active = false;
        cop.group.visible = false;
      }
    }
  }

  placeCopBehind(cop, player, distance) {
    const heading = player.heading ?? player.car?.heading ?? 0;
    const behind = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const side = (this.cops.indexOf(cop) % 2 === 0 ? 1 : -1) * 4.6;
    const position = player.position.clone().addScaledVector(behind, distance).addScaledVector(right, side);
    const resolved = this.city.resolveCircle(position.x, position.z, 1.3);
    cop.position.set(resolved.x, 0.06, resolved.z);
    cop.heading = heading;
    cop.speed = 9;
    cop.stuck = 0;
    if (!cop.group.parent) this.group.add(cop.group);
    cop.group.visible = true;
  }

  clearPoliceCars() {
    for (const cop of this.cops) {
      cop.active = false;
      cop.group.visible = false;
    }
  }

  onGunshot() {
    this.addWanted(2, 'Shots fired');
  }

  resetWantedForShot(level = 0) {
    this.clearPoliceCars();
    this.wanted = level;
    if (level > 0) this.syncPoliceCount();
  }

  arrangeChase(player, level = 3) {
    this.wanted = level;
    player.mode = 'car';
    player.characterGroup.visible = false;
    player.car.position.set(97, 0.06, 22);
    player.car.heading = 0;
    player.car.speed = 16;
    player.carModel.position.copy(player.car.position);
    player.carModel.rotation.y = 0;
    const spots = [
      [97.2, 32.6, 0.02],
      [103.6, 26.5, 0.18],
      [91.2, 25.0, -0.2],
    ];
    for (let i = 0; i < this.cops.length; i++) {
      const cop = this.cops[i];
      if (i < level) {
        cop.active = true;
        cop.group.visible = true;
        const [x, z, heading] = spots[i];
        cop.position.set(x, 0.06, z);
        cop.heading = heading;
        cop.speed = 13;
        cop.stuck = 0;
        cop.group.position.set(x, 0.06, z);
        cop.group.rotation.y = heading;
        cop.red.visible = i % 2 === 0;
        cop.blue.visible = i % 2 !== 0;
        cop.redGlow.material.opacity = i % 2 === 0 ? 0.9 : 0.08;
        cop.blueGlow.material.opacity = i % 2 === 0 ? 0.08 : 0.9;
      } else {
        cop.active = false;
        cop.group.visible = false;
      }
    }
  }

  get nearestCop() {
    return this.closestCop;
  }

  getCopPositions() {
    return this.cops.filter((c) => c.active).map((c) => ({ x: c.position.x, z: c.position.z }));
  }

  getTrafficPositions() {
    return this.cars.map((c) => ({ x: c.group.position.x, z: c.group.position.z }));
  }

  getPedPositions() {
    return this.peds.filter((p) => p.knocked <= 0).map((p) => ({ x: p.group.position.x, z: p.group.position.z }));
  }
}

