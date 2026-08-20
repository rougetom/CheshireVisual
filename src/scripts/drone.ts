import * as THREE from 'three';

interface Waypoint {
  id: string;
  /** viewport-relative anchor, 0-1 */
  x: number;
  y: number;
  scale: number;
  rotationY: number;
  tilt: number;
}

// One flight waypoint per section — the drone eases toward whichever
// waypoint corresponds to the section currently centred in the viewport.
// x/y are viewport fractions (0-1); tuned to clear each section's text blocks
// (see README for the layout each targets empty space around).
const WAYPOINTS: Waypoint[] = [
  { id: 'hero', x: 0.7, y: 0.4, scale: 1.15, rotationY: 0.18, tilt: 0.08 },
  { id: 'about', x: 0.86, y: 0.78, scale: 0.7, rotationY: -0.7, tilt: -0.05 },
  { id: 'services', x: 0.5, y: 0.1, scale: 0.75, rotationY: 0.9, tilt: 0.1 },
  { id: 'use-cases', x: 0.87, y: 0.22, scale: 0.62, rotationY: -0.4, tilt: -0.08 },
  { id: 'clients', x: 0.78, y: 0.32, scale: 0.75, rotationY: 0.6, tilt: 0.06 },
  { id: 'contact', x: 0.8, y: 0.1, scale: 0.9, rotationY: -0.3, tilt: -0.04 },
];

// Hand-authored from primitives, styled after a compact folding-arm
// consumer quadcopter (light plastic shell, front 3-axis gimbal camera,
// paired obstacle-avoidance lenses, orange-tipped two-blade props — swapped
// for the site's red accent). Local +Z is "forward" (the direction the
// gimbal camera points); a rig at rotation.y = 0 therefore faces the
// viewer, since the camera looks back down -Z toward the origin.
function buildProceduralDrone(): THREE.Group {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xdcdcdf,
    roughness: 0.55,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2b2b2f,
    roughness: 0.4,
    metalness: 0.35,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.12,
    metalness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xdd3333,
    roughness: 0.3,
    metalness: 0.15,
    emissive: 0xdd3333,
    emissiveIntensity: 0.35,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xcfcfd2,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });

  // Body shell
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.075, 0.26), shellMat);
  body.position.set(0, 0, -0.01);
  group.add(body);

  // Top sensor bump + vent detail
  const bump = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.09), shellMat);
  bump.position.set(0, 0.052, 0.06);
  group.add(bump);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.05), trimMat);
  vent.position.set(0.03, 0.071, -0.03);
  vent.rotation.y = 0.5;
  group.add(vent);

  // Paired obstacle-avoidance sensors on the nose
  [-1, 1].forEach((s) => {
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), trimMat);
    sensor.position.set(s * 0.085, 0.018, 0.125);
    group.add(sensor);
  });

  // 3-axis gimbal housing + lens, slung below the nose
  const gimbal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.075), trimMat);
  gimbal.position.set(0, -0.058, 0.115);
  group.add(gimbal);
  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.032, 16),
    trimMat
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, -0.058, 0.15);
  group.add(lensBarrel);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 16), lensMat);
  lens.position.set(0, -0.058, 0.167);
  group.add(lens);

  // 2 rear landing legs
  [-1, 1].forEach((s) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), shellMat);
    leg.position.set(s * 0.1, -0.075, -0.14);
    leg.rotation.z = s * 0.12;
    group.add(leg);
  });

  // 4 folding arms in an X configuration, motors + 2-blade props at each tip
  const armLength = 0.34;
  const armAngles = [45, 135, 225, 315].map((deg) => (deg * Math.PI) / 180);
  const rotorGroups: THREE.Group[] = [];

  armAngles.forEach((angle) => {
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, armLength, 8), shellMat);
    arm.position.copy(dir.clone().multiplyScalar(armLength / 2));
    arm.position.y = 0.01;
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -angle;
    group.add(arm);

    const motorPos = dir.clone().multiplyScalar(armLength);
    motorPos.y = 0.022;

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.03, 12), trimMat);
    motor.position.copy(motorPos);
    group.add(motor);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 8, 16), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(motorPos).setY(motorPos.y + 0.013);
    group.add(ring);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.copy(motorPos).setY(motorPos.y + 0.017);

    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Group();
      blade.rotation.y = i * Math.PI;

      const main = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.003, 0.022), bladeMat);
      main.position.x = 0.075;
      blade.add(main);

      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.0035, 0.022), accentMat);
      tip.position.x = 0.1625;
      blade.add(tip);

      rotorGroup.add(blade);
    }

    group.add(rotorGroup);
    rotorGroups.push(rotorGroup);
  });

  group.userData.rotors = rotorGroups;
  group.scale.setScalar(1.3);

  return group;
}

