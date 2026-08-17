import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  { id: 'hero', x: 0.7, y: 0.4, scale: 1.15, rotationY: 0.5, tilt: 0.08 },
  { id: 'about', x: 0.86, y: 0.78, scale: 0.7, rotationY: -0.7, tilt: -0.05 },
  { id: 'services', x: 0.5, y: 0.1, scale: 0.75, rotationY: 0.9, tilt: 0.1 },
  { id: 'use-cases', x: 0.87, y: 0.22, scale: 0.62, rotationY: -0.4, tilt: -0.08 },
  { id: 'clients', x: 0.78, y: 0.32, scale: 0.75, rotationY: 0.6, tilt: 0.06 },
  { id: 'contact', x: 0.8, y: 0.1, scale: 0.9, rotationY: -0.3, tilt: -0.04 },
];

function buildProceduralDrone(): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1d,
    roughness: 0.35,
    metalness: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xdd3333,
    roughness: 0.3,
    metalness: 0.2,
    emissive: 0xdd3333,
    emissiveIntensity: 0.4,
  });
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2e,
    roughness: 0.45,
    metalness: 0.5,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c0d,
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: 0.85,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, 4, 12), bodyMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), accentMat);
  beacon.position.set(0, -0.05, 0.16);
  group.add(beacon);

  const armPositions: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  const rotorGroups: THREE.Group[] = [];

  armPositions.forEach(([sx, sz]) => {
    const armLength = 0.42;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armLength, 0.028, 0.028),
      armMat
    );
    const angle = Math.atan2(sz, sx);
    arm.position.set(
      Math.cos(angle) * (armLength / 2),
      0,
      Math.sin(angle) * (armLength / 2)
    );
    arm.rotation.y = -angle;
    group.add(arm);

    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.036, 0.05, 12),
      armMat
    );
    motor.position.set(Math.cos(angle) * armLength, 0.02, Math.sin(angle) * armLength);
    group.add(motor);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.copy(motor.position);
    rotorGroup.position.y += 0.03;

    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.028), bladeMat);
      blade.rotation.y = (i * Math.PI) / 1;
      rotorGroup.add(blade);
    }

    group.add(rotorGroup);
    rotorGroups.push(rotorGroup);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), accentMat);
    led.position.set(Math.cos(angle) * armLength, 0.05, Math.sin(angle) * armLength);
    group.add(led);
  });

  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), armMat);
  gimbal.position.set(0, -0.12, 0.05);
  group.add(gimbal);

  group.userData.rotors = rotorGroups;
  group.scale.setScalar(2.2);

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

  let mixer: THREE.AnimationMixer | null = null;
  let rotorGroups: THREE.Object3D[] = [];

  const procedural = buildProceduralDrone();
  rig.add(procedural);
  rotorGroups = procedural.userData.rotors ?? [];

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Try loading the real model; keep the procedural drone as a live fallback
  // until (and unless) the GLTF resolves.
  const loader = new GLTFLoader();
  loader.load(
    '/models/drone.glb',
    (gltf) => {
      rig.remove(procedural);
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 1.6;
      model.scale.setScalar(targetSize / maxDim);

      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center.multiplyScalar(targetSize / maxDim));

      rig.add(model);

      // The source rig drives its propellers via named skeleton joints
      // (prop_1_jnt..prop_4_jnt) rather than a simple parent group — spin
      // those directly each frame instead of relying on the "hover" clip,
      // which only animates the body.
      const propJoints: THREE.Object3D[] = [];
      model.traverse((child) => {
        if (/^prop_\d+_jnt/.test(child.name)) propJoints.push(child);
      });
      if (propJoints.length) rotorGroups = propJoints;

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        const hover = gltf.animations.find((a) => a.name === 'hover') ?? gltf.animations[0];
        const action = mixer.clipAction(hover);
        action.play();
      }
    },
    undefined,
    (err) => {
      // GLB failed to load (missing/invalid) — procedural drone stays in place.
      console.warn('drone.glb failed to load, using procedural fallback', err);
    }
  );

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

  const timer = new THREE.Timer();
  timer.connect(document);
  let idleT = 0;

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    idleT += dt;

    const damp = reduceMotion ? 1 : 1 - Math.pow(0.001, dt);
    current.x += (target.x - current.x) * damp;
    current.y += (target.y - current.y) * damp;
    current.scale += (target.scale - current.scale) * damp;
    current.rotationY += (target.rotationY - current.rotationY) * damp;
    current.tilt += (target.tilt - current.tilt) * damp;

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
      // Update the body/hover clip first, then spin the rotors — this way
      // rotor spin always wins even if a clip also targets those joints.
      if (mixer) mixer.update(dt);
      rotorGroups.forEach((r, i) => {
        r.rotation.y += dt * (26 + i * 1.5);
      });
    } else if (mixer) {
      mixer.update(0);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
