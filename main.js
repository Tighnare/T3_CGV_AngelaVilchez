import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);
scene.fog = new THREE.Fog(0x1a1410, 20, 90);

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.4;
const WALK_SPEED = 5;

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.05,
    500
);
camera.position.set(0, PLAYER_HEIGHT, 75);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);


scene.add(new THREE.HemisphereLight(0xffeeb1, 0x3a2a1d, 2.0));
const moon = new THREE.DirectionalLight(0xfff0dd, 2.2);
moon.position.set(20, 40, 10);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -45;
moon.shadow.camera.right = 45;
moon.shadow.camera.top = 90;
moon.shadow.camera.bottom = -90;
scene.add(moon);


const viewLight = new THREE.PointLight(0xffffff, 1.2, 6);
camera.add(viewLight);

const ARENA_W = 60;
const ARENA_L = 160;
const WALL_H = 4;
const WALL_T = 1.5;

const START_POS = { x: 0, z: 75 };
const EXTRACTION = { x: 0, z: -68, size: 14 };


function createWoodTexture(baseColor, lineColor, plankCount = 8, isCrate = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    const plankH = 512 / plankCount;

    for (let i = 0; i < plankCount; i++) {
        const y = i * plankH;

        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, y, 512, plankH);

        ctx.fillStyle = lineColor;
        for (let j = 0; j < 45; j++) {
            const gx = Math.random() * 512;
            const gy = y + Math.random() * plankH;
            const gw = 30 + Math.random() * 100;
            const gh = 1 + Math.random() * 2;
            ctx.globalAlpha = 0.12 + Math.random() * 0.18;
            ctx.fillRect(gx, gy, gw, gh);
        }
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = '#1a0f07';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        if (!isCrate) {
            const jointX = ((i * 173) % 380) + 60;
            ctx.beginPath();
            ctx.moveTo(jointX, y);
            ctx.lineTo(jointX, y + plankH);
            ctx.stroke();
        }
    }

    if (isCrate) {
        ctx.strokeStyle = '#3d2512';
        ctx.lineWidth = 28;
        ctx.strokeRect(14, 14, 484, 484);
        ctx.beginPath();
        ctx.moveTo(14, 14);
        ctx.lineTo(498, 498);
        ctx.moveTo(498, 14);
        ctx.lineTo(14, 498);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const floorWoodTex = createWoodTexture('#4a301d', '#261509', 8, false);
floorWoodTex.repeat.set(ARENA_W / 4, ARENA_L / 8);

const wallWoodBaseTex = createWoodTexture('#7c5230', '#422611', 6, false);
const crateWoodTex = createWoodTexture('#9c6d41', '#593a1e', 5, true);

const colliders = [];
const wallMeshes = [];

function addWall(cx, cz, w, d, color = 0xffffff, h = WALL_H, isCrate = false) {
    let material;

    if (isCrate) {
        material = new THREE.MeshStandardMaterial({
            map: crateWoodTex,
            color: color,
            roughness: 0.85
        });
    } else {
        const wallTex = wallWoodBaseTex.clone();
        wallTex.needsUpdate = true;
        const longSide = Math.max(w, d);
        wallTex.repeat.set(longSide / 4, h / 2);

        material = new THREE.MeshStandardMaterial({
            map: wallTex,
            color: color,
            roughness: 0.85
        });
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    colliders.push({
        minX: cx - w / 2, maxX: cx + w / 2,
        minZ: cz - d / 2, maxZ: cz + d / 2
    });
    wallMeshes.push(mesh);
    return mesh;
}

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_W, ARENA_L),
    new THREE.MeshStandardMaterial({ map: floorWoodTex, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

addWall(-ARENA_W / 2 - WALL_T / 2, 0, WALL_T, ARENA_L + 2 * WALL_T);
addWall( ARENA_W / 2 + WALL_T / 2, 0, WALL_T, ARENA_L + 2 * WALL_T);
addWall(0, -ARENA_L / 2 - WALL_T / 2, ARENA_W + 2 * WALL_T, WALL_T);
addWall(0,  ARENA_L / 2 + WALL_T / 2, ARENA_W + 2 * WALL_T, WALL_T);

const WALL_ROWS = [50, 25, 0, -25, -50];
WALL_ROWS.forEach((z, i) => {
    if (i % 2 === 0) addWall(-6, z, 48, WALL_T);
    else addWall(6, z, 48, WALL_T);
});

const CRATES = [
    [-12, 64, 3], [14, 68, 2.5],
    [-6, 38, 3],  [10, 42, 2],
    [-14, 12, 3], [8, 14, 2.5],
    [14, -12, 3], [-8, -14, 2.5],
    [-12, -38, 3], [6, -36, 2.5]
];
for (const [x, z, size] of CRATES) {
    addWall(x, z, size, size, 0xffffff, size, true);
}

const startPad = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x3366cc })
);
startPad.position.set(START_POS.x, 0.05, START_POS.z);
startPad.receiveShadow = true;
scene.add(startPad);