export function initDroneOverlay() {
  const canvas = document.getElementById('drone-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdd3333, 0.5);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  const rig = new THREE.Group();
  scene.add(rig);

  const drone = buildProceduralDrone();
  rig.add(drone);
  const rotorGroups: THREE.Object3D[] = drone.userData.rotors ?? [];

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Flight target state
  const current = { x: 0.7, y: 0.42, scale: 1.15, rotationY: 0.5, tilt: 0.08 };
  const target = { ...current };
  let lastX = current.x;
  let lastY = current.y;

  function computeTarget() {
    const viewportCenter = window.scrollY + window.innerHeight / 2;
    let closest = WAYPOINTS[0];
    let closestDist = Infinity;

    for (const wp of WAYPOINTS) {
      const el = document.getElementById(wp.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const elCenter = window.scrollY + rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - viewportCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = wp;
      }
    }

    target.x = closest.x;
    target.y = closest.y;
    target.scale = closest.scale;
    target.rotationY = closest.rotationY;
    target.tilt = closest.tilt;
  }

  let scrollTicking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(() => {
          computeTarget();
          scrollTicking = false;
        });
      }
    },
    { passive: true }
  );
  computeTarget();
  Object.assign(current, target);

  // Entrance: start below the viewport and nose-up, so the drone flies up
  // into its hero position on first load instead of just appearing there.
  // Runs as its own slow tween, decoupled from the (much snappier)
  // scroll-follow damping below, so it actually reads as a fly-in.
  const entranceDuration = reduceMotion ? 0 : 1.6;
  let entranceElapsed = 0;
  const entranceFrom = {
    y: target.y + 0.9,
    scale: target.scale * 0.85,
    tilt: target.tilt + 0.18,
  };
  if (!reduceMotion) Object.assign(current, entranceFrom);

  const timer = new THREE.Timer();
  timer.connect(document);
  let idleT = 0;

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    idleT += dt;

    const damp = reduceMotion ? 1 : 1 - Math.pow(0.001, dt);
    current.x += (target.x - current.x) * damp;
    current.rotationY += (target.rotationY - current.rotationY) * damp;

    if (entranceElapsed < entranceDuration) {
      entranceElapsed += dt;
      const p = Math.min(1, entranceElapsed / entranceDuration);
      const e = p * p * (3 - 2 * p);
      current.y = entranceFrom.y + (target.y - entranceFrom.y) * e;
      current.scale = entranceFrom.scale + (target.scale - entranceFrom.scale) * e;
      current.tilt = entranceFrom.tilt + (target.tilt - entranceFrom.tilt) * e;
    } else {
      current.y += (target.y - current.y) * damp;
      current.scale += (target.scale - current.scale) * damp;
      current.tilt += (target.tilt - current.tilt) * damp;
    }

    const ndcX = current.x * 2 - 1;
    const ndcY = -(current.y * 2 - 1);
    const depth = 4;
    const vFOV = (camera.fov * Math.PI) / 180;
    const viewHeight = 2 * Math.tan(vFOV / 2) * depth;
    const viewWidth = viewHeight * camera.aspect;

    const worldX = (ndcX * viewWidth) / 2;
    const worldY = (ndcY * viewHeight) / 2 + (reduceMotion ? 0 : Math.sin(idleT * 0.8) * 0.06);

    rig.position.set(worldX, worldY, 0);
    rig.scale.setScalar(current.scale);

    const velX = current.x - lastX;
    const velY = current.y - lastY;
    lastX = current.x;
    lastY = current.y;

    rig.rotation.y = current.rotationY + (reduceMotion ? 0 : Math.sin(idleT * 0.5) * 0.08);
    rig.rotation.z = current.tilt - velX * 18;
    rig.rotation.x = velY * 10;

    if (!reduceMotion) {
      rotorGroups.forEach((r, i) => {
        r.rotation.y += dt * (26 + i * 1.5);
      });
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
