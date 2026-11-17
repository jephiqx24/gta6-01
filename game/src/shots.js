// Screenshot staging: ?shot=cover|street|chase|mission sets up a deterministic
// scene (positions, wanted level, mission, camera subject) so each screenshot
// is a real render of the game in a readable state.
export function applyShot(name, game) {
  const { player, traffic, police, missions, city } = game;
  game.state = 'playing';
  game.autoDrive = false;
  missions.start();

  const putInCar = (car, x, z, heading, speed) => {
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.speed = speed;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = heading;
    player.inCar = true;
    player.car = car;
    player.lastCar = car;
    player.mesh.visible = false;
  };

  if (name === 'cover') {
    // Downtown drive, mission 1 active, wanted 2, First Fare on the HUD.
    const car = traffic.parked[0] || traffic.cars[0];
    putInCar(car, 0, 60, Math.PI, 18);
    game.autoDrive = true;
    police.wanted = 2;
    missions.setIndex(0);
  } else if (name === 'street') {
    // On foot beside a parked car, pedestrians on the sidewalk.
    const car = traffic.parked[1] || traffic.parked[0];
    player.inCar = false;
    player.car = null;
    player.mesh.visible = true;
    player.pos.set(car.pos.x + 2.4, 0, car.pos.z + 1.5);
    player.heading = Math.PI / 2;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    police.wanted = 0;
    missions.setIndex(0);
  } else if (name === 'chase') {
    // Wanted 4, police flanking, high speed, Hot Wheels on the HUD.
    const car = traffic.cars[1] || traffic.parked[0];
    putInCar(car, 0, -40, Math.PI, 30);
    game.autoDrive = true;
    police.wanted = 4;
    missions.setIndex(1);
    // Pull the police cars in close around the player.
    police.policeCars.forEach((pc, i) => {
      const a = [-0.6, 0.6, 2.6][i % 3];
      pc.pos.set(car.pos.x + Math.sin(a) * 12, 0, car.pos.z + Math.cos(a) * 12 - 6);
      pc.heading = Math.PI;
      pc.speed = 28;
    });
  } else if (name === 'mission') {
    // Cabbie in progress: passenger aboard, marker toward the Marina.
    const car = traffic.parked[2] || traffic.cars[0];
    putInCar(car, 100, 55, Math.PI / 2, 22);
    game.autoDrive = true;
    police.wanted = 1;
    missions.setIndex(2);
    // Advance to the delivery stage (passenger aboard, marker to the Marina).
    missions.setStage(1);
  }
  return name;
}

export function shotNames() {
  return ['cover', 'street', 'chase', 'mission'];
}