const extractionPad = new THREE.Mesh(
    new THREE.BoxGeometry(EXTRACTION.size, 0.1, EXTRACTION.size),
    new THREE.MeshStandardMaterial({ color: 0x22cc66, emissive: 0x0a5a2a })
);
extractionPad.position.set(EXTRACTION.x, 0.05, EXTRACTION.z);
extractionPad.receiveShadow = true;
scene.add(extractionPad);

const elevatorMat = new THREE.MeshStandardMaterial({ color: 0x8c969e, metalness: 0.4, roughness: 0.5 });
const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), elevatorMat);
leftPillar.position.set(-3.5, 2.1, -74);
const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), elevatorMat);
rightPillar.position.set(3.5, 2.1, -74);
const topBeam = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.8, 0.8), elevatorMat);
topBeam.position.set(0, 4.2, -74);
scene.add(leftPillar, rightPillar, topBeam);



const hud = document.querySelector('#hud');
const messageEl = document.querySelector('#message');
const loader = new GLTFLoader();

const weaponHolder = new THREE.Group();
const WEAPON_BASE_POS = new THREE.Vector3(0.26, -0.22, -0.55);
weaponHolder.position.copy(WEAPON_BASE_POS);
camera.add(weaponHolder);

const muzzleLight = new THREE.PointLight(0xffaa33, 0, 7);
muzzleLight.position.set(0, 0.05, -0.7);
weaponHolder.add(muzzleLight);

let recoilOffset = 0;
let flashTimer = 0;

const weapons = {
    1: { name: 'SPAS-12', ammo: 4, maxAmmo: 8, damage: 2, model: null },
    2: { name: 'M4A1',    ammo: 8, maxAmmo: 16, damage: 1, model: null }
};
let currentWeapon = 1;

const zombies = [];
const zombieMeshes = [];
const zombieMixers = [];

function updateHUD() {
    const w = weapons[currentWeapon];
    const aliveCount = zombies.filter(z => z.alive).length;
    hud.innerHTML = `
        <div style="font-size:16px; color:#a7b5c6;">Zombis restantes: ${aliveCount}</div>
        <div style="font-size:18px; color:#ffc107;">[1] SPAS-12: ${weapons[1].ammo} · [2] M4A1: ${weapons[2].ammo}</div>
        <div>${w.name}: ${w.ammo}</div>
    `;
}

function selectWeapon(slot) {
    if (!weapons[slot] || gameEnded) return;
    currentWeapon = slot;

    if (weapons[1].model) weapons[1].model.visible = (slot === 1);
    if (weapons[2].model) weapons[2].model.visible = (slot === 2);

    updateHUD();
}

function loadWeaponModel(path, slot, targetLength) {
    loader.load(
        path,
        (gltf) => {
            const rawModel = gltf.scene;
            rawModel.updateMatrixWorld(true);

   
            rawModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.metalness = Math.min(child.material.metalness ?? 0.5, 0.65);
                    child.material.roughness = Math.max(child.material.roughness ?? 0.4, 0.35);
                }
            });


            const box = new THREE.Box3().setFromObject(rawModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            rawModel.scale.multiplyScalar(targetLength / maxDim);


            rawModel.updateMatrixWorld(true);
            const scaledBox = new THREE.Box3().setFromObject(rawModel);
            const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
            rawModel.position.sub(scaledCenter);


            const pivot = new THREE.Group();
            if (size.x > size.z) {

                pivot.rotation.y = -Math.PI / 2;
            } else {

                pivot.rotation.y = Math.PI;
            }
            pivot.add(rawModel);

            pivot.visible = (currentWeapon === slot);
            weapons[slot].model = pivot;
            weaponHolder.add(pivot);
        },
        undefined,
        (err) => console.error(`No se pudo cargar ${path}:`, err)
    );
}

loadWeaponModel('./models/Shotgun.glb', 1, 0.72);
loadWeaponModel('./models/Rifle.glb',   2, 0.80);



const DETECTION_RANGE = 18;
const CATCH_RANGE = 1.1;
const ZOMBIE_SPEED = 5.2;
const ZOMBIE_RADIUS = 0.45;

