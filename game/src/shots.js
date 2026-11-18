// SHOTS.JS — deterministic photo calls for the four judged frames.
// Each pose arranges the real simulation, then hands the camera a fixed seat.
export const SHOTS = {
  cover: {
    title: 'Cover',
    query: '?shot=cover',
    caption: 'TEO CRUZ — THE BOARDWALK, GOLDEN HOUR',
  },
  drive: {
    title: 'Drive',
    query: '?shot=drive',
    caption: 'SOLARA 88 — COAST BOULEVARD',
  },
  chase: {
    title: 'Chase',
    query: '?shot=chase',
    caption: 'THREE STARS — COAST BOULEVARD',
  },
  mission: {
    title: 'Mission',
    query: '?shot=mission',
    caption: 'PLAZA MIRAMAR — DROP IN PROGRESS',
  },
};

export function applyShot(name, game) {
  const { player, traffic, missions, hud, world } = game;
  hud.setShotMode();
  hud.dialogueQueue.length = 0;
  hud.dialogueTime = 0;
  hud.el.eventBanner?.classList.remove('visible');
  hud.el.toastStack.innerHTML = '';
  hud.el.missionCard.classList.add('visible');
  hud.setInteractPrompt(null);
  player.health = 100;
  player.armor = 40;
  player.money = 850;
  player.cameraShake = 0;
  player.car.health = 100;
  traffic.clearPoliceCars();
  traffic.wanted = 0;
  player.car.position.set(96.8, 0.06, 28);
  player.car.heading = 0;
  player.car.speed = 0;
  player.mode = 'car';
  player.characterGroup.visible = false;
  player.carModel.position.copy(player.car.position);
  player.carModel.rotation.y = 0;
  game.city.update(8);

  if (name === 'cover') setCover(game);
  else if (name === 'drive') setDrive(game);
  else if (name === 'chase') setChase(game);
  else if (name === 'mission') setMission(game);

  hud.setRadio(game.audio.stationInfo.name, game.audio.stationInfo.track);
  world.update(0, 8, player.position);
  hud.update(0.016, game.state());
  game.flushHudPrompt();
  if (name === 'cover' || name === 'drive' || name === 'mission') hud.setInteractPrompt(null);
  return SHOTS[name];
}

function setCamera(game, px, py, pz, tx, ty, tz, fov = 58) {
  const camera = game.world.camera;
  camera.position.set(px, py, pz);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.lookAt(tx, ty, tz);
  game.shotCamera = { position: [px, py, pz], target: [tx, ty, tz], fov };
}

function setPlayerCar(player, x, z, heading, speed = 0) {
  player.mode = 'car';
  player.characterGroup.visible = false;
  player.car.position.set(x, 0.06, z);
  player.car.heading = heading;
  player.car.speed = speed;
  player.carGroup.visible = true;
  player.carModel.position.copy(player.car.position);
  player.carModel.rotation.set(0, heading, 0);
  for (const wheel of player.frontWheels) wheel.rotation.y = 0;
}

function setPlayerFoot(player, x, z, heading) {
  player.mode = 'foot';
  player.car.speed = 0;
  player.foot.position.set(x, player.groundHeight(x, z), z);
  player.foot.heading = heading;
  player.foot.walk = 0;
  player.characterGroup.visible = true;
  player.characterGroup.position.copy(player.foot.position);
  player.characterGroup.rotation.y = heading;
  player.legPivots[0].rotation.x = 0.12;
  player.legPivots[1].rotation.x = -0.12;
  player.armPivots[0].rotation.x = -0.08;
  player.armPivots[1].rotation.x = 0.08;
}

function parkCar(player, x, z, heading) {
  player.car.position.set(x, 0.06, z);
  player.car.heading = heading;
  player.car.speed = 0;
  player.carModel.position.copy(player.car.position);
  player.carModel.rotation.set(0, heading, 0);
  player.carGroup.visible = true;
}

