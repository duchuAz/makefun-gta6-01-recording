// CITY.JS — the procedural blocks, shops, towers, beach and piers of Puerto Sol.
// Layout is a five-street grid between a warm stone downtown and the Bahía de Sol.
import * as THREE from 'three';
import {
  PALETTE, NEON, mulberry32, clamp, flatMaterial, glowMaterial, neonMaterial,
  makeWindowTextures, makeAsphaltTexture, makePavingTexture, makeSignTexture,
  makeBillboardTexture, makeGlowTexture, makeFrondTexture, repeated,
} from './neon.js';

export const ROADS = [-100, -50, 0, 50, 100];
export const ROAD_WIDTH = 13;
export const SHORE_X = 171;
export const BLOCK_SIZE = 39;

const SHOP_NAMES = [
  'CAFÉ LUNA', 'SOL Y SOMBRA', 'EL FARO BOOKS', 'VELVET TIDE', 'PALMA RADIO',
  'THE SALTY FIN', 'MIEL MARKET', 'BODEGA SOL', 'LUNA AZUL', 'CASA CORAL',
  'GELATO 88', 'SIRENA SURF', 'LA PALOMA', 'FLOR DE SAL', 'TACOS MAREA',
];

const BLOCK_OVERRIDES = {
  '-75,-75': { kind: 'shops', name: 'FLOR DE SAL' },
  '-25,-75': { kind: 'tower', name: 'BAHÍA GRAND', height: 68, style: 0 },
  '25,-75': { kind: 'shops', name: 'SIRENA SURF' },
  '75,-75': { kind: 'tower', name: 'HOTEL MIRAMAR', height: 62, style: 2 },
  '-75,-25': { kind: 'plaza', name: 'PLAZA MIRAMAR' },
  '-25,-25': { kind: 'tower', name: 'TORRE SOL', height: 112, style: 3 },
  '25,-25': { kind: 'tower', name: 'BANCO DEL SOL', height: 42, style: 1 },
  '75,-25': { kind: 'club', name: 'CASA NEON' },
  '-75,25': { kind: 'tower', name: 'LA SIRENA', height: 34, style: 4 },
  '-25,25': { kind: 'shops', name: 'CAFÉ LUNA' },
  '25,25': { kind: 'tower', name: 'HOTEL BRISA', height: 56, style: 0 },
  '75,25': { kind: 'market', name: 'MERCADO DEL MAR' },
  '-75,75': { kind: 'motel', name: 'CORAL COURT' },
  '-25,75': { kind: 'diner', name: 'TIDELINE DINER' },
  '25,75': { kind: 'shops', name: 'LA PALOMA' },
  '75,75': { kind: 'arcade', name: 'MUELLE SOL' },
};