const ZOMBIE_SPAWNS = [
    [18, 56], [24, 58, 5.0],
    [-16, 40], [12, 34], [-23, 30, 5.0],
    [-18, 16], [14, 10], [22, 5],
    [-10, -8], [16, -18], [-22, -21, 5.2],
    [-16, -34], [10, -42], [-6, -58], [0, -61, 5.2], [6, -58]
];

loader.load(
    './models/zombie.glb',
    (gltf) => {
        const template = gltf.scene;
        template.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(template);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.78 / size.y;

        for (const [x, z, speed = ZOMBIE_SPEED] of ZOMBIE_SPAWNS) {
            const group = new THREE.Group();
            const clone = SkeletonUtils.clone(template);

            clone.scale.multiplyScalar(scale);
            clone.updateMatrixWorld(true);

            const scaledBox = new THREE.Box3().setFromObject(clone);
            clone.position.y = -scaledBox.min.y;

            clone.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.userData.zombieIndex = zombies.length;
                    zombieMeshes.push(child);
                }
            });


            let mixer = null;
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(clone);
                const action = mixer.clipAction(gltf.animations[0]);
                action.time = Math.random() * gltf.animations[0].duration;
                action.play();
                zombieMixers.push(mixer);
            }

            group.add(clone);
            group.position.set(x, 0, z);
            scene.add(group);

            zombies.push({
                group,
                mixer,
                hp: 2,
                speed,
                alive: true,
                active: false,
                hitTimer: 0
            });
        }

        updateHUD();
    },
    undefined,
    (err) => console.error('No se pudo cargar zombie.glb:', err)
);



const raycaster = new THREE.Raycaster();

function shoot() {
    if (!controls.isLocked || gameEnded) return;

    const w = weapons[currentWeapon];
    if (w.ammo <= 0) return;

    w.ammo--;
    recoilOffset = currentWeapon === 1 ? 0.14 : 0.08;
    flashTimer = 0.05;
    muzzleLight.intensity = 4.0;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(zombieMeshes, false);

    if (hits.length > 0) {
        const hit = hits[0];
        const idx = hit.object.userData.zombieIndex;
        const z = zombies[idx];

        if (z && z.alive) {
            const wallHits = raycaster.intersectObjects(wallMeshes, false);
            const blockedByWall = wallHits.length > 0 && wallHits[0].distance < hit.distance;

            if (!blockedByWall) {
                z.hp -= w.damage;
                z.active = true;
                z.hitTimer = 0.18;

                if (z.hp <= 0) {
                    z.alive = false;
                    z.active = false;
                    if (z.mixer) z.mixer.stopAllAction();
                    z.group.rotation.x = -Math.PI / 2;
                    z.group.position.y = 0.2;
                }
            }
        }
    }

    updateHUD();
}

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) shoot();
});

function updateZombies(delta) {
    if (!controls.isLocked || gameEnded) return;

    for (const z of zombies) {
        if (z.hitTimer > 0) {
            z.hitTimer -= delta;
            z.group.traverse((c) => {
                if (c.isMesh && c.material.emissive) {
                    c.material.emissive.setHex(z.hitTimer > 0 ? 0x660000 : 0x000000);
                }
            });
        }

        if (!z.alive) continue;

        if (z.mixer) {
            z.mixer.update(delta);
        }

        const dx = camera.position.x - z.group.position.x;
        const dz = camera.position.z - z.group.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist <= CATCH_RANGE) {
            endGame(false);
            return;
        }

        if (!z.active && dist <= DETECTION_RANGE) {
            z.active = true;
        }

        if (z.active && dist > 0.1) {
            z.group.rotation.y = Math.atan2(dx, dz);

            const step = z.speed * delta;
            const moveX = (dx / dist) * step;
            const moveZ = (dz / dist) * step;

            const oldX = z.group.position.x;
            const oldZ = z.group.position.z;

            z.group.position.x += moveX;
            if (collides(z.group.position.x, oldZ, ZOMBIE_RADIUS)) {
                z.group.position.x = oldX;
            }

            z.group.position.z += moveZ;
            if (collides(z.group.position.x, z.group.position.z, ZOMBIE_RADIUS)) {
                z.group.position.z = oldZ;
            }
        }
    }
}



const AMMO_SPAWNS = [
    [22, 58],
    [-22, 32],
    [20, 6],
    [-20, -20],
    [18, -44]
];

const ammoPickups = [];
const ammoGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7);
const ammoMat = new THREE.MeshStandardMaterial({
    color: 0xffc107,
    emissive: 0x664400,
    roughness: 0.4
});