function placeTraffic(game, placements) {
  game.traffic.cars.forEach((car, index) => {
    const placement = placements[index];
    if (!placement) {
      car.group.visible = false;
      return;
    }
    car.group.visible = true;
    car.axis = placement.axis ?? car.axis;
    car.line = placement.line ?? car.line;
    car.dir = placement.dir ?? car.dir;
    car.lane = placement.dir > 0 ? 3.15 : -3.15;
    car.along = placement.along ?? car.along;
    game.traffic.positionTrafficCar(car);
    car.group.visible = true;
  });
}

function posePeds(game, placements) {
  game.traffic.peds.forEach((ped) => { ped.group.visible = false; });
  for (let i = 0; i < placements.length; i++) {
    const ped = game.traffic.peds[i];
    if (!ped) continue;
    const [x, z, heading] = placements[i];
    ped.group.visible = true;
    ped.knocked = 0;
    ped.group.position.set(x, 0.3, z);
    ped.group.rotation.set(0, heading, 0);
    ped.legs[0].rotation.x = 0.28;
    ped.legs[1].rotation.x = -0.28;
    ped.arms[0].rotation.x = -0.22;
    ped.arms[1].rotation.x = 0.22;
  }
}

function coverHud(game) {
  const { player, traffic, missions, hud } = game;
  player.money = 850;
  player.health = 100;
  player.armor = 35;
  traffic.wanted = 0;
  missions.showForShot(0, 0);
  missions.timeLeft = 0;
  hud.setPrompt?.(null);
}

function setCover(game) {
  const { player, traffic, missions, hud } = game;
  coverHud(game);
  setPlayerFoot(player, 114.4, 43.5, 0.12);
  parkCar(player, 101.3, 30.5, 0);
  player.footYaw = 0.3;
  player.cameraPitch = 0.21;
  player.health = 100;
  player.armor = 35;
  player.money = 850;
  traffic.wanted = 0;
  posePeds(game, [
    [111.6, 38.8, 0.9],
    [121.5, 31, -0.4],
    [109.8, 61, 0.2],
    [127, 54, 1.4],
  ]);
  placeTraffic(game, [
    { axis: 'z', line: 100, dir: -1, along: -8 },
    { axis: 'z', line: 100, dir: 1, along: 58 },
    { axis: 'x', line: 50, dir: 1, along: 36 },
  ]);
  missions.marker.visible = false;
  setCamera(game, 117.6, 3.35, 51.8, 108.6, 1.35, 31.5, 61);
  hud.dialogueQueue.length = 0;
  hud.dialogueTime = 0;
  hud.el.dialogue.classList.remove('visible');
  hud.showDialogue('TEO CRUZ', 'Sunset on the bay. One ledger, three bad decisions, and a full tank.', 8);
  player.carModel.rotation.y = 0;
  game.shotFocus = { x: 116, z: 44 };
}

function setDrive(game) {
  const { player, traffic, missions, hud } = game;
  setPlayerCar(player, 96.8, 31, 0, 27);
  player.health = 92;
  player.armor = 35;
  player.money = 2140;
  traffic.wanted = 0;
  missions.showForShot(1, 1);
  missions.timeLeft = 74;
  missions.stayTime = 0;
  placeTraffic(game, [
    { axis: 'z', line: 100, dir: -1, along: 2 },
    { axis: 'z', line: 100, dir: 1, along: -23 },
    { axis: 'z', line: 100, dir: -1, along: -50 },
    { axis: 'x', line: 50, dir: 1, along: 38 },
    { axis: 'x', line: -50, dir: -1, along: -8 },
  ]);
  posePeds(game, [
    [110.8, 16, 0.1],
    [122.8, 8, -0.7],
    [108.7, -12, 0.4],
  ]);
  player.footYaw = 0;
  setCamera(game, 96.8, 4.65, 41.5, 96.9, 1.25, 19.5, 61);
  hud.dialogueQueue.length = 0;
  hud.dialogueTime = 0;
  hud.el.dialogue.classList.remove('visible');
  hud.showDialogue('LUNA VELASCO', 'The plaza drop is waiting. Keep the Solara off the sand and the clock off your back.', 7);
  game.shotFocus = { x: 97, z: 31 };
}

