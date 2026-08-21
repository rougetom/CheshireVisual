import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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
  { id: 'hero', x: 0.7, y: 0.4, scale: 1.15, rotationY: 1.57, tilt: 0.08 },
  { id: 'about', x: 0.86, y: 0.78, scale: 0.7, rotationY: -0.7, tilt: -0.05 },
  { id: 'services', x: 0.5, y: 0.1, scale: 0.75, rotationY: 0.9, tilt: 0.1 },
  { id: 'use-cases', x: 0.87, y: 0.22, scale: 0.62, rotationY: -0.4, tilt: -0.08 },
  { id: 'clients', x: 0.78, y: 0.32, scale: 0.75, rotationY: 0.6, tilt: 0.06 },
  { id: 'contact', x: 0.8, y: 0.1, scale: 0.9, rotationY: -0.3, tilt: -0.04 },
];

// Fallback drone, shown immediately and swapped out the instant the real
// GLB (public/models/drone.glb) finishes loading — so the overlay is never
// blank while the model loads, and never breaks outright if it fails to.
// Hand-authored from primitives, styled after a compact folding-arm
// consumer quadcopter photographed for reference (light satin-plastic shell,
// front 3-axis gimbal camera, paired obstacle-avoidance lenses, dark
// paddle-shaped props with an accent tip). Every body/housing part uses
// RoundedBoxGeometry rather than sharp-edged boxes — bevelled edges catching
// specular light are what read as "manufactured product" instead of
// "blockout"; flat box faces do not, no matter how many of them there are.
// Local +Z is "forward" (the direction the gimbal camera points); a rig at
// rotation.y = 0 therefore faces the viewer, since the camera looks back
// down -Z toward the origin. (The GLB isn't authored to that convention —
// see the empirically-found rotationY offset on the hero waypoint below.)
function buildProceduralDrone(): THREE.Group {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcdcdf,
    roughness: 0.45,
    metalness: 0.05,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
  });
  const trimMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b2b2f,
    roughness: 0.32,
    metalness: 0.25,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x050506,
    roughness: 0.06,
    metalness: 0.7,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: 0xdd3333,
    roughness: 0.28,
    metalness: 0.1,
    clearcoat: 0.5,
    emissive: 0xdd3333,
    emissiveIntensity: 0.25,
  });
  // Corrected from an earlier light-grey assumption after zooming into the
  // reference photo's propeller crops: the blades are dark charcoal, not
  // light grey, with a broad paddle silhouette (not a thin rectangular strip).
  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: 0x38383b,
    roughness: 0.38,
    metalness: 0.08,
    clearcoat: 0.3,
    side: THREE.DoubleSide,
  });

  function bladeShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0, 0.006);
    s.quadraticCurveTo(0.02, 0.011, 0.06, 0.014);
    s.quadraticCurveTo(0.1, 0.011, 0.15, 0.003);
    s.lineTo(0.15, -0.003);
    s.quadraticCurveTo(0.1, -0.011, 0.06, -0.014);
    s.quadraticCurveTo(0.02, -0.011, 0, -0.006);
    s.closePath();
    return s;
  }

  function bladeTipShape(): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(0.115, 0.009);
    s.quadraticCurveTo(0.135, 0.007, 0.15, 0.003);
    s.lineTo(0.15, -0.003);
    s.quadraticCurveTo(0.135, -0.007, 0.115, -0.009);
    s.closePath();
    return s;
  }

  // Body shell — rounded, not a sharp box, to catch light like the
  // reference's satin-plastic housing.
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.075, 0.26, 4, 0.022), shellMat);
  body.position.set(0, 0, -0.01);
  group.add(body);

  // Top sensor bump + vent detail
  const bump = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.035, 0.09, 3, 0.012), shellMat);
  bump.position.set(0, 0.052, 0.06);
  group.add(bump);
  const vent = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.006, 0.05, 2, 0.002), trimMat);
  vent.position.set(0.03, 0.071, -0.03);
  vent.rotation.y = 0.5;
  group.add(vent);

  // Paired obstacle-avoidance sensors on the nose — a larger lens-style
  // sensor on one side, a small dot sensor on the other (per reference).
  const sensorLens = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 24), trimMat);
  sensorLens.rotation.x = Math.PI / 2;
  sensorLens.position.set(-0.045, 0.03, 0.128);
  group.add(sensorLens);
  const sensorDot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 16, 16), trimMat);
  sensorDot.position.set(0.075, 0.02, 0.125);
  group.add(sensorDot);

  // 3-axis gimbal housing + lens, slung below the nose — rounded pod, not
  // a box, matching the reference's smooth camera housing.
  const gimbal = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.06, 0.075, 3, 0.02), trimMat);
  gimbal.position.set(0, -0.058, 0.115);
  group.add(gimbal);
  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.032, 24),
    trimMat
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, -0.058, 0.15);
  group.add(lensBarrel);
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0025, 10, 24), shellMat);
  lensRing.position.set(0, -0.058, 0.166);
  group.add(lensRing);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.019, 24), lensMat);
  lens.position.set(0, -0.058, 0.167);
  group.add(lens);

  // 2 rear landing legs
  [-1, 1].forEach((s) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 12), shellMat);
    leg.position.set(s * 0.1, -0.075, -0.14);
    leg.rotation.z = s * 0.12;
    group.add(leg);
  });

  function makeBlade(): THREE.Group {
    const bladeGroup = new THREE.Group();

    const mainGeo = new THREE.ExtrudeGeometry(bladeShape(), {
      depth: 0.003,
      bevelEnabled: true,
      bevelThickness: 0.0006,
      bevelSize: 0.0006,
      bevelSegments: 2,
      curveSegments: 12,
    });
    mainGeo.translate(0, 0, -0.0015);
    mainGeo.rotateX(-Math.PI / 2);
    bladeGroup.add(new THREE.Mesh(mainGeo, bladeMat));

    const tipGeo = new THREE.ExtrudeGeometry(bladeTipShape(), {
      depth: 0.0032,
      bevelEnabled: true,
      bevelThickness: 0.0006,
      bevelSize: 0.0006,
      bevelSegments: 2,
      curveSegments: 12,
    });
    tipGeo.translate(0, 0, -0.0016);
    tipGeo.rotateX(-Math.PI / 2);
    bladeGroup.add(new THREE.Mesh(tipGeo, accentMat));

    return bladeGroup;
  }

  // 4 folding arms in an X configuration, motors + 2-blade props at each tip
  const armLength = 0.34;
  const armAngles = [45, 135, 225, 315].map((deg) => (deg * Math.PI) / 180);
  const rotorGroups: THREE.Group[] = [];

  armAngles.forEach((angle) => {
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

    // Hinge knuckle where the arm folds against the body, with two small
    // fastener studs — visible in the reference's arm-root close-up.
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.026, 20), shellMat);
    knuckle.position.copy(dir.clone().multiplyScalar(0.07));
    knuckle.position.y = 0.014;
    knuckle.rotation.z = Math.PI / 2;
    knuckle.rotation.y = -angle;
    group.add(knuckle);
    [-1, 1].forEach((s) => {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 10), trimMat);
      stud.position.copy(knuckle.position).setY(knuckle.position.y + s * 0.011);
      group.add(stud);
    });

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, armLength, 20), shellMat);
    arm.position.copy(dir.clone().multiplyScalar(armLength / 2));
    arm.position.y = 0.01;
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -angle;
    group.add(arm);

    const motorPos = dir.clone().multiplyScalar(armLength);
    motorPos.y = 0.022;

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.03, 24), trimMat);
    motor.position.copy(motorPos);
    group.add(motor);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 10, 24), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(motorPos).setY(motorPos.y + 0.013);
    group.add(ring);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.copy(motorPos).setY(motorPos.y + 0.017);

    for (let i = 0; i < 2; i++) {
      const blade = makeBlade();
      blade.rotation.y = i * Math.PI;
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 4);

  // Image-based lighting from a neutral room environment gives the satin
  // plastic/clearcoat materials real reflections instead of the flat, matte
  // look flat ambient + directional-only lighting produces — this is most of
  // what makes MeshPhysicalMaterial read as "product photo" rather than
  // "game asset". Combined with a 3-point rig (key/fill/rim) for direction.
  // The GLB originally shipped a fully-metallic, fully-rough, pure-white
  // fallback material (its real colour texture lived inside a legacy
  // KHR_materials_pbrSpecularGlossiness extension three.js doesn't parse) —
  // converted to a proper metallic-roughness baseColorTexture at the asset
  // level (see README), so this lighting rig no longer needs to fake colour
  // via a tinted rim light.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.4);
  key.position.set(2.4, 3.2, 3.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdce8ff, 0.45);
  fill.position.set(-3, 0.6, 1.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-1.2, 1.8, -3.2);
  scene.add(rim);
  const accentLight = new THREE.PointLight(0xdd3333, 0.4, 3, 2);
  accentLight.position.set(0.6, -0.4, 1.4);
  scene.add(accentLight);

  const rig = new THREE.Group();
  scene.add(rig);

  const procedural = buildProceduralDrone();
  rig.add(procedural);
  let rotorGroups: THREE.Object3D[] = procedural.userData.rotors ?? [];

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
  // until (and unless) the GLTF resolves. scene.environment (set above)
  // applies to its materials automatically, so it gets the same PBR
  // lighting as the fallback.
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

      // Deliberately not playing the source "hover" clip: it bakes in a
      // large body-relative vertical excursion (presumably meant for a
      // dedicated showreel shot), which fights our own flight-position
      // waypoints and periodically carried the model out of frame. Rotor
      // spin above is independent of it and unaffected.
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