export class City {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.colliders = [];
    this.buildings = [];
    this.landmarks = [];
    this.palms = [];
    this.boats = [];
    this.streetlights = [];
    this.animated = [];
    this.rng = mulberry32(1988);
    this.group = new THREE.Group();
    this.group.name = 'puerto-sol';
    this.scene.add(this.group);
    this.signCache = new Map();
    this.awningMats = new Map();
  }

  build() {
    this.buildTextures();
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildOuterRing();
    this.buildBeach();
    this.buildBoardwalk();
    this.buildPalms();
    this.buildBeachProps();
    this.buildPiers();
    this.buildBoats();
    this.buildStreetLights();
    this.buildStreetSigns();
    this.buildBillboards();
    return this;
  }

  buildTextures() {
    this.asphalt = makeAsphaltTexture(12);
    this.asphalt.wrapS = this.asphalt.wrapT = THREE.RepeatWrapping;
    this.paving = makePavingTexture(24);
    this.paving.wrapS = this.paving.wrapT = THREE.RepeatWrapping;
    this.wood = this.makeWoodTexture();
    this.sand = this.makeSandTexture();
    this.glowWarm = makeGlowTexture('rgba(255,220,155,0.95)', 'rgba(255,120,60,0)');
    this.glowPink = makeGlowTexture('rgba(255,86,165,0.75)', 'rgba(255,30,120,0)');
    this.windowSets = [0, 1, 2, 3, 4].map((i) => makeWindowTextures(i, 3 + i));
    this.frond = makeFrondTexture();
    this.pavingMat = new THREE.MeshStandardMaterial({ map: repeated(this.paving, 3, 3), color: 0xf3dcc0, roughness: 0.94 });
    this.sidewalkTopMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.92 });
    this.curbMat = flatMaterial(0xb49c7e, { roughness: 0.95 });
    this.roofMat = flatMaterial(0x836e63, { roughness: 0.97 });
    this.trimMat = flatMaterial(0x7f5e54, { roughness: 0.8 });
    this.darkMetal = new THREE.MeshStandardMaterial({ color: 0x28313a, roughness: 0.45, metalness: 0.6 });
    this.lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x263039, roughness: 0.55, metalness: 0.55 });
    this.lampGlowMat = neonMaterial(0xffd89c, 1.8);
    this.poolMat = new THREE.MeshStandardMaterial({ color: 0x2a9fae, roughness: 0.2, metalness: 0.2 });
  }

  makeWoodTexture() {
    const tex = repeated(makePavingTexture(72), 1, 1);
    return tex;
  }

  makeSandTexture() {
    const rand = mulberry32(707);
    return textureFromLocal((ctx, w, h) => {
      ctx.fillStyle = '#e8c58f';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const light = 210 + Math.floor(rand() * 30);
        ctx.fillStyle = `rgba(${light},${light - 35},${light - 90},${0.22 + rand() * 0.28})`;
        ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
      }
      ctx.strokeStyle = 'rgba(190,150,105,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        ctx.beginPath();
        const y = rand() * h;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.7, y - 8, w, y + 2);
        ctx.stroke();
      }
    }, 256, 256, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(272, 288),
      new THREE.MeshStandardMaterial({ map: repeated(this.asphalt, 25, 27), color: 0x8b8a91, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-11, 0.005, 0);
    ground.receiveShadow = true;
    ground.name = 'city-asphalt';
    this.group.add(ground);

    const promenade = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.2, 288),
      new THREE.MeshStandardMaterial({ map: repeated(this.paving, 3, 90), color: 0xf1d8b8, roughness: 0.92 }),
    );
    promenade.position.set(107.5, 0.1, 0);
    promenade.receiveShadow = true;
    this.group.add(promenade);
    const promenadeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 288), this.curbMat);
    promenadeEdge.position.set(112, 0.28, 0);
    promenadeEdge.receiveShadow = true;
    this.group.add(promenadeEdge);
  }

  buildRoads() {
    const rand = mulberry32(44);
    // solid center lines and dashed lane edges, one instanced mesh for all dashes
    const dashGeom = new THREE.BoxGeometry(0.18, 0.025, 2.8);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xe7d8b3, toneMapped: false });
    const dashes = [];
    for (const road of ROADS) {
      for (const side of [-3.2, 3.2]) {
        for (let along = -136; along <= 136; along += 8) {
          dashes.push({ x: road + side, z: along, ry: 0 });
          dashes.push({ x: along, z: road + side, ry: Math.PI / 2 });
        }
      }
      const lineGeom = new THREE.BoxGeometry(0.12, 0.03, 276);
      const vLine = new THREE.Mesh(lineGeom, new THREE.MeshBasicMaterial({ color: 0xd8a65e, toneMapped: false }));
      vLine.position.set(road, 0.035, 0);
      this.group.add(vLine);
      const hLine = vLine.clone();
      hLine.rotation.y = Math.PI / 2;
      hLine.position.set(0, 0.035, road);
      this.group.add(hLine);
    }
    const inst = new THREE.InstancedMesh(dashGeom, dashMat, dashes.length);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    dashes.forEach((dash, i) => {
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dash.ry);
      matrix.compose(new THREE.Vector3(dash.x, 0.032, dash.z), quat, scale);
      inst.setMatrixAt(i, matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);

    // crosswalk bars at the central crossings
    const bars = [];
    for (const x of ROADS) {
      for (const z of ROADS) {
        if (rand() < 0.4) continue;
        for (let i = -2; i <= 2; i++) {
          bars.push({ x: x + i * 1.7, z: z + ROAD_WIDTH / 2 + 1.4, ry: 0 });
          bars.push({ x: x + ROAD_WIDTH / 2 + 1.4, z: z + i * 1.7, ry: Math.PI / 2 });
        }
      }
    }
    const barInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.03, 2.2), new THREE.MeshBasicMaterial({ color: 0xf1e5c9, toneMapped: false }), bars.length);
    bars.forEach((bar, i) => {
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bar.ry);
      matrix.compose(new THREE.Vector3(bar.x, 0.04, bar.z), quat, scale);
      barInst.setMatrixAt(i, matrix);
    });
    barInst.instanceMatrix.needsUpdate = true;
    this.group.add(barInst);
  }

  buildBlocks() {
    for (const x of [-75, -25, 25, 75]) {
      for (const z of [-75, -25, 25, 75]) {
        const override = BLOCK_OVERRIDES[`${x},${z}`] ?? null;
        this.buildBlock(x, z, override);
      }
    }
  }

  buildBlock(x, z, override) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(BLOCK_SIZE, 0.25, BLOCK_SIZE), this.pavingMat);
    base.position.set(x, 0.125, z);
    base.receiveShadow = true;
    this.group.add(base);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(BLOCK_SIZE + 0.7, 0.3, BLOCK_SIZE + 0.7), this.curbMat);
    curb.position.set(x, 0.03, z);
    curb.receiveShadow = true;
    this.group.add(curb);

    const kind = override?.kind ?? 'default';
    if (kind === 'tower') this.buildTowerBlock(x, z, override);
    else if (kind === 'plaza') this.buildPlazaBlock(x, z, override);
    else if (kind === 'market') this.buildMarketBlock(x, z, override);
    else if (kind === 'club') this.buildClubBlock(x, z, override);
    else if (kind === 'diner') this.buildDinerBlock(x, z, override);
    else if (kind === 'motel') this.buildMotelBlock(x, z, override);
    else if (kind === 'arcade') this.buildArcadeBlock(x, z, override);
    else if (kind === 'shops') this.buildShopBlock(x, z, override);
    else this.buildDefaultBlock(x, z);
  }

  buildTowerBlock(x, z, config) {
    const height = config.height ?? 55;
    const style = config.style ?? 1;
    const towerW = 17 + Math.random() * 4;
    const towerD = 16 + Math.random() * 4;
    // podium and tower; deterministic enough with fixed overrides
    this.createBuilding({
      x, z, w: 27, d: 26, h: 11, style: (style + 2) % 5,
      name: config.name, signFacing: 'pz', rooftop: true, podium: true, noSign: false,
    });
    this.addCollider(x - 13.5, x + 13.5, z - 13, z + 13, 11, 'building');
    this.createBuilding({
      x: x + 0.8, z: z + 0.4, w: towerW, d: towerD, h: height,
      style, name: null, signFacing: 'pz', rooftop: true, crown: true,
    });
    this.addCollider(x + 0.8 - towerW / 2, x + 0.8 + towerW / 2, z + 0.4 - towerD / 2, z + 0.4 + towerD / 2, height, 'building');
    this.landmarks.push({ name: config.name, x, z, color: 0xffc46b, kind: 'tower' });
  }

  buildShopBlock(x, z, config) {
    const angle = this.rng() * Math.PI * 2;
    const name = config.name ?? SHOP_NAMES[Math.floor(this.rng() * SHOP_NAMES.length)];
    const w = 26;
    const d = 23;
    this.createBuilding({
      x, z, w, d, h: 10 + this.rng() * 8, style: Math.floor(this.rng() * 5),
      name, signFacing: 'pz', awning: true, shops: true, balcony: true,
    });
    this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 12, 'building');
    this.addMarketStalls(x - 11, z + 15, 3, angle);
  }

  buildDefaultBlock(x, z) {
    const kind = this.rng();
    if (kind < 0.24) {
      const w = 24;
      const d = 24;
      const h = 16 + this.rng() * 34;
      const style = Math.floor(this.rng() * 5);
      const name = this.rng() > 0.5 ? SHOP_NAMES[Math.floor(this.rng() * SHOP_NAMES.length)] : null;
      this.createBuilding({ x, z, w, d, h, style, name, signFacing: 'pz', awning: true, shops: true, balcony: h < 30 });
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
      return;
    }
    if (kind < 0.55) {
      const w = 12;
      const d = 23;
      for (const side of [-1, 1]) {
        const h = 12 + this.rng() * 28;
        const name = this.rng() > 0.56 ? SHOP_NAMES[Math.floor(this.rng() * SHOP_NAMES.length)] : null;
        this.createBuilding({ x: x + side * 7.5, z, w, d, h, style: Math.floor(this.rng() * 5), name, signFacing: 'pz', awning: true, shops: true });
        this.addCollider(x + side * 7.5 - w / 2, x + side * 7.5 + w / 2, z - d / 2, z + d / 2, h);
      }
      return;
    }
    if (kind < 0.8) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const w = 11.5;
          const d = 11.5;
          const h = 9 + this.rng() * 22;
          this.createBuilding({
            x: x + sx * 7.2, z: z + sz * 7.2, w: w - (this.rng() * 2), d: d - (this.rng() * 2), h,
            style: Math.floor(this.rng() * 5), name: this.rng() > 0.65 ? SHOP_NAMES[Math.floor(this.rng() * SHOP_NAMES.length)] : null,
            signFacing: sz > 0 ? 'pz' : 'nz', awning: true, shops: true, balcony: h > 20,
          });
          this.addCollider(x + sx * 7.2 - 6, x + sx * 7.2 + 6, z + sz * 7.2 - 6, z + sz * 7.2 + 6, h);
        }
      }
      return;
    }
    for (const side of [-1, 1]) {
      const h = 10 + this.rng() * 20;
      this.createBuilding({ x, z: z + side * 7.5, w: 23, d: 12, h, style: Math.floor(this.rng() * 5), name: this.rng() > 0.5 ? SHOP_NAMES[Math.floor(this.rng() * SHOP_NAMES.length)] : null, signFacing: 'px', awning: true, shops: true });
      this.addCollider(x - 11.5, x + 11.5, z + side * 7.5 - 6, z + side * 7.5 + 6, h);
    }
  }

  buildDinerBlock(x, z, config) {
    this.createBuilding({
      x, z: z + 3, w: 25, d: 18, h: 7.5, style: 1, name: config.name,
      signFacing: 'nz', awning: true, shops: true, diner: true,
    });
    this.addCollider(x - 12.5, x + 12.5, z - 6, z + 12, 8);
    this.addParkingLot(x, z - 14, 26, 10);
    this.addNeonPiece(x - 13.2, 9, z + 3, 'ALL NIGHT', 0x49eadf, -Math.PI / 2, 1.1);
    this.landmarks.push({ name: config.name, x, z, color: 0x58efe2, kind: 'diner' });
  }

  buildClubBlock(x, z, config) {
    this.createBuilding({ x, z: z + 4, w: 28, d: 19, h: 9, style: 4, name: config.name, signFacing: 'nz', awning: false, shops: true, club: true });
    this.addCollider(x - 14, x + 14, z - 5.5, z + 13.5, 9);
    this.addNeonPiece(x + 16, 6.5, z + 4, 'NEON', 0xff4d9b, -Math.PI / 2, 2.4);
    this.addNeonPiece(x - 14.2, 4.8, z + 13, 'OPEN LATE', 0x7ef3e1, Math.PI, 1.4);
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 14),
      new THREE.MeshBasicMaterial({ color: 0xff3d90, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(x + 12, 0.3, z + 18);
    this.group.add(beam);
    this.addMarketStalls(x - 11, z + 16, 2, 0.4);
    this.landmarks.push({ name: config.name, x, z, color: 0xff4d9b, kind: 'club' });
  }

  buildMotelBlock(x, z, config) {
    const body = this.createBuilding({ x: x - 1, z: z + 5, w: 27, d: 14, h: 8, style: 2, name: config.name, signFacing: 'nz', awning: true, shops: true });
    this.addCollider(x - 14.5, x + 12.5, z - 2, z + 12, 8);
    this.addParkingLot(x, z - 11, 25, 11);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 5), this.poolMat);
    pool.position.set(x + 9, 0.26, z - 8);
    this.group.add(pool);
    for (let i = 0; i < 5; i++) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), neonMaterial(0xffc785));
      door.position.set(x - 12 + i * 4.8, 1.2, z - 2.1);
      this.group.add(door);
    }
    this.landmarks.push({ name: config.name, x, z, color: 0xffbb6b, kind: 'safehouse' });
  }

  buildMarketBlock(x, z, config) {
    this.createBuilding({ x, z: z - 10, w: 30, d: 10, h: 6, style: 3, name: config.name, signFacing: 'pz', awning: true, shops: true });
    this.addCollider(x - 15, x + 15, z - 15, z - 5, 6);
    this.createBuilding({ x: x - 12, z: z + 7, w: 10, d: 14, h: 5, style: 0, name: null, signFacing: 'px', awning: true });
    this.addCollider(x - 17, x - 7, z, z + 14, 5);
    this.addMarketStalls(x + 1, z + 8, 4, -0.15);
    this.addMarketStalls(x + 9, z + 14, 3, 0.1);
    this.addNeonPiece(x + 8, 7.5, z - 15.2, 'MERCADO', 0xffd365, Math.PI, 1.6);
    this.landmarks.push({ name: config.name, x, z, color: 0xffcf68, kind: 'market' });
  }

  buildArcadeBlock(x, z, config) {
    this.createBuilding({ x: x - 2, z: z + 4, w: 26, d: 18, h: 8, style: 1, name: config.name, signFacing: 'nz', awning: true, shops: true });
    this.addCollider(x - 15, x + 11, z - 5, z + 13, 8);
    this.addNeonPiece(x + 12, 5.2, z + 14, 'PIER', 0x64f4e4, 0, 1.2);
    this.addMarketStalls(x + 14, z - 7, 2, 0.8);
    this.landmarks.push({ name: config.name, x, z, color: 0x67f3e0, kind: 'pier' });
  }

  buildPlazaBlock(x, z, config) {
    const arcade = this.createBuilding({ x: x - 12, z, w: 9, d: 30, h: 8, style: 0, name: 'ARCADE', signFacing: 'px', awning: true, shops: true });
    this.addCollider(x - 16.5, x - 7.5, z - 15, z + 15, 8);
    const fountainMat = flatMaterial(0xd9c7a5, { roughness: 0.9 });
    const fountain = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.8, 0.9, 18), fountainMat);
    basin.position.y = 0.45;
    fountain.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.15, 18), this.poolMat);
    water.position.y = 0.95;
    fountain.add(water);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 2.6, 10), fountainMat);
    spout.position.y = 1.8;
    fountain.add(spout);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), this.poolMat);
    top.position.y = 3.2;
    fountain.add(top);
    fountain.position.set(x + 2, 0.25, z);
    this.group.add(fountain);
    this.addCollider(x - 2.5, x + 6.5, z - 4.5, z + 4.5, 3, 'fountain');
    for (let i = 0; i < 4; i++) this.addPalm(x + 8 + (i % 2) * 7, z - 11 + i * 7, 0.82 + this.rng() * 0.25);
    this.landmarks.push({ name: config.name, x, z, color: 0x74eadf, kind: 'plaza' });
  }

  createBuilding(options) {
    const { x, z, w, d, h, style, name, signFacing = 'pz', awning = false, shops = false, balcony = false, rooftop = false, crown = false } = options;
    const group = new THREE.Group();
    const windowSet = this.windowSets[style % this.windowSets.length];
    const mapX = repeated(windowSet.map, Math.max(1, Math.round(d / 7)), Math.max(1, Math.round(h / 10)));
    const emX = repeated(windowSet.emissive, Math.max(1, Math.round(d / 7)), Math.max(1, Math.round(h / 10)));
    const mapZ = repeated(windowSet.map, Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 10)));
    const emZ = repeated(windowSet.emissive, Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 10)));
    const sideBase = { roughness: 0.82, metalness: 0.05, emissive: new THREE.Color(0xffc17c), emissiveIntensity: 0.62 };
    const matX = new THREE.MeshStandardMaterial({ ...sideBase, map: mapX, emissiveMap: emX });
    const matZ = new THREE.MeshStandardMaterial({ ...sideBase, map: mapZ, emissiveMap: emZ });
    const roof = new THREE.MeshStandardMaterial({ color: 0x776255, roughness: 0.96 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [matX, matX, roof, roof, matZ, matZ]);
    mesh.position.set(x, h / 2 + 0.26, z);
    mesh.castShadow = h < 80;
    mesh.receiveShadow = true;
    group.add(mesh);

    // parapet edge
    const parapetColor = new THREE.MeshStandardMaterial({ color: 0x9b7e6d, roughness: 0.92 });
    const parapetH = 0.6;
    for (const [px, pz, pw, pd] of [[0, d / 2 - 0.2, w, 0.4], [0, -d / 2 + 0.2, w, 0.4], [w / 2 - 0.2, 0, 0.4, d], [-w / 2 + 0.2, 0, 0.4, d]]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(pw, parapetH, pd), parapetColor);
      edge.position.set(x + px, h + 0.55, z + pz);
      group.add(edge);
    }

    if (h > 22) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.7, 2.6), this.darkMetal);
      ac.position.set(x - w * 0.22, h + 1.1, z + d * 0.2);
      group.add(ac);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.5, 10), flatMaterial(0x7f716a));
      tank.position.set(x + w * 0.25, h + 1.5, z - d * 0.22);
      group.add(tank);
    }

    if (crown) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.6, 13, 6), this.darkMetal);
      spire.position.set(x, h + 6.5, z);
      group.add(spire);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 6), neonMaterial(0xff596e, 2));
      beacon.position.set(x, h + 13.2, z);
      group.add(beacon);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowPink, color: 0xff577c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.position.copy(beacon.position);
      glow.scale.set(9, 9, 1);
      group.add(glow);
    }

    if (name) this.addFacadeSign(group, name, x, z, w, d, h, signFacing, rooftop || h > 38);
    if (awning) this.addAwning(group, x, z, w, d, signFacing);
    if (shops) this.addStorefront(group, x, z, w, d, signFacing, style);
    if (balcony) this.addBalconies(group, x, z, w, d, signFacing, h);

    this.group.add(group);
    this.buildings.push({ x, z, w, d, h, name: name ?? null });
    return group;
  }

  addFacadeSign(group, text, x, z, w, d, h, facing, rooftop = false) {
    const key = `${text}-${rooftop ? 'r' : 'f'}`;
    let texture = this.signCache.get(key);
    if (!texture) {
      const neonColors = ['#ff77b4', '#55f5e6', '#ffd36b', '#ff8667'];
      texture = makeSignTexture(text, {
        fg: neonColors[text.length % neonColors.length],
        accent: '#ffe7bb',
        bg: '#181526',
        width: 512,
        height: 160,
      });
      this.signCache.set(key, texture);
    }
    const signW = Math.min(w * 0.85, rooftop ? 12 : 10);
    const signH = rooftop ? 2.8 : 1.8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }));
    const surface = this.facadeSurface(x, z, w, d, facing);
    const y = rooftop ? h + 2.2 : Math.min(h - 1.2, 3.4 + Math.random() * 2.6);
    mesh.position.set(surface.x, y, surface.z);
    mesh.rotation.y = surface.rotation;
    group.add(mesh);
    if (rooftop) {
      const frameMat = this.darkMetal;
      const barA = new THREE.Mesh(new THREE.BoxGeometry(signW + 0.8, 0.22, 0.22), frameMat);
      barA.position.set(surface.x, y + signH / 2 + 0.2, surface.z);
      barA.rotation.y = surface.rotation;
      group.add(barA);
      const barB = barA.clone();
      barB.position.y = y - signH / 2 - 0.2;
      group.add(barB);
      for (const offset of [-signW / 2 + 0.5, signW / 2 - 0.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), frameMat);
        leg.position.set(surface.x + (surface.rotation === 0 || surface.rotation === Math.PI ? offset : 0), h + 1.1, surface.z + (surface.rotation === Math.PI / 2 || surface.rotation === -Math.PI / 2 ? offset : 0));
        group.add(leg);
      }
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowPink, color: 0xff7ab9, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    glow.position.set(surface.x, y, surface.z);
    glow.position.add(this.facadeNormal(facing).multiplyScalar(0.4));
    glow.scale.set(signW * 1.2, signH * 3, 1);
    group.add(glow);
  }

  addAwning(group, x, z, w, d, facing) {
    const surface = this.facadeSurface(x, z, w, d, facing, 1.15);
    const along = facing === 'px' || facing === 'nx' ? d : w;
    const awningW = Math.min(along * 0.7, 8);
    const mat = this.awningMaterial(facing === 'pz' || facing === 'nx' ? ['#f4d9b5', '#d95757'] : ['#f4d9b5', '#2a988f']);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(awningW, 0.16, 1.8), mat);
    canopy.position.set(surface.x, 3.1, surface.z);
    canopy.rotation.y = surface.rotation;
    canopy.castShadow = true;
    group.add(canopy);
    const valance = new THREE.Mesh(new THREE.BoxGeometry(awningW, 0.5, 0.1), mat);
    valance.position.set(surface.x, 2.85, surface.z);
    valance.rotation.y = surface.rotation;
    valance.position.add(this.facadeNormal(facing).multiplyScalar(0.85));
    group.add(valance);
  }

  awningMaterial(colors) {
    const key = colors.join('-');
    if (this.awningMats.has(key)) return this.awningMats.get(key);
    const texture = textureFromLocal((ctx, w, h) => {
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = colors[1];
      for (let x = 0; x < w; x += 24) ctx.fillRect(x, 0, 12, h);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, 4, w, 4);
    }, 128, 32, { wrapS: THREE.RepeatWrapping });
    const mat = new THREE.MeshStandardMaterial({ map: repeated(texture, 3, 1), roughness: 0.9 });
    this.awningMats.set(key, mat);
    return mat;
  }

  addStorefront(group, x, z, w, d, facing, style) {
    const surface = this.facadeSurface(x, z, w, d, facing, 0.05);
    const along = facing === 'px' || facing === 'nx' ? d : w;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.14), glassMaterial(0x273b50));
    door.position.set(surface.x, 1.55, surface.z);
    door.rotation.y = surface.rotation;
    door.position.add(this.facadeNormal(facing).multiplyScalar(0.1));
    group.add(door);
    const light = new THREE.Mesh(new THREE.BoxGeometry(along * 0.8, 0.14, 0.18), neonMaterial(style % 2 ? 0xffc77d : 0x7af4e2, 1.3));
    light.position.set(surface.x, 2.85, surface.z);
    light.rotation.y = surface.rotation;
    light.position.add(this.facadeNormal(facing).multiplyScalar(0.2));
    group.add(light);
  }

  addBalconies(group, x, z, w, d, facing, h) {
    const surface = this.facadeSurface(x, z, w, d, facing, 0.55);
    const levels = Math.min(3, Math.max(1, Math.floor(h / 12)));
    const balconyMat = flatMaterial(0xd9c6a6);
    const railMat = this.darkMetal;
    for (let i = 1; i <= levels; i++) {
      const y = 4.2 + i * 4.2;
      if (y > h - 1.5) break;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 1.15), balconyMat);
      slab.position.set(surface.x, y, surface.z);
      slab.rotation.y = surface.rotation;
      group.add(slab);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 0.08), railMat);
      rail.position.set(surface.x, y + 0.8, surface.z);
      rail.rotation.y = surface.rotation;
      rail.position.add(this.facadeNormal(facing).multiplyScalar(0.5));
      group.add(rail);
    }
  }

  facadeNormal(facing) {
    if (facing === 'px') return new THREE.Vector3(1, 0, 0);
    if (facing === 'nx') return new THREE.Vector3(-1, 0, 0);
    if (facing === 'nz') return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3(0, 0, 1);
  }

  facadeSurface(x, z, w, d, facing, offset = 0.12) {
    const n = this.facadeNormal(facing);
    return {
      x: x + n.x * (w / 2 + offset),
      z: z + n.z * (d / 2 + offset),
      rotation: facing === 'px' ? Math.PI / 2 : facing === 'nx' ? -Math.PI / 2 : facing === 'nz' ? Math.PI : 0,
    };
  }

  addNeonPiece(x, y, z, text, color, rotation, scale = 1) {
    const texture = makeSignTexture(text, {
      fg: `#${new THREE.Color(color).getHexString()}`,
      accent: '#ffeab2', bg: '#171627', width: 384, height: 128,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7 * scale, 2.2 * scale), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }));
    sign.position.set(x, y, z);
    sign.rotation.y = rotation;
    this.group.add(sign);
  }

  addParkingLot(x, z, w, d) {
    const lot = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), new THREE.MeshStandardMaterial({ color: 0x30333c, roughness: 1 }));
    lot.position.set(x, 0.3, z);
    this.group.add(lot);
    for (let i = -2; i <= 2; i++) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 2.4), new THREE.MeshBasicMaterial({ color: 0xe6dcc1 }));
      mark.position.set(x + i * 4.5, 0.35, z);
      this.group.add(mark);
    }
  }

  addMarketStalls(x, z, count, rotation = 0) {
    const fabric = [0xff795e, 0x56d6c5, 0xffce69, 0xe77fb2];
    for (let i = 0; i < count; i++) {
      const px = x + Math.cos(rotation) * (i - (count - 1) / 2) * 4.7;
      const pz = z + Math.sin(rotation) * (i - (count - 1) / 2) * 4.7;
      const color = fabric[i % fabric.length];
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 2.1), flatMaterial(0x735c4a));
      table.position.set(px, 0.6, pz);
      table.rotation.y = rotation;
      this.group.add(table);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 2.8), flatMaterial(color));
      canopy.position.set(px, 2.6, pz);
      canopy.rotation.y = rotation;
      canopy.castShadow = true;
      this.group.add(canopy);
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), this.darkMetal);
        pole.position.set(px + Math.cos(rotation) * side * 1.7, 1.3, pz + Math.sin(rotation) * side * 1.7);
        this.group.add(pole);
      }
      for (let k = 0; k < 3; k++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.65), flatMaterial(k === 1 ? 0xd65d4b : 0xb88b51));
        crate.position.set(px - 1 + k * 0.9, 1.2, pz + 0.2);
        crate.rotation.y = rotation + k * 0.4;
        this.group.add(crate);
      }
    }
  }

  buildOuterRing() {
    const rand = this.rng;
    for (const z of [-75, -25, 25, 75]) {
      const h = 10 + rand() * 28;
      this.createBuilding({ x: -121, z, w: 19, d: 28, h, style: Math.floor(rand() * 5), name: rand() > 0.55 ? SHOP_NAMES[Math.floor(rand() * SHOP_NAMES.length)] : null, signFacing: 'px', awning: true, shops: true });
      this.addCollider(-130.5, -111.5, z - 14, z + 14, h);
    }
    for (const x of [-75, -25, 25, 75]) {
      for (const z of [-126, 126]) {
        const h = 9 + rand() * 24;
        this.createBuilding({ x, z, w: 26, d: 17, h, style: Math.floor(rand() * 5), name: null, signFacing: z < 0 ? 'px' : 'pz', awning: true, shops: true });
        this.addCollider(x - 13, x + 13, z - 8.5, z + 8.5, h);
      }
    }
  }

  buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.BoxGeometry(62, 0.35, 300),
      new THREE.MeshStandardMaterial({ map: repeated(this.sand, 12, 60), color: 0xffdda9, roughness: 1 }),
    );
    sand.position.set(139, 0.03, 0);
    sand.receiveShadow = true;
    this.group.add(sand);
    const wetSand = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.22, 300),
      new THREE.MeshStandardMaterial({ color: 0xb99266, roughness: 0.8, metalness: 0.15 }),
    );
    wetSand.position.set(168.5, 0.04, 0);
    this.group.add(wetSand);
    const welcome = this.addGroundSign(127, 0.5, -122, 'PUERTO SOL', 'PLAYA ABIERTA · KM 0', -Math.PI / 2, 18);
    welcome.rotation.y = -Math.PI / 2;
    this.landmarks.push({ name: 'PLAYA SOL', x: 145, z: -120, color: 0x67e7dc, kind: 'beach' });
  }

  buildBoardwalk() {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.22, 292),
      new THREE.MeshStandardMaterial({ map: repeated(this.makeWoodTexture(), 4, 70), color: 0x9c6b46, roughness: 0.9 }),
    );
    board.position.set(113.6, 0.22, 0);
    board.receiveShadow = true;
    this.group.add(board);
    // seaward rail posts, instanced to keep the draw count low
    const postGeom = new THREE.BoxGeometry(0.13, 1.15, 0.13);
    const postMat = flatMaterial(0x5c4638, { roughness: 0.9 });
    const posts = new THREE.InstancedMesh(postGeom, postMat, 60);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) {
      matrix.makeTranslation(116.4, 0.85, -138 + i * 4.7);
      posts.setMatrixAt(i, matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    this.group.add(posts);
    for (const z of [-138, 138]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 276), postMat);
      rail.position.set(116.4, 1.4, 0);
      this.group.add(rail);
    }
    for (let z = -125; z <= 125; z += 25) this.addBench(110.7, z);
    for (let z = -100; z <= 100; z += 40) this.addPalm(117.8, z, 0.9 + this.rng() * 0.2);
  }

  addBench(x, z) {
    const group = new THREE.Group();
    const wood = flatMaterial(0x7f5639);
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.24), wood);
      slat.position.set(0, 0.48, -0.25 + i * 0.25);
      group.add(slat);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.7), this.darkMetal);
      leg.position.set(side * 0.8, 0.25, 0);
      group.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 0.1), wood);
    back.position.set(0, 0.78, -0.36);
    back.rotation.x = -0.18;
    group.add(back);
    group.position.set(x, 0.16, z);
    group.rotation.y = Math.PI;
    this.group.add(group);
  }

  buildPalms() {
    for (let i = 0; i < 12; i++) this.addPalm(105.4, -108 + i * 19 + this.rng() * 5, 0.78 + this.rng() * 0.32);
    for (let i = 0; i < 18; i++) {
      const x = 124 + this.rng() * 36;
      const z = -130 + this.rng() * 260;
      this.addPalm(x, z, 0.75 + this.rng() * 0.48);
    }
    for (let i = 0; i < 6; i++) this.addPalm(151, -40 + i * 20, 1.05 + this.rng() * 0.3);
  }

  addPalm(x, z, scale = 1) {
    const palm = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x826344, roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const radius = (0.34 - i * 0.05) * scale;
      const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius, 2.15 * scale, 6), trunkMat);
      segment.position.set(Math.sin(i * 0.34) * 0.28 * scale, (0.8 + i * 2.05) * scale, 0);
      segment.rotation.z = -0.04 - i * 0.03;
      palm.add(segment);
    }
    const crown = new THREE.Group();
    crown.position.set(Math.sin(3 * 0.34) * 0.32 * scale, 9.2 * scale, 0);
    const frondMat = new THREE.MeshStandardMaterial({ map: this.frond, alphaTest: 0.32, transparent: true, side: THREE.DoubleSide, roughness: 0.82, color: 0xc8ecb8, emissive: 0x173b26, emissiveIntensity: 0.32 });
    for (let i = 0; i < 8; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(1.7 * scale, 4.1 * scale), frondMat);
      frond.geometry.translate(0, 2.0 * scale, 0);
      frond.rotation.y = i * (Math.PI * 2 / 8) + this.rng() * 0.2;
      frond.rotation.z = 0.86 + this.rng() * 0.24;
      crown.add(frond);
    }
    for (let i = 0; i < 3; i++) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 6, 5), flatMaterial(0x4a3621));
      nut.position.set(Math.cos(i * 2.1) * 0.36, 9.2 * scale + 0.3, Math.sin(i * 2.1) * 0.36);
      palm.add(nut);
    }
    palm.add(crown);
    palm.position.set(x, 0.26, z);
    palm.scale.setScalar(scale);
    this.group.add(palm);
    this.palms.push({ x, z, scale });
    return palm;
  }

  buildBeachProps() {
    const umbrellaColors = [0xff6f59, 0x54d4c7, 0xffcf67, 0xef82b3, 0xf4ead8];
    for (let i = 0; i < 9; i++) {
      const x = 128 + this.rng() * 34;
      const z = -118 + this.rng() * 236;
      const color = umbrellaColors[i % umbrellaColors.length];
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), this.darkMetal);
      pole.position.y = 1.6;
      group.add(pole);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.35, 0.9, 12, 1, true), flatMaterial(color, { side: THREE.DoubleSide }));
      canopy.position.y = 3.2;
      group.add(canopy);
      const towel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 2.6), flatMaterial(i % 2 ? 0xf7ddb2 : 0xf28c7a));
      towel.position.set(1.9, 0.08, 0.2);
      group.add(towel);
      group.position.set(x, 0.2, z);
      group.rotation.y = this.rng() * Math.PI;
      this.group.add(group);
    }
    this.buildLifeguard(139, -57, 0xef5f54);
    this.buildLifeguard(140, 52, 0x38b9ad);
    this.buildBeachBar(122, 92);
    const volley = new THREE.Group();
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), this.darkMetal);
      post.position.set(0, 1.6, side * 7);
      volley.add(post);
    }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 13.5), new THREE.MeshBasicMaterial({ color: 0xf2e7cb, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    net.rotation.y = Math.PI / 2;
    net.position.y = 2.5;
    volley.add(net);
    volley.position.set(145, 0.2, -5);
    this.group.add(volley);
  }

  buildLifeguard(x, z, color) {
    const group = new THREE.Group();
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.4, 1.4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 6), this.darkMetal);
      leg.position.set(sx, 1.6, sz);
      group.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 3.8), flatMaterial(0xa97c54));
    deck.position.y = 3.3;
    group.add(deck);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.4, 3.1), flatMaterial(color));
    hut.position.y = 4.6;
    group.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.3, 4), flatMaterial(0xf1e0bd));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 6.45;
    group.add(roof);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 4.2), flatMaterial(0xa97c54));
    ramp.position.set(0, 1.65, 2.9);
    ramp.rotation.x = 0.71;
    group.add(ramp);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ color: 0xffdc66, side: THREE.DoubleSide }));
    flag.position.set(1.4, 7.3, 0);
    group.add(flag);
    group.position.set(x, 0.2, z);
    group.rotation.y = -Math.PI / 2;
    this.group.add(group);
  }

  buildBeachBar(x, z) {
    const group = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.35, 8), new THREE.MeshStandardMaterial({ map: repeated(this.makeWoodTexture(), 5, 4), color: 0x9a6b49 }));
    deck.position.y = 0.3;
    group.add(deck);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 5.2), flatMaterial(0xf4d4a0));
    canopy.position.set(0, 3.4, 0);
    group.add(canopy);
    for (const sx of [-4, 4]) for (const sz of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.1, 0.16), this.darkMetal);
      post.position.set(sx, 1.8, sz);
      group.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.05, 1.2), flatMaterial(0x8c5a3e));
    bar.position.set(0, 1, -1.2);
    group.add(bar);
    this.addNeonPiece(x, 4.3, z + 2.8, 'BAR SOL', 0xffc866, 0, 0.8);
    group.position.set(x, 0.2, z);
    this.group.add(group);
  }

  buildPiers() {
    this.buildPier(65, 'MUELLE SOL', 0xff6f8d, true);
    this.buildPier(-35, 'MARINA VISTA', 0x5df0dd, false);
  }

  buildPier(z, name, color, ferris) {
    const group = new THREE.Group();
    const deckMat = new THREE.MeshStandardMaterial({ map: repeated(this.makeWoodTexture(), 18, 3), color: 0x9a6d4c, roughness: 0.94 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(66, 0.4, 8.5), deckMat);
    deck.position.set(184, 1.35, z);
    deck.receiveShadow = true;
    group.add(deck);
    for (let x = 154; x < 216; x += 7) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 6), flatMaterial(0x574438));
        post.position.set(x, -1.8, z + side * 4);
        group.add(post);
      }
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(66, 0.12, 0.12), this.darkMetal);
      rail.position.set(184, 2.55, z + side * 4.2);
      group.add(rail);
      for (let x = 154; x <= 216; x += 4.4) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), this.darkMetal);
        post.position.set(x, 1.9, z + side * 4.2);
        group.add(post);
      }
    }
    const arch = new THREE.Group();
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.5), flatMaterial(0x344a51));
      leg.position.set(151.2, 4.2, side * 4.6);
      arch.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 10.4), flatMaterial(0x344a51));
    top.position.set(151.2, 7.4, 0);
    arch.add(top);
    const signTex = makeSignTexture(name, { fg: `#${new THREE.Color(color).getHexString()}`, accent: '#ffe8b6', bg: '#121a26', width: 640, height: 160 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false, side: THREE.DoubleSide }));
    sign.position.set(151.3, 6.2, 0);
    sign.rotation.y = -Math.PI / 2;
    arch.add(sign);
    group.add(arch);
    if (ferris) {
      group.add(this.buildFerrisWheel(202, 1.5, z));
      for (let x = 160; x < 200; x += 10) {
        const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowWarm, color: 0xffd294, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        lamp.position.set(x, 5, z);
        lamp.scale.set(4, 4, 1);
        group.add(lamp);
      }
    } else {
      const boat = this.buildYacht(193, z + 12, 1.9);
      group.add(boat);
      const sign2 = makeSignTexture('FRESH CATCH', { fg: '#ffd36b', accent: '#ff7d7d', sub: 'MARINA VISTA', width: 384, height: 144 });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.1), new THREE.MeshBasicMaterial({ map: sign2, toneMapped: false, side: THREE.DoubleSide }));
      board.position.set(160, 4.2, z + 5.2);
      group.add(board);
    }
    this.group.add(group);
    this.landmarks.push({ name, x: 165, z, color, kind: 'pier' });
  }

  buildFerrisWheel(x, y, z) {
    const group = new THREE.Group();
    const radius = 12;
    const wheel = new THREE.Group();
    wheel.position.set(0, 15, 0);
    const metal = new THREE.MeshStandardMaterial({ color: 0xf1d7ad, roughness: 0.6, metalness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.28, 8, 48), metal);
    wheel.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.14, 6, 40), metal);
    wheel.add(ring2);
    const hue = [0xff5b9c, 0x55f0df, 0xffd36b, 0xff795e];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, radius, 5), metal);
      spoke.position.set(Math.cos(angle) * radius / 2, Math.sin(angle) * radius / 2, 0);
      spoke.rotation.z = angle - Math.PI / 2;
      wheel.add(spoke);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 2.1), flatMaterial(hue[i % hue.length]));
      cabin.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius - 1.1, 0);
      wheel.add(cabin);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), neonMaterial(hue[(i + 1) % hue.length], 2));
      lamp.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.3);
      wheel.add(lamp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 12), flatMaterial(0x48545d));
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    wheel.rotation.y = Math.PI / 2;
    group.add(wheel);
    this.animated.push({ kind: 'ferris', object: wheel, speed: 0.075 });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 16, 6), metal);
      leg.position.set(0, 7.5, side * 6);
      leg.rotation.x = side * 0.25;
      group.add(leg);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.2, 6, 22, Math.PI), metal);
    arch.position.set(0, 3.1, 0);
    arch.rotation.y = Math.PI / 2;
    group.add(arch);
    group.position.set(x, y, z);
    return group;
  }

  buildBoats() {
    const rand = mulberry32(991);
    for (let i = 0; i < 7; i++) {
      const x = 235 + rand() * 130;
      const z = -170 + rand() * 340;
      const size = 0.8 + rand() * 1.1;
      const boat = this.buildYacht(x, z, size);
      boat.rotation.y = rand() * Math.PI * 2;
      this.group.add(boat);
      this.boats.push({ object: boat, baseY: boat.position.y, phase: rand() * Math.PI * 2 });
    }
    const ship = this.buildCruiseShip(310, -185);
    this.group.add(ship);
  }

  buildYacht(x, z, scale) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2 * scale, 1.2 * scale, 6.5 * scale), flatMaterial(0xf1e5cd));
    hull.position.y = 0.2;
    group.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24 * scale, 0.22 * scale, 6.52 * scale), flatMaterial(0x2a8891));
    stripe.position.y = 0.5;
    group.add(stripe);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55 * scale, 0.9 * scale, 2.2 * scale), flatMaterial(0xf8e8cf));
    cabin.position.set(0, 1.1 * scale, 0.5 * scale);
    group.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 7 * scale, 5), this.darkMetal);
    mast.position.set(0, 4.2 * scale, -0.5 * scale);
    group.add(mast);
    const sailMat = new THREE.MeshBasicMaterial({ color: 0xf5dfc6, side: THREE.DoubleSide });
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 7.4 * scale, -0.3 * scale, 0, 2.2 * scale, 1.4 * scale, 0, 2.2 * scale, -3.7 * scale,
    ], 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, sailMat);
    group.add(sail);
    group.position.set(x, -0.3, z);
    group.scale.setScalar(scale);
    return group;
  }

  buildCruiseShip(x, z) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 80), flatMaterial(0xf1e7d5));
    hull.position.y = 1.5;
    group.add(hull);
    const under = new THREE.Mesh(new THREE.BoxGeometry(23, 3, 78), flatMaterial(0x23384c));
    under.position.y = -1.3;
    group.add(under);
    for (let deck = 0; deck < 4; deck++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(15 - deck * 2, 3, 48 - deck * 5), flatMaterial(0xf7ead6));
      block.position.set(0, 6 + deck * 3.4, deck * -2);
      group.add(block);
      for (let i = 0; i < 8; i++) {
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 1.4), neonMaterial(0xffcb86, 1.3));
        light.position.set(-7.6 + deck, 6.7 + deck * 3.4, -18 + i * 5.4);
        group.add(light);
      }
    }
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 5, 10), flatMaterial(0x2c6d77));
    funnel.position.set(0, 21, 8);
    group.add(funnel);
    group.position.set(x, 1.6, z);
    group.rotation.y = -0.35;
    return group;
  }

  buildStreetLights() {
    for (const road of ROADS) {
      for (let along = -120; along <= 120; along += 30) {
        if (Math.abs((along / 10) % 5) < 0.01) continue;
        this.addStreetLight(road - 7.4, along, Math.PI / 2);
        this.addStreetLight(road + 7.4, along + 14, -Math.PI / 2);
      }
    }
    for (const z of [-112, -88, -62, 34, 88, 112]) this.addStreetLight(106.4, z, Math.PI / 2);
  }

  addStreetLight(x, z, rotation) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 5.8, 6), this.lampPoleMat);
    pole.position.y = 2.9;
    group.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), this.lampPoleMat);
    arm.position.set(0.8, 5.75, 0);
    group.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), this.lampGlowMat);
    bulb.position.set(1.55, 5.62, 0);
    group.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowWarm, color: 0xffbf78, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.position.set(1.55, 5.55, 0);
    glow.scale.set(4.4, 4.4, 1);
    group.add(glow);
    group.position.set(x, 0.25, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.streetlights.push({ x, z });
  }

  buildStreetSigns() {
    const names = ['AVENIDA SOL', 'CALLE CORAL', 'PASEO MAR', 'CALLEJÓN NEÓN', 'RUTA BAHÍA'];
    const spots = [
      [-103, 53, 0], [-55, -103, Math.PI / 2], [47, 53, Math.PI], [-3, -53, Math.PI / 2], [97, -53, 0], [53, 103, Math.PI / 2],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [x, z, rotation] = spots[i];
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.3, 5), this.darkMetal);
      pole.position.y = 1.65;
      group.add(pole);
      const tex = makeSignTexture(names[i % names.length], { fg: '#f7eccf', accent: '#47d8b9', bg: '#1f4d4a', width: 320, height: 80 });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
      board.position.set(1.4, 3.15, 0);
      group.add(board);
      group.position.set(x, 0.2, z);
      group.rotation.y = rotation;
      this.group.add(group);
    }
  }

  buildBillboards() {
    const billboard = (x, z, ry, title, sub, colors) => {
      const group = new THREE.Group();
      const texture = makeBillboardTexture(title, sub, colors);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }));
      board.position.y = 9.5;
      group.add(board);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 12, 0.35), this.darkMetal);
        leg.position.set(side * 5.5, 6, 0);
        group.add(leg);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowWarm, color: 0xffb87d, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.position.set(0, 9.5, 0);
      glow.scale.set(20, 13, 1);
      group.add(glow);
      group.position.set(x, 0.2, z);
      group.rotation.y = ry;
      this.group.add(group);
    };
    billboard(-103, -70, Math.PI / 2, 'VISIT PUERTO SOL', 'SUNSET IS A STATE OF MIND', ['#ff775f', '#47245f', '#ffcd72']);
    billboard(53, -116, 0, 'SOLARA 88', 'DRIVE THE COAST', ['#2b938c', '#1d4865', '#ffba6a']);
    billboard(-108, 97, Math.PI / 2, 'MAR ABIERTO 98.7', 'ALL NIGHT RADIO', ['#ff4e97', '#2e1d5c', '#66ede1']);
  }

  addGroundSign(x, y, z, title, sub, rotation, width) {
    const tex = makeSignTexture(title, { fg: '#ffe6ac', accent: '#54e4d3', sub, bg: '#163a3b', width: 640, height: 160 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    sign.position.set(x, y + width / 8, z);
    sign.rotation.y = rotation;
    this.group.add(sign);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), this.darkMetal);
      post.position.set(x, y + 1.6, z + side * width * 0.25);
      this.group.add(post);
    }
    return sign;
  }

  addCollider(minX, maxX, minZ, maxZ, height = 10, kind = 'building') {
    this.colliders.push({ minX, maxX, minZ, maxZ, height, kind });
  }

  resolveCircle(x, z, radius) {
    let hit = false;
    let nx = 0;
    let nz = 0;
    for (const c of this.colliders) {
      const closestX = clamp(x, c.minX, c.maxX);
      const closestZ = clamp(z, c.minZ, c.maxZ);
      let dx = x - closestX;
      let dz = z - closestZ;
      let d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 0.000001) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        dx /= d; dz /= d;
        x += dx * push;
        z += dz * push;
        nx += dx; nz += dz;
      } else {
        const left = x - c.minX;
        const right = c.maxX - x;
        const near = z - c.minZ;
        const far = c.maxZ - z;
        const min = Math.min(left, right, near, far);
        if (min === left) { x = c.minX - radius; nx -= 1; }
        else if (min === right) { x = c.maxX + radius; nx += 1; }
        else if (min === near) { z = c.minZ - radius; nz -= 1; }
        else { z = c.maxZ + radius; nz += 1; }
      }
    }
    return { x, z, hit, nx, nz };
  }

  clampToLand(x, z) {
    return { x: clamp(x, -128, 165), z: clamp(z, -140, 140) };
  }

  update(time) {
    for (const item of this.animated) {
      if (item.kind === 'ferris') item.object.rotation.x = time * item.speed;
    }
    for (const boat of this.boats) {
      boat.object.position.y = boat.baseY + Math.sin(time * 0.55 + boat.phase) * 0.22;
      boat.object.rotation.z = Math.sin(time * 0.4 + boat.phase) * 0.018;
    }
  }
}

/** Local alias so this module does not export one more utility. */
function textureFromLocal(draw, width, height, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = options.wrapS ?? THREE.ClampToEdgeWrapping;
  texture.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function glassMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.65, emissive: 0x081827, emissiveIntensity: 0.5 });
}