function setChase(game) {
  const { player, traffic, missions, hud } = game;
  traffic.arrangeChase(player, 3);
  player.car.position.set(97, 0.06, 23.5);
  player.car.heading = 0;
  player.car.speed = 18;
  player.carModel.position.copy(player.car.position);
  player.carModel.rotation.set(0, 0, 0);
  player.health = 66;
  player.armor = 12;
  player.money = 3120;
  player.mode = 'car';
  player.characterGroup.visible = false;
  traffic.wanted = 3;
  traffic.cops.forEach((cop, index) => {
    if (index >= 3) {
      cop.active = false;
      cop.group.visible = false;
      return;
    }
    cop.active = true;
    cop.group.visible = true;
    const spots = [
      [92.2, 30.8, 0.12],
      [103.0, 28.2, -0.1],
      [94.2, 37.5, 0.05],
    ];
    const [x, z, heading] = spots[index];
    cop.position.set(x, 0.06, z);
    cop.heading = heading;
    cop.speed = 14;
    cop.group.position.set(x, 0.06, z);
    cop.group.rotation.set(0, heading, 0);
    cop.red.visible = index % 2 === 0;
    cop.blue.visible = index % 2 !== 0;
    cop.redGlow.material.opacity = index % 2 === 0 ? 0.95 : 0.06;
    cop.blueGlow.material.opacity = index % 2 === 0 ? 0.06 : 0.95;
    const wheels = cop.wheels;
    wheels.forEach((wheel) => { wheel.rotation.x = 0.2 + index; });
  });
  missions.showForShot(2, 1);
  missions.marker.visible = true;
  missions.placeMarkerAt(-75, 63);
  missions.timeLeft = 0;
  hud.dialogueQueue.length = 0;
  hud.dialogueTime = 0;
  hud.el.dialogue.classList.remove('visible');
  hud.showDialogue('POLICE RADIO', 'All units, red Solara heading north on the coast road. Suspect is armed and very late for something.', 8);
  posePeds(game, [
    [110.6, 22, -0.2],
    [122.5, 38, 0.4],
    [108.4, 49, 0.1],
  ]);
  placeTraffic(game, [
    { axis: 'z', line: 100, dir: 1, along: 55 },
    { axis: 'z', line: 100, dir: -1, along: -12 },
    { axis: 'x', line: 50, dir: 1, along: 62 },
  ]);
  setCamera(game, 95.0, 2.95, 11.2, 97.8, 1.12, 23.2, 58);
  game.shotFocus = { x: 97, z: 24 };
}

function setMission(game) {
  const { player, traffic, missions, hud } = game;
  setPlayerFoot(player, -54.5, -17.6, -0.8);
  player.health = 86;
  player.armor = 62;
  player.money = 2140;
  player.footYaw = 0.65;
  player.cameraPitch = 0.19;
  traffic.wanted = 0;
  missions.showForShot(1, 1);
  missions.timeLeft = 71;
  missions.placeMarkerAt(-62, -25);
  hud.dialogueQueue.length = 0;
  hud.dialogueTime = 0;
  hud.el.dialogue.classList.remove('visible');
  hud.showDialogue('LUNA VELASCO', 'Second parcel, fountain side. The gala is in forty minutes — make it look effortless.', 8);
  posePeds(game, [
    [-48.2, -20.4, 2.5],
    [-58.5, -33.8, 0.4],
    [-42.6, -31.6, -1.2],
    [-69, -17, 1.2],
  ]);
  placeTraffic(game, [
    { axis: 'x', line: -50, dir: -1, along: -28 },
    { axis: 'x', line: -50, dir: 1, along: 14 },
    { axis: 'z', line: -50, dir: 1, along: -76 },
    { axis: 'z', line: 0, dir: -1, along: -60 },
  ]);
  setCamera(game, -43.5, 4.15, -7.2, -59.8, 1.2, -25.3, 59);
  game.shotFocus = { x: -58, z: -22 };
}

