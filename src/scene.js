import * as THREE from 'three';

// Procedural texture generators for ultra-clean zero-asset loading
function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Rich gym lifting platform wood grain
  ctx.fillStyle = '#b08d57';
  ctx.fillRect(0, 0, 512, 512);

  // Planks
  const plankHeight = 64;
  for (let y = 0; y < 512; y += plankHeight) {
    ctx.strokeStyle = '#6b4f2c';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, y, 512, plankHeight);

    // Subtle grain lines
    ctx.strokeStyle = 'rgba(70, 45, 18, 0.15)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const lineY = y + Math.random() * plankHeight;
      ctx.moveTo(0, lineY);
      ctx.bezierCurveTo(150, lineY + (Math.random() * 8 - 4), 350, lineY + (Math.random() * 8 - 4), 512, lineY);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createNeonBannerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111317';
  ctx.fillRect(0, 0, 1024, 256);

  // Neon Border
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, 984, 216);

  // Glow text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 24;
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('⚡ 3대 500 CLUB ⚡', 512, 90);

  ctx.shadowColor = '#ff5500';
  ctx.shadowBlur = 18;
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillStyle = '#ff9900';
  ctx.fillText('NO PAIN NO GAIN • LIGHTWEIGHT BABY!', 512, 165);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export class GymScene3D {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0e14);
    this.scene.fog = new THREE.FogExp2(0x0c0e14, 0.04);

    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Camera shake state
    this.shakeIntensity = 0;
    this.targetCameraPos = new THREE.Vector3(0, 2.1, 3.2);
    this.targetCameraLook = new THREE.Vector3(0, 1.3, 0);

    // Current exercise mode: 'bench', 'squat', 'deadlift'
    this.exerciseMode = 'bench';

    // Muscle / Pump scale factors
    this.muscleBulk = 1.0;
    this.pumpMultiplier = 1.0;

    this.initLights();
    this.initEnvironment();
    this.initBarbell();
    this.initLifter();
    this.initParticles();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLights() {
    // Ambient fill
    const ambient = new THREE.AmbientLight(0x242838, 1.2);
    this.scene.add(ambient);

    // Overhead Spotlight over the lifting station
    this.spotLight = new THREE.SpotLight(0xffffff, 4.5);
    this.spotLight.position.set(0, 6, 2);
    this.spotLight.angle = Math.PI / 4;
    this.spotLight.penumbra = 0.5;
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.width = 1024;
    this.spotLight.shadow.mapSize.height = 1024;
    this.scene.add(this.spotLight);

    // Dramatic Neon Rim Lights (Cyan on left, Orange on right)
    this.rimLight1 = new THREE.PointLight(0x00ffcc, 3.5, 12);
    this.rimLight1.position.set(-4, 3, 1);
    this.scene.add(this.rimLight1);

    this.rimLight2 = new THREE.PointLight(0xff4400, 3.5, 12);
    this.rimLight2.position.set(4, 3, 1);
    this.scene.add(this.rimLight2);
  }

  initEnvironment() {
    // 1. Lifting Platform (Wood center + Rubber wings)
    const platformGroup = new THREE.Group();

    // Wood center
    const woodGeo = new THREE.BoxGeometry(2.4, 0.1, 3.2);
    const woodMat = new THREE.MeshStandardMaterial({
      map: createWoodTexture(),
      roughness: 0.35,
      metalness: 0.05
    });
    const woodPlatform = new THREE.Mesh(woodGeo, woodMat);
    woodPlatform.position.set(0, 0.05, 0);
    woodPlatform.receiveShadow = true;
    platformGroup.add(woodPlatform);

    // Rubber sides
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.85 });
    const rubberLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 3.2), rubberMat);
    rubberLeft.position.set(-1.8, 0.05, 0);
    rubberLeft.receiveShadow = true;
    platformGroup.add(rubberLeft);

    const rubberRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 3.2), rubberMat);
    rubberRight.position.set(1.8, 0.05, 0);
    rubberRight.receiveShadow = true;
    platformGroup.add(rubberRight);

    this.scene.add(platformGroup);

    // 2. Gym Wall & Neon Sign
    const wallGeo = new THREE.PlaneGeometry(16, 9);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.9 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 4.5, -4.5);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Neon Gym Banner
    const bannerGeo = new THREE.PlaneGeometry(5, 1.25);
    const bannerMat = new THREE.MeshBasicMaterial({
      map: createNeonBannerTexture(),
      transparent: true
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 4.8, -4.45);
    this.scene.add(banner);

    // 3. Power Rack & Bench
    this.rackGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.8, roughness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdde4ec, metalness: 0.95, roughness: 0.15 });

    // Upright posts
    const postGeo = new THREE.BoxGeometry(0.12, 3.2, 0.12);
    const postPositions = [
      [-1.1, 1.6, -0.6], [1.1, 1.6, -0.6],
      [-1.1, 1.6, 0.6],  [1.1, 1.6, 0.6]
    ];
    postPositions.forEach(pos => {
      const post = new THREE.Mesh(postGeo, steelMat);
      post.position.set(...pos);
      post.castShadow = true;
      this.rackGroup.add(post);
    });

    // Top crossbars
    const barXGeo = new THREE.BoxGeometry(2.32, 0.1, 0.1);
    const topBarBack = new THREE.Mesh(barXGeo, steelMat);
    topBarBack.position.set(0, 3.15, -0.6);
    this.rackGroup.add(topBarBack);

    const topBarFront = new THREE.Mesh(barXGeo, steelMat);
    topBarFront.position.set(0, 3.15, 0.6);
    this.rackGroup.add(topBarFront);

    // Safety arms (chrome)
    const safetyGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.3, 16);
    safetyGeo.rotateX(Math.PI / 2);
    const safetyL = new THREE.Mesh(safetyGeo, chromeMat);
    safetyL.position.set(-1.1, 0.9, 0);
    this.rackGroup.add(safetyL);

    const safetyR = new THREE.Mesh(safetyGeo, chromeMat);
    safetyR.position.set(1.1, 0.9, 0);
    this.rackGroup.add(safetyR);

    // Bench (Black Leather with red stitch piping)
    this.benchGroup = new THREE.Group();
    const padMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 1.8), padMat);
    pad.position.set(0, 0.55, 0);
    pad.castShadow = true;
    this.benchGroup.add(pad);

    const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
    const legFront = new THREE.Mesh(legGeo, steelMat);
    legFront.position.set(0, 0.25, 0.7);
    const legBack = new THREE.Mesh(legGeo, steelMat);
    legBack.position.set(0, 0.25, -0.7);
    this.benchGroup.add(legFront, legBack);

    this.scene.add(this.rackGroup);
    this.scene.add(this.benchGroup);

    // Weight Plate Trees on sides
    this.initPlateTrees();
  }

  initPlateTrees() {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2b303c, metalness: 0.7, roughness: 0.3 });
    [-2.8, 2.8].forEach(x => {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 16), treeMat);
      stand.position.set(x, 0.9, -1.2);
      stand.castShadow = true;
      this.scene.add(stand);

      // Spare plates hanging
      const plateGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24);
      plateGeo.rotateZ(Math.PI / 2);
      const redPlate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 }));
      redPlate.position.set(x + 0.12, 1.2, -1.2);
      this.scene.add(redPlate);

      const bluePlate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.4 }));
      bluePlate.position.set(x - 0.12, 0.7, -1.2);
      this.scene.add(bluePlate);
    });
  }

  initBarbell() {
    this.barbellGroup = new THREE.Group();

    // Knurled Olympic Bar (2.2m)
    // We create multiple segments so the bar can dynamically bend under heavy weight!
    this.barSegments = [];
    const segCount = 9;
    const segWidth = 2.2 / segCount;
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xccd5df,
      metalness: 0.95,
      roughness: 0.2
    });

    for (let i = 0; i < segCount; i++) {
      const segGeo = new THREE.CylinderGeometry(0.024, 0.024, segWidth, 16);
      segGeo.rotateZ(Math.PI / 2);
      const seg = new THREE.Mesh(segGeo, barMat);
      seg.position.x = -1.1 + (i + 0.5) * segWidth;
      seg.castShadow = true;
      this.barSegments.push(seg);
      this.barbellGroup.add(seg);
    }

    // Sleeves on left and right
    const sleeveGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.42, 20);
    sleeveGeo.rotateZ(Math.PI / 2);
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xeef3f8, metalness: 0.98, roughness: 0.1 });

    this.sleeveL = new THREE.Mesh(sleeveGeo, sleeveMat);
    this.sleeveL.position.set(-1.05, 0, 0);
    this.barbellGroup.add(this.sleeveL);

    this.sleeveR = new THREE.Mesh(sleeveGeo, sleeveMat);
    this.sleeveR.position.set(1.05, 0, 0);
    this.barbellGroup.add(this.sleeveR);

    // Plate groups for dynamic weight loading
    this.platesLGroup = new THREE.Group();
    this.platesRGroup = new THREE.Group();
    this.barbellGroup.add(this.platesLGroup);
    this.barbellGroup.add(this.platesRGroup);

    // Initial position (Bench starting rack position)
    this.barbellGroup.position.set(0, 1.45, 0);
    this.scene.add(this.barbellGroup);

    this.updatePlates(60); // default 60kg
  }

  // Olympic Bumper Plate Colors: 25kg (Red), 20kg (Blue), 15kg (Yellow), 10kg (Green), 5kg (White), 2.5kg (Black)
  updatePlates(totalWeightKg) {
    // Skip rebuild if nothing changed; otherwise dispose old GPU resources
    if (this.platesWeight === totalWeightKg) return;
    this.platesWeight = totalWeightKg;
    const disposeGroup = (grp) => {
      while (grp.children.length > 0) {
        const c = grp.children[0];
        grp.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      }
    };
    disposeGroup(this.platesLGroup);
    disposeGroup(this.platesRGroup);

    const barWeight = 20; // Olympic Bar is 20kg
    let sideWeight = Math.max(0, (totalWeightKg - barWeight) / 2);

    const plateTypes = [
      { weight: 25, color: 0xd32f2f, radius: 0.38, width: 0.065 }, // Red
      { weight: 20, color: 0x1976d2, radius: 0.38, width: 0.055 }, // Blue
      { weight: 15, color: 0xfbc02d, radius: 0.38, width: 0.045 }, // Yellow
      { weight: 10, color: 0x388e3c, radius: 0.38, width: 0.038 }, // Green
      { weight: 5,  color: 0xf5f5f5, radius: 0.28, width: 0.030 }, // White
      { weight: 2.5,color: 0x212121, radius: 0.20, width: 0.025 }  // Black
    ];

    let offsetL = -0.92;
    let offsetR = 0.92;

    plateTypes.forEach(p => {
      while (sideWeight >= p.weight) {
        sideWeight -= p.weight;

        // Create Left Plate
        const geo = new THREE.CylinderGeometry(p.radius, p.radius, p.width, 32);
        geo.rotateZ(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.45,
          metalness: 0.15
        });

        const plateL = new THREE.Mesh(geo, mat);
        plateL.position.x = offsetL - p.width / 2;
        plateL.castShadow = true;
        this.platesLGroup.add(plateL);
        offsetL -= (p.width + 0.01);

        // Create Right Plate
        const plateR = new THREE.Mesh(geo, mat);
        plateR.position.x = offsetR + p.width / 2;
        plateR.castShadow = true;
        this.platesRGroup.add(plateR);
        offsetR += (p.width + 0.01);
      }
    });

    // Add Collars (Clamps)
    const collarGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.035, 20);
    collarGeo.rotateZ(Math.PI / 2);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.9, roughness: 0.2 });

    const collarL = new THREE.Mesh(collarGeo, collarMat);
    collarL.position.x = offsetL - 0.02;
    this.platesLGroup.add(collarL);

    const collarR = new THREE.Mesh(collarGeo, collarMat);
    collarR.position.x = offsetR + 0.02;
    this.platesRGroup.add(collarR);
  }

  // Bar bending physics based on weight load and acceleration
  setBarbellBend(weightKg, accelerationY = 0) {
    const bendFactor = Math.max(0, (weightKg - 80) * 0.00035 + accelerationY * 0.0002);
    const segCount = this.barSegments.length;
    const midIndex = (segCount - 1) / 2;

    this.barSegments.forEach((seg, i) => {
      const distFromCenter = Math.abs(i - midIndex) / midIndex;
      // Parabolic deflection
      seg.position.y = -(1 - distFromCenter * distFromCenter) * bendFactor * 0.18;
    });

    this.platesLGroup.position.y = -bendFactor * 0.04;
    this.platesRGroup.position.y = -bendFactor * 0.04;
  }

  initLifter() {
    this.lifterGroup = new THREE.Group();

    // Stylized skin and workout gear materials
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xdeb887,
      roughness: 0.6,
      metalness: 0.08
    });
    this.tankMat = new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.7
    });
    this.beltMat = new THREE.MeshStandardMaterial({
      color: 0x8b0000, // Inzer Red Belt
      roughness: 0.4,
      metalness: 0.2
    });

    // Torso / Chest
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), this.tankMat);
    this.torso.position.set(0, 0.85, 0);
    this.torso.castShadow = true;
    this.lifterGroup.add(this.torso);

    // Head + Red Headband
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), this.skinMat);
    this.head.position.set(0, 1.35, 0);
    this.head.castShadow = true;
    this.lifterGroup.add(this.head);

    const headband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.185, 0.05, 24),
      new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.5 })
    );
    headband.position.set(0, 1.38, 0);
    this.lifterGroup.add(headband);

    // Lifting Belt around waist
    this.belt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 24), this.beltMat);
    this.belt.position.set(0, 0.62, 0);
    this.belt.visible = false;
    this.lifterGroup.add(this.belt);

    // Arms: Shoulders, Upper Arms (Biceps), Forearms, Hands
    const bicepGeo = new THREE.CylinderGeometry(0.11, 0.10, 0.38, 16);
    this.bicepL = new THREE.Mesh(bicepGeo, this.skinMat);
    this.bicepR = new THREE.Mesh(bicepGeo, this.skinMat);
    this.bicepL.castShadow = true;
    this.bicepR.castShadow = true;

    const forearmGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.38, 16);
    this.forearmL = new THREE.Mesh(forearmGeo, this.skinMat);
    this.forearmR = new THREE.Mesh(forearmGeo, this.skinMat);
    this.forearmL.castShadow = true;
    this.forearmR.castShadow = true;

    this.lifterGroup.add(this.bicepL, this.bicepR, this.forearmL, this.forearmR);

    // Legs: Quads and Shoes
    const quadGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.55, 16);
    this.quadL = new THREE.Mesh(quadGeo, this.tankMat);
    this.quadR = new THREE.Mesh(quadGeo, this.tankMat);
    this.quadL.position.set(-0.2, 0.3, 0);
    this.quadR.position.set(0.2, 0.3, 0);
    this.lifterGroup.add(this.quadL, this.quadR);

    this.scene.add(this.lifterGroup);
  }

  // Pose the lifter for the current exercise and align arms to the bar.
  // Arm targets are computed in world space, then converted into the lifter group's local space.
  updateArmRig(barbellPos, tiltRad = 0, prog = 1) {
    const g = this.lifterGroup;
    let shoulderL, shoulderR, handL, handR;

    if (this.exerciseMode === 'bench') {
      g.position.set(0, 0.55, -0.1);
      g.rotation.set(-Math.PI / 2, 0, 0);
      g.scale.set(1, 1, 1);
      const grip = 0.52;
      handL = new THREE.Vector3(-grip, barbellPos.y, barbellPos.z);
      handR = new THREE.Vector3(grip, barbellPos.y, barbellPos.z);
      shoulderL = new THREE.Vector3(-0.28, 0.7, -0.05);
      shoulderR = new THREE.Vector3(0.28, 0.7, -0.05);
    } else if (this.exerciseMode === 'squat') {
      // Feet stay planted; the body compresses as the bar goes down
      const sy = Math.max(0.55, barbellPos.y / 1.45);
      g.position.set(0, 0, 0.05);
      g.rotation.set((1 - sy) * 0.5, 0, 0);
      g.scale.set(1, sy, 1);
      const sh = barbellPos.y - 0.12;
      handL = new THREE.Vector3(-0.55, barbellPos.y, barbellPos.z - 0.02);
      handR = new THREE.Vector3(0.55, barbellPos.y, barbellPos.z - 0.02);
      shoulderL = new THREE.Vector3(-0.3, sh, 0.08);
      shoulderR = new THREE.Vector3(0.3, sh, 0.08);
    } else {
      // Deadlift: hinge from bent-over (prog 0) to standing (prog 1)
      const p = Math.max(0, Math.min(1, prog));
      g.position.set(0, 0, -0.18);
      g.rotation.set((1 - p) * 0.75, 0, 0);
      g.scale.set(1, 0.85 + 0.15 * p, 1);
      g.updateMatrixWorld(true);
      const shW = new THREE.Vector3(0, 1.17, 0).applyMatrix4(g.matrixWorld);
      const grip = 0.45;
      handL = new THREE.Vector3(-grip, barbellPos.y, barbellPos.z);
      handR = new THREE.Vector3(grip, barbellPos.y, barbellPos.z);
      shoulderL = new THREE.Vector3(-0.26, shW.y, shW.z);
      shoulderR = new THREE.Vector3(0.26, shW.y, shW.z);
    }

    // Tilt: the bar's ends rise/fall
    handL.y -= Math.sin(tiltRad) * 0.5;
    handR.y += Math.sin(tiltRad) * 0.5;

    g.updateMatrixWorld(true);
    this.positionArmBones(this.bicepL, this.forearmL, shoulderL, handL);
    this.positionArmBones(this.bicepR, this.forearmR, shoulderR, handR);
  }

  positionArmBones(bicep, forearm, startW, endW) {
    const midW = new THREE.Vector3().addVectors(startW, endW).multiplyScalar(0.5);
    midW.x += (startW.x < 0 ? -0.16 : 0.16); // elbow flare
    const toLocal = (v) => this.lifterGroup.worldToLocal(v.clone());
    const s = toLocal(startW), m = toLocal(midW), e = toLocal(endW);
    const up = new THREE.Vector3(0, 1, 0);

    bicep.position.copy(s).lerp(m, 0.5);
    bicep.quaternion.setFromUnitVectors(up, new THREE.Vector3().subVectors(m, s).normalize());
    forearm.position.copy(m).lerp(e, 0.5);
    forearm.quaternion.setFromUnitVectors(up, new THREE.Vector3().subVectors(e, m).normalize());
  }

  setBeltVisible(on) {
    if (this.belt) this.belt.visible = !!on;
  }

  setMusclePump(pump01) {
    this.pumpMultiplier = 1.0 + pump01 * 0.35;
    const s = this.muscleBulk * this.pumpMultiplier;
    this.bicepL.scale.set(s, 1, s);
    this.bicepR.scale.set(s, 1, s);
    this.torso.scale.set(s, 1, s * 1.15);
  }

  initParticles() {
    // Chalk dust & Sweat particle system
    const pCount = 180;
    const pGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    this.pVel = [];

    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = 0.5 + Math.random() * 1.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      this.pVel.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        Math.random() * 0.03 + 0.01,
        (Math.random() - 0.5) * 0.02
      ));
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.035,
      transparent: true,
      opacity: 0.6
    });

    this.particles = new THREE.Points(pGeo, pMat);
    this.scene.add(this.particles);
  }

  triggerChalkBurst(pos = new THREE.Vector3(0, 1.2, 0)) {
    const positions = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] = pos.x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;

      this.pVel[i].set(
        (Math.random() - 0.5) * 0.12,
        Math.random() * 0.14 + 0.04,
        (Math.random() - 0.5) * 0.12
      );
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  setExercise(mode) {
    this.exerciseMode = mode;
    if (mode === 'bench') {
      this.benchGroup.visible = true;
      this.targetCameraPos.set(0, 2.1, 2.9);
      this.targetCameraLook.set(0, 1.0, 0);
    } else if (mode === 'squat') {
      this.benchGroup.visible = false;
      this.targetCameraPos.set(0, 1.6, 3.3);
      this.targetCameraLook.set(0, 1.05, 0);
    } else if (mode === 'deadlift') {
      this.benchGroup.visible = false;
      this.targetCameraPos.set(0, 1.5, 3.2);
      this.targetCameraLook.set(0, 0.8, 0);
    }
  }

  addScreenShake(amount) {
    this.shakeIntensity = Math.min(this.shakeIntensity + amount, 0.45);
  }

  onWindowResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render(deltaTime, barbellY, barbellTilt, weightKg, accelY, prog = 1) {
    // 1. Update Barbell
    this.barbellGroup.position.y = barbellY;
    this.barbellGroup.rotation.z = barbellTilt;
    this.setBarbellBend(weightKg, accelY);

    // 2. Update Lifter IK & Pose
    this.updateArmRig(this.barbellGroup.position, barbellTilt, prog);

    // 3. Update Chalk Particles
    const pos = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] += this.pVel[i].x;
      pos[i * 3 + 1] += this.pVel[i].y;
      pos[i * 3 + 2] += this.pVel[i].z;
      this.pVel[i].y -= 0.0025; // gravity on dust
    }
    this.particles.geometry.attributes.position.needsUpdate = true;

    // 4. Smooth Camera follow + Screen Shake
    this.camera.position.lerp(this.targetCameraPos, 0.06);
    const lookAt = this.targetCameraLook.clone();

    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      lookAt.x += (Math.random() - 0.5) * this.shakeIntensity * 0.5;
      this.shakeIntensity *= 0.88;
    }

    this.camera.lookAt(lookAt);

    this.renderer.render(this.scene, this.camera);
  }
}