for (const [x, z] of AMMO_SPAWNS) {
    const box = new THREE.Mesh(ammoGeo, ammoMat);
    box.position.set(x, 0.45, z);
    box.castShadow = true;
    scene.add(box);
    ammoPickups.push(box);
}

function updatePickups(delta) {
    if (gameEnded) return;

    for (let i = ammoPickups.length - 1; i >= 0; i--) {
        const box = ammoPickups[i];
        box.rotation.y += 1.5 * delta;

        const dx = camera.position.x - box.position.x;
        const dz = camera.position.z - box.position.z;

        if (dx * dx + dz * dz < 1.6 * 1.6) {
            weapons[1].ammo = Math.min(weapons[1].maxAmmo, weapons[1].ammo + 4);
            weapons[2].ammo = Math.min(weapons[2].maxAmmo, weapons[2].ammo + 6);
            scene.remove(box);
            ammoPickups.splice(i, 1);
            updateHUD();
        }
    }
}

let gameEnded = false;

function endGame(victory) {
    if (gameEnded) return;
    gameEnded = true;
    controls.unlock();

    const title = victory
        ? '<span style="color:#22cc66;">¡MISIÓN COMPLETADA!</span><br><span style="font-size:24px;">Has llegado al ascensor. Sobreviviste, por ahora....</span>'
        : '<span style="color:#ff4444;">GAME OVER</span><br><span style="font-size:24px;">Has sido atrapado por los infectados.</span>';

    messageEl.innerHTML = `
        <div>
            ${title}
            <br><br>
            <button id="restartBtn" style="padding:12px 26px; font-size:20px; font-weight:bold; border:none; border-radius:8px; background:#ffc107; color:#111; cursor:pointer;">
                Reiniciar misión
            </button>
        </div>
    `;
    messageEl.style.display = 'grid';

    document.getElementById('restartBtn').addEventListener('click', () => {
        window.location.reload();
    });
}

function checkExtraction() {
    if (gameEnded) return;
    const half = EXTRACTION.size / 2;
    const inX = Math.abs(camera.position.x - EXTRACTION.x) <= half;
    const inZ = Math.abs(camera.position.z - EXTRACTION.z) <= half;

    if (inX && inZ) {
        endGame(true);
    }
}

updateHUD();

const controls = new PointerLockControls(camera, document.body);
const menu = document.querySelector('#menu');

menu.addEventListener('click', () => {
    if (!gameEnded) controls.lock();
});
controls.addEventListener('lock', () => { menu.style.display = 'none'; });
controls.addEventListener('unlock', () => {
    if (!gameEnded) menu.style.display = 'grid';
});

const keys = {};
window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (k === '1') selectWeapon(1);
    if (k === '2') selectWeapon(2);
});
window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

function collides(x, z, radius = PLAYER_RADIUS) {
    for (const c of colliders) {
        const closestX = THREE.MathUtils.clamp(x, c.minX, c.maxX);
        const closestZ = THREE.MathUtils.clamp(z, c.minZ, c.maxZ);
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
}

function updatePlayer(delta) {
    if (!controls.isLocked || gameEnded) return;

    const step = WALK_SPEED * delta;
    const oldX = camera.position.x;
    const oldZ = camera.position.z;

    if (keys['w']) controls.moveForward(step);
    if (keys['s']) controls.moveForward(-step);
    if (keys['a']) controls.moveRight(-step);
    if (keys['d']) controls.moveRight(step);

    const newX = camera.position.x;
    const newZ = camera.position.z;

    camera.position.set(newX, PLAYER_HEIGHT, oldZ);
    if (collides(camera.position.x, camera.position.z)) camera.position.x = oldX;

    camera.position.z = newZ;
    if (collides(camera.position.x, camera.position.z)) camera.position.z = oldZ;

    camera.position.y = PLAYER_HEIGHT;

    checkExtraction();
}

function updateWeaponVisuals(delta) {
    recoilOffset = THREE.MathUtils.lerp(recoilOffset, 0, Math.min(1, delta * 15));
    weaponHolder.position.z = WEAPON_BASE_POS.z + recoilOffset;
    weaponHolder.rotation.x = recoilOffset * 0.8;

    if (flashTimer > 0) {
        flashTimer -= delta;
        if (flashTimer <= 0) muzzleLight.intensity = 0;
    }
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    updatePlayer(delta);
    updateWeaponVisuals(delta);
    updateZombies(delta);
    updatePickups(delta);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});