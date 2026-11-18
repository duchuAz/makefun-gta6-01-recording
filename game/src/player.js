// PLAYER.JS — Teo Cruz, his battered Solara 88, and the camera that makes the
// boulevard feel like a film. Handles driving, walking, collisions and gunfire.
import * as THREE from 'three';
import { PALETTE, clamp, damp, flatMaterial, glassMaterial, makeGlowTexture, neonMaterial } from './neon.js';

const CAR_NAME = 'SOLARA 88';
const CAR_COLOR = 0xff654f;

export class Player {
  constructor(scene, world, city, audio) {
    this.scene = scene;
    this.world = world;
    this.city = city;
    this.audio = audio;
    this.mode = 'car';
    this.car = {
      position: new THREE.Vector3(96.8, 0.06, 28),
      heading: 0,
      speed: 0,
      steer: 0,
      health: 100,
      wheelSpin: 0,
    };
    this.foot = {
      position: new THREE.Vector3(114.1, 0.3, 38),
      heading: 0,
      walk: 0,
      moving: false,
    };
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 35;
    this.money = 850;
    this.carOrbit = 0;
    this.footYaw = 0;
    this.cameraPitch = 0.27;
    this.cameraDistance = 7.4;
    this.cameraShake = 0;
    this.cameraTarget = new THREE.Vector3(96.8, 1.3, 20);
    this.cameraPosition = new THREE.Vector3(96.8, 4.2, 35);
    this.effects = [];
    this.shotsFired = 0;
    this.nearCar = false;
    this.time = 0;
    this.carGroup = new THREE.Group();
    this.characterGroup = new THREE.Group();
    this.scene.add(this.carGroup);
    this.scene.add(this.characterGroup);
    this.headlightGlow = makeGlowTexture('rgba(255,244,204,0.9)', 'rgba(255,170,80,0)');
    this.underglowTex = makeGlowTexture('rgba(84,242,225,0.6)', 'rgba(22,140,180,0)');
    this.shotMaterial = new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.9, toneMapped: false });
    this.setCameraImmediate();
  }

  build() {
    this.buildCar();
    this.buildCharacter();
    this.characterGroup.visible = false;
    this.setCameraImmediate();
    return this;
  }

  buildCar() {
    const car = new THREE.Group();
    car.name = 'solara-88';
    const paint = new THREE.MeshStandardMaterial({ color: CAR_COLOR, roughness: 0.33, metalness: 0.55 });
    const paintDark = new THREE.MeshStandardMaterial({ color: 0x9e342c, roughness: 0.4, metalness: 0.4 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf0dcb2, roughness: 0.57, metalness: 0.18 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xbfc7c9, roughness: 0.18, metalness: 0.92 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x161a1d, roughness: 0.96 });
    const glass = glassMaterial(0x132839);
    const lightWhite = neonMaterial(0xfff3cc, 2.2);
    const lightRed = neonMaterial(0xff3f46, 1.8);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.43, 4.32), paint);
    lower.position.y = 0.62;
    lower.castShadow = true;
    car.add(lower);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.18, 4.1), paintDark);
    skirt.position.y = 0.38;
    car.add(skirt);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 1.32), paint);
    hood.position.set(0, 0.92, -1.32);
    hood.castShadow = true;
    car.add(hood);
    const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 1.34), cream);
    hoodStripe.position.set(0, 1.02, -1.32);
    car.add(hoodStripe);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.24, 1.08), paint);
    trunk.position.set(0, 0.96, 1.63);
    car.add(trunk);
    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.53, 1.76), glass);
    cabinGlass.position.set(0, 1.27, 0.22);
    cabinGlass.castShadow = true;
    car.add(cabinGlass);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.1, 1.16), cream);
    roof.position.set(0, 1.58, 0.24);
    car.add(roof);
    const aPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 1.8), paintDark);
    aPillarL.position.set(-0.82, 1.27, 0.22);
    car.add(aPillarL);
    const aPillarR = aPillarL.clone();
    aPillarR.position.x = 0.82;
    car.add(aPillarR);
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 0.3), chrome);
    bumperF.position.set(0, 0.54, -2.25);
    car.add(bumperF);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 0.24), chrome);
    bumperR.position.set(0, 0.55, 2.26);
    car.add(bumperR);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.26, 0.1), new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.6, metalness: 0.5 }));
    grille.position.set(0, 0.68, -2.19);
    car.add(grille);
    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.19, 0.08), neonMaterial(0xffb968, 1.2));
      intake.position.set(side * 0.58, 0.66, -2.23);
      car.add(intake);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.06), lightRed);
      tail.position.set(side * 0.63, 0.85, 2.22);
      car.add(tail);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.07), lightWhite);
      head.position.set(side * 0.67, 0.86, -2.2);
      car.add(head);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.headlightGlow, color: 0xffe7b5, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      glow.position.set(side * 0.67, 0.82, -2.38);
      glow.scale.set(1.7, 0.8, 1);
      car.add(glow);
    }
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.1, 0.34), paintDark);
    spoiler.position.set(0, 1.25, 2.02);
    car.add(spoiler);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.14), chrome);
      post.position.set(side * 0.68, 1.1, 2.02);
      car.add(post);
    }
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xff8b6a, roughness: 0.3, metalness: 0.4 });
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), mirrorMat);
      mirror.position.set(side * 1.02, 1.12, -0.72);
      car.add(mirror);
    }
    // whitewall tires, chrome hubs, front wheels in steering pivots
    this.wheels = [];
    this.frontWheels = [];
    for (const [sx, sz, front] of [[-0.99, -1.34, true], [0.99, -1.34, true], [-0.99, 1.36, false], [0.99, 1.36, false]]) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(sx, 0.47, sz);
      car.add(steerPivot);
      const spin = new THREE.Group();
      steerPivot.add(spin);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.34, 14), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spin.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.35, 8), chrome);
      rim.rotation.z = Math.PI / 2;
      spin.add(rim);
      const whiteWall = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 16), cream);
      whiteWall.rotation.y = Math.PI / 2;
      whiteWall.position.x = 0.18;
      spin.add(whiteWall);
      this.wheels.push(spin);
      if (front) this.frontWheels.push(steerPivot);
    }
    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 4.7),
      new THREE.MeshBasicMaterial({ map: this.underglowTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = 0.045;
    car.add(underglow);
    const interior = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.32, 1.3), flatMaterial(0x3c2b2a));
    interior.position.set(0, 1.02, 0.2);
    car.add(interior);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 0.18), flatMaterial(0x6e4138));
    headrest.position.set(0, 1.22, 0.78);
    car.add(headrest);

    car.position.copy(this.car.position);
    this.carGroup.add(car);
    this.carModel = car;
  }

  buildCharacter() {
    const rig = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc28260, roughness: 0.68, emissive: 0x1d0e09, emissiveIntensity: 0.35 });
    const jacket = new THREE.MeshStandardMaterial({ color: 0xf0745c, roughness: 0.68, emissive: 0x451a11, emissiveIntensity: 0.3 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf0e3c8, roughness: 0.9 });
    const denim = new THREE.MeshStandardMaterial({ color: 0x263346, roughness: 0.92 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xeee1c4, roughness: 0.8 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x21191c, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x181c25, roughness: 0.8 });
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x79563d, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3), jacket);
    torso.position.y = 1.26;
    torso.castShadow = true;
    rig.add(torso);
    const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.02), shirt);
    shirtPanel.position.set(0, 1.25, -0.16);
    rig.add(shirtPanel);
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.25, 0.28), denim);
    hips.position.y = 0.92;
    rig.add(hips);

    const legPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.14, 0.9, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.23), denim);
      leg.position.y = -0.34;
      leg.castShadow = true;
      pivot.add(leg);
      const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.42), shoe);
      shoeMesh.position.set(0, -0.71, -0.08);
      pivot.add(shoeMesh);
      rig.add(pivot);
      legPivots.push(pivot);
    }

    const armPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.37, 1.49, 0);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.38, 0.19), jacket);
      sleeve.position.y = -0.18;
      pivot.add(sleeve);
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.16), skin);
      forearm.position.y = -0.47;
      pivot.add(forearm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), skin);
      hand.position.y = -0.65;
      pivot.add(hand);
      rig.add(pivot);
      armPivots.push(pivot);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 6), skin);
    neck.position.y = 1.59;
    rig.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
    head.position.y = 1.76;
    head.castShadow = true;
    rig.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
    hairCap.position.y = 1.79;
    rig.add(hairCap);
    const sunglasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.04), dark);
    sunglasses.position.set(0, 1.77, -0.205);
    rig.add(sunglasses);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.04), hair);
    jaw.position.set(0, 1.68, -0.2);
    rig.add(jaw);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.04), bagMat);
    strap.position.set(0.12, 1.24, -0.17);
    strap.rotation.z = -0.42;
    rig.add(strap);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.18), bagMat);
    bag.position.set(0.36, 1.0, 0.02);
    rig.add(bag);
    rig.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    rig.position.y = 0.03;
    this.characterGroup.add(rig);
    this.characterRig = rig;
    this.legPivots = legPivots;
    this.armPivots = armPivots;
    this.characterGroup.position.copy(this.foot.position);
    this.characterGroup.rotation.y = this.foot.heading;
  }

  update(dt, input) {
    this.time += dt;
    if (this.mode === 'car') this.updateDriving(dt, input);
    else this.updateWalking(dt, input);
    this.updateEffects(dt);
    if (this.mode === 'car') {
      this.nearCar = false;
    } else {
      this.nearCar = this.foot.position.distanceTo(this.car.position) < 5.2;
    }
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
  }

  updateDriving(dt, input) {
    const car = this.car;
    const throttle = input.forward ? 1 : 0;
    const reverse = input.back ? 1 : 0;
    if (throttle) car.speed += (18 + Math.max(0, 12 - car.speed * 0.25)) * dt;
    if (input.run && throttle && car.speed < 39) car.speed += 10 * dt;
    if (reverse) {
      if (car.speed > 1.2) car.speed -= 34 * dt;
      else car.speed -= 11 * dt;
    }
    if (input.brake) car.speed *= Math.exp(-3.7 * dt);
    car.speed *= Math.exp(-0.24 * dt);
    car.speed = clamp(car.speed, -11, 39);
    if (Math.abs(car.speed) < 0.035) car.speed = 0;

    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    car.steer = damp(car.steer, steerInput, 7, dt);
    const grip = input.brake ? 0.58 : 1;
    const rate = (1.5 + (input.brake ? 0.8 : 0)) * clamp(Math.abs(car.speed) / 9, 0, 1) * grip;
    car.heading += car.steer * rate * Math.sign(car.speed || 1) * dt;
    const oldX = car.position.x;
    const oldZ = car.position.z;
    car.position.x += -Math.sin(car.heading) * car.speed * dt;
    car.position.z += -Math.cos(car.heading) * car.speed * dt;
    const resolved = this.city.resolveCircle(car.position.x, car.position.z, 1.3);
    if (resolved.hit) {
      const impact = Math.abs(car.speed);
      car.position.x = resolved.x;
      car.position.z = resolved.z;
      if (impact > 7) {
        this.damage(Math.min(24, impact * 0.55));
        this.cameraShake = Math.min(1, this.cameraShake + impact * 0.045);
        this.audio?.sfx('crash');
        car.health = Math.max(0, car.health - impact * 0.7);
      }
      car.speed *= -0.18;
    }
    const bounds = this.city.clampToLand(car.position.x, car.position.z);
    if (bounds.x !== car.position.x || bounds.z !== car.position.z) car.speed *= 0.4;
    car.position.x = bounds.x;
    car.position.z = bounds.z;
    if (car.position.x > 160) car.speed *= 0.92;
    if (Math.abs(car.position.x - oldX) + Math.abs(car.position.z - oldZ) > 0.75) this.cameraShake = Math.max(this.cameraShake, 0.03);
    car.wheelSpin += car.speed * dt / 0.41;

    this.carModel.position.copy(car.position);
    this.carModel.rotation.y = car.heading;
    this.carModel.rotation.z = -car.steer * clamp(Math.abs(car.speed) / 26, 0, 1) * 0.055;
    this.carModel.position.y = car.position.y + Math.sin(this.time * 8) * Math.min(0.014, Math.abs(car.speed) * 0.0006);
    for (const wheel of this.wheels) wheel.rotation.x = car.wheelSpin;
    for (const front of this.frontWheels) front.rotation.y = -car.steer * 0.42;
    this.carGroup.visible = true;
  }

  updateWalking(dt, input) {
    const forward = new THREE.Vector3(-Math.sin(this.footYaw), 0, -Math.cos(this.footYaw));
    const right = new THREE.Vector3(Math.cos(this.footYaw), 0, -Math.sin(this.footYaw));
    const move = new THREE.Vector3();
    if (input.forward) move.add(forward);
    if (input.back) move.sub(forward);
    if (input.right) move.add(right);
    if (input.left) move.sub(right);
    const moving = move.lengthSq() > 0.001;
    this.foot.moving = moving;
    const speed = input.run ? 6.4 : 3.5;
    if (moving) {
      move.normalize();
      const targetHeading = Math.atan2(-move.x, -move.z);
      this.foot.heading = this.angleDamp(this.foot.heading, targetHeading, 10, dt);
      this.foot.position.x += move.x * speed * dt;
      this.foot.position.z += move.z * speed * dt;
      this.foot.walk += speed * dt * 2.4;
    }
    const resolved = this.city.resolveCircle(this.foot.position.x, this.foot.position.z, 0.42);
    if (resolved.hit) {
      this.foot.position.x = resolved.x;
      this.foot.position.z = resolved.z;
    }
    const bounds = this.city.clampToLand(this.foot.position.x, this.foot.position.z);
    this.foot.position.x = bounds.x;
    this.foot.position.z = bounds.z;
    const ground = this.groundHeight(this.foot.position.x, this.foot.position.z);
    this.foot.position.y = damp(this.foot.position.y, ground, 14, dt);
    this.characterGroup.position.copy(this.foot.position);
    this.characterGroup.rotation.y = this.foot.heading;
    this.animateCharacter(moving, dt);
  }

  groundHeight(x, z) {
    if (x > 110.4 && x < 116.8) return 0.34;
    if (x > 106 && x < 170) return x > 120 ? 0.22 : 0.31;
    return 0.27;
  }

  animateCharacter(moving, dt) {
    const walk = this.foot.walk;
    const swing = moving ? Math.sin(walk) * 0.72 : Math.sin(this.time * 1.7) * 0.035;
    const swing2 = moving ? Math.sin(walk + Math.PI) * 0.72 : 0;
    this.legPivots[0].rotation.x = swing;
    this.legPivots[1].rotation.x = swing2;
    this.armPivots[0].rotation.x = -swing * 0.8 - 0.08;
    this.armPivots[1].rotation.x = -swing2 * 0.8 + 0.08;
    this.armPivots[0].rotation.z = 0.08;
    this.armPivots[1].rotation.z = -0.08;
    this.characterRig.position.y = 0.03 + (moving ? Math.abs(Math.sin(walk)) * 0.045 : Math.sin(this.time * 1.8) * 0.012);
    this.characterRig.rotation.z = moving ? Math.sin(walk) * 0.018 : 0;
  }

  angleDamp(from, to, lambda, dt) {
    let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * (1 - Math.exp(-lambda * dt));
  }

  updateCamera(dt) {
    const carMode = this.mode === 'car';
    const focus = carMode ? this.car.position : this.foot.position;
    const heading = carMode ? this.car.heading : this.foot.heading;
    const orbit = carMode ? carOrbitSafe(this.carOrbit) : this.footYaw;
    const distance = carMode ? this.cameraDistance + Math.min(2.6, Math.abs(this.car.speed) * 0.075) : 5.1;
    const pitch = clamp(this.cameraPitch, -0.08, 0.8);
    const horizontal = distance * Math.cos(pitch);
    const vertical = distance * Math.sin(pitch) + (carMode ? 1.2 : 1.35);
    const angle = carMode ? this.car.heading + orbit : orbit;
    const desired = new THREE.Vector3(
      focus.x + Math.sin(angle) * horizontal,
      (carMode ? focus.y + vertical : focus.y + vertical),
      focus.z + Math.cos(angle) * horizontal,
    );
    const lookAhead = carMode ? clamp(Math.abs(this.car.speed) * 0.1, 0, 5.5) : 1.2;
    const look = new THREE.Vector3(
      focus.x - Math.sin(heading) * lookAhead * (carMode ? 0.35 : 0.2),
      focus.y + (carMode ? 1.05 : 1.3),
      focus.z - Math.cos(heading) * lookAhead * (carMode ? 0.35 : 0.2),
    );
    const lerp = 1 - Math.exp(-(carMode ? 7.5 : 10.5) * dt);
    this.cameraPosition.lerp(desired, lerp);
    this.cameraTarget.lerp(look, 1 - Math.exp(-12 * dt));
    const camera = this.world.camera;
    const shake = this.cameraShake * 0.18;
    camera.position.copy(this.cameraPosition);
    if (shake > 0.001) {
      camera.position.x += Math.sin(this.time * 67) * shake;
      camera.position.y += Math.cos(this.time * 54) * shake * 0.6;
      camera.position.z += Math.sin(this.time * 43) * shake;
    }
    camera.lookAt(this.cameraTarget);
    const targetFov = carMode ? 56 + Math.min(12, Math.abs(this.car.speed) * 0.3) : 58;
    camera.fov = damp(camera.fov, targetFov, 4, dt);
    camera.updateProjectionMatrix();
  }

  setCameraImmediate() {
    const carMode = this.mode === 'car';
    const focus = carMode ? this.car.position : this.foot.position;
    const angle = carMode ? this.car.heading + this.carOrbit : this.footYaw;
    const distance = carMode ? this.cameraDistance : 5.1;
    const pitch = this.cameraPitch;
    this.cameraPosition.set(
      focus.x + Math.sin(angle) * distance * Math.cos(pitch),
      focus.y + distance * Math.sin(pitch) + (carMode ? 1.2 : 1.35),
      focus.z + Math.cos(angle) * distance * Math.cos(pitch),
    );
    this.cameraTarget.set(focus.x, focus.y + (carMode ? 1.1 : 1.3), focus.z);
    this.world.camera.position.copy(this.cameraPosition);
    this.world.camera.lookAt(this.cameraTarget);
  }

  applyLook(dx, dy) {
    if (this.mode === 'car') {
      this.carOrbit = clamp(this.carOrbit - dx * 0.004, -Math.PI, Math.PI);
    } else {
      this.footYaw -= dx * 0.004;
    }
    this.cameraPitch = clamp(this.cameraPitch + dy * 0.003, -0.06, 0.82);
  }

  zoom(delta) {
    this.cameraDistance = clamp(this.cameraDistance + delta * 0.004, 4.8, 12);
  }

  enterCar() {
    if (this.mode !== 'foot') return false;
    if (this.foot.position.distanceTo(this.car.position) > 5.4) return false;
    this.mode = 'car';
    this.characterGroup.visible = false;
    this.carOrbit = 0;
    if (this.audio) this.audio.sfx('door');
    this.onModeChange?.('car');
    return true;
  }

  exitCar() {
    if (this.mode !== 'car' || Math.abs(this.car.speed) > 3.2) return false;
    this.mode = 'foot';
    const right = new THREE.Vector3(Math.cos(this.car.heading), 0, -Math.sin(this.car.heading));
    this.foot.position.copy(this.car.position).addScaledVector(right, 2.1);
    const resolved = this.city.resolveCircle(this.foot.position.x, this.foot.position.z, 0.5);
    this.foot.position.x = resolved.x;
    this.foot.position.z = resolved.z;
    this.foot.position.y = this.groundHeight(this.foot.position.x, this.foot.position.z);
    this.foot.heading = this.car.heading;
    this.footYaw = this.car.heading;
    this.characterGroup.visible = true;
    this.characterGroup.position.copy(this.foot.position);
    this.characterGroup.rotation.y = this.foot.heading;
    this.car.speed = 0;
    if (this.audio) this.audio.sfx('door');
    this.onModeChange?.('foot');
    return true;
  }

  tryShoot() {
    if (this.mode !== 'foot') return false;
    const origin = this.foot.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    const dir = new THREE.Vector3(-Math.sin(this.foot.heading), 0, -Math.cos(this.foot.heading));
    const end = origin.clone().addScaledVector(dir, 34);
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geometry, this.shotMaterial.clone());
    this.scene.add(line);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.headlightGlow, color: 0xffdb95, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flash.position.copy(origin).addScaledVector(dir, 0.7);
    flash.scale.set(1.2, 1.2, 1);
    this.scene.add(flash);
    this.effects.push({ line, flash, life: 0.12 });
    this.shotsFired++;
    this.audio?.sfx('shoot');
    this.cameraShake = Math.max(this.cameraShake, 0.09);
    this.onGunshot?.();
    return true;
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      if (effect.life <= 0) {
        this.scene.remove(effect.line);
        effect.line.geometry.dispose();
        effect.line.material.dispose();
        this.scene.remove(effect.flash);
        effect.flash.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  damage(amount) {
    if (this.respawning) return;
    const absorbed = Math.min(this.armor, amount * 0.65);
    this.armor -= absorbed;
    this.health = Math.max(0, this.health - (amount - absorbed));
    this.cameraShake = Math.min(1.5, this.cameraShake + amount * 0.014);
    this.audio?.sfx('hurt');
    if (this.health <= 0) this.onWasted?.();
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  addMoney(amount) {
    this.money = Math.max(0, this.money + amount);
  }

  repairCar() {
    this.car.health = 100;
  }

  respawn() {
    this.respawning = true;
    this.health = 100;
    this.armor = 25;
    this.car.health = 100;
    this.car.position.set(46, 0.06, 0);
    this.car.heading = -Math.PI / 2;
    this.car.speed = 0;
    this.mode = 'car';
    this.characterGroup.visible = false;
    this.carModel.position.copy(this.car.position);
    this.carModel.rotation.y = this.car.heading;
    this.carOrbit = 0;
    this.cameraPitch = 0.27;
    this.cameraTarget.set(46, 1.2, 0);
    this.cameraPosition.set(46, 5, 8);
    this.setCameraImmediate();
    setTimeout(() => { this.respawning = false; }, 1600);
  }

  get carName() {
    return CAR_NAME;
  }

  get speedKmh() {
    return Math.round(Math.abs(this.car.speed) * 3.6);
  }

  get position() {
    return this.mode === 'car' ? this.car.position : this.foot.position;
  }

  get heading() {
    return this.mode === 'car' ? this.car.heading : this.foot.heading;
  }
}

function carOrbitSafe(value) {
  return Number.isFinite(value) ? clamp(value, -Math.PI, Math.PI) : 0;
}

