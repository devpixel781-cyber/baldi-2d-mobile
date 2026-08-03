// ==========================================
// 🕹️ إعدادات المحرك والمتغيرات
// ==========================================
let scene, camera, renderer;
let clock = new THREE.Clock();

let walls = [], doors = [], desks = [], books = [];
let bsodaItems = [], activeProjectiles = [];
let exitDoors = [];

let baldiSprite;
let baldiPos = new THREE.Vector3(0, 2.0, -25);
let baldiSpeed = 0.035;
let baldiAngerLevel = 0;
let isBaldiPushed = false;
let pushDirection = new THREE.Vector3();
let pushTimer = 0;

let playerPos = new THREE.Vector3(0, 1.6, 15);
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isSprinting = false;
let stamina = 100;
let collectedBooks = 0;
const TOTAL_BOOKS = 4;
let inventory = { bsoda: 1 };

let isRedAlert = false;
let isGameOver = false;
let gameStarted = false;
let firstExitReached = false;

let yaw = 0, pitch = 0;
const touchSensitivity = 0.005;

// ==========================================
// 🛡️ فحص نوع الجهاز (حظر أجهزة الكمبيوتر)
// ==========================================
function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ==========================================
// 🧹 إدارة الذاكرة
// ==========================================
function disposeObject(obj) {
    if (!obj) return;
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
            });
        } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    }
}

// ==========================================
// 🧱 فحص التصادم والانزلاق على الجدران
// ==========================================
function checkCollision(pos, radius = 0.6) {
    const box = new THREE.Box3().setFromCenterAndSize(
        pos, new THREE.Vector3(radius * 2, 2, radius * 2)
    );

    for (let wall of walls) {
        const wallBox = new THREE.Box3().setFromObject(wall);
        if (box.intersectsBox(wallBox)) return true;
    }
    
    for (let desk of desks) {
        const deskBox = new THREE.Box3().setFromCenterAndSize(
            desk.position, new THREE.Vector3(1.5, 2.0, 1.5)
        );
        if (box.intersectsBox(deskBox)) return true;
    }
    return false;
}

function moveWithCollision(currentPos, moveVec, speed, radius) {
    const nextPos = currentPos.clone();
    
    nextPos.x += moveVec.x * speed;
    if (checkCollision(nextPos, radius)) {
        nextPos.x = currentPos.x;
    }
    
    nextPos.z += moveVec.z * speed;
    if (checkCollision(nextPos, radius)) {
        nextPos.z = currentPos.z;
    }
    
    currentPos.copy(nextPos);
}

// ==========================================
// 🎨 الخامات (Textures)
// ==========================================
function createTileTexture(color1, color2, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color1; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = color2; ctx.lineWidth = 4;
    for (let i = 0; i <= size; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createWallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e0d5c1'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#b8a88a'; ctx.fillRect(0, 180, 256, 76);
    ctx.fillStyle = '#8c7b5c'; ctx.fillRect(0, 175, 256, 5);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// ==========================================
// 🏗️ تهيئة العالم
// ==========================================
async function initGame() {
    // التحقق المباشر مما إذا كان المستخدم على كمبيوتر
    if (!isMobileDevice()) {
        document.getElementById('pc-blocked-screen').classList.remove('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        return;
    }

    if (typeof verifyGameAssets === 'function') await verifyGameAssets();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x11111d);
    scene.fog = new THREE.FogExp2(0x11111d, 0.03);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(playerPos);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 30);
    camera.add(pointLight);
    scene.add(camera);

    const floorMat = new THREE.MeshStandardMaterial({ map: createTileTexture('#1e3d59', '#17252a'), roughness: 0.8 });
    floorMat.map.repeat.set(20, 20);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ceilingMat = new THREE.MeshStandardMaterial({ map: createTileTexture('#2b2b2b', '#111111') });
    ceilingMat.map.repeat.set(20, 20);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), ceilingMat);
    ceiling.position.y = 4; ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    buildSchoolLayout();
    setupGameSprites();
    setupTouchControls();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function buildSchoolLayout() {
    const wallMat = new THREE.MeshStandardMaterial({ map: createWallTexture() });
    wallMat.map.repeat.set(2, 1);

    createWallBlock(0, 2, -30, 20, 4, 1, wallMat);
    createWallBlock(-15, 2, 0, 1, 4, 60, wallMat);
    createWallBlock(15, 2, 0, 1, 4, 60, wallMat);
    createWallBlock(0, 2, -10, 10, 4, 1, wallMat);

    const roomCenters = [
        { x: -8, z: -20 }, { x: 8, z: -20 },
        { x: -8, z: 5 }, { x: 8, z: 5 }
    ];

    roomCenters.forEach((center, index) => {
        buildClassroom(center.x, center.z, index, wallMat);
    });

    createExitDoors();
}

function createWallBlock(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    walls.push(mesh);
}

function buildClassroom(centerX, centerZ, roomIndex, wallMat) {
    createWallBlock(centerX, 2, centerZ - 5, 10, 4, 0.5, wallMat);
    createWallBlock(centerX - 5, 2, centerZ, 0.5, 4, 10, wallMat);
    createWallBlock(centerX + 5, 2, centerZ, 0.5, 4, 10, wallMat);

    const deskPositions = [
        { x: centerX - 2, z: centerZ - 2 }, { x: centerX + 2, z: centerZ - 2 },
        { x: centerX - 2, z: centerZ + 2 }, { x: centerX + 2, z: centerZ + 2 }
    ];

    const luckyDeskIndex = Math.floor(Math.random() * deskPositions.length);

    deskPositions.forEach((pos, idx) => {
        spawnSprite('desk', pos.x, 0.9, pos.z, 1.8, 1.8);
        if (idx === luckyDeskIndex && roomIndex < TOTAL_BOOKS) {
            spawnSprite('book', pos.x, 1.2, pos.z + 0.2, 0.8, 0.8, books);
        }
    });

    spawnSprite('door', centerX, 1.75, centerZ + 5, 2.2, 3.5, doors);
}

// ==========================================
// 🖼️ الأصول والصور
// ==========================================
const textureLoader = new THREE.TextureLoader();
const textures = {
    baldi: textureLoader.load('assets/baldi.png'),
    desk: textureLoader.load('assets/desk.png'),
    book: textureLoader.load('assets/book.png'),
    door: textureLoader.load('assets/door.png')
};

function spawnSprite(type, x, y, z, scaleX, scaleY, arrayToPush = null) {
    const mat = new THREE.SpriteMaterial({ map: textures[type] });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleX, scaleY, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
    if (arrayToPush) arrayToPush.push(sprite);
    else if (type === 'desk') desks.push(sprite);
    return sprite;
}

function setupGameSprites() {
    baldiSprite = spawnSprite('baldi', baldiPos.x, baldiPos.y, baldiPos.z, 2, 4);
    
    for(let i = 0; i < 3; i++) {
        let rx = (Math.random() * 16) - 8;
        let rz = (Math.random() * 40) - 15;
        spawnBSODAItem(rx, rz);
    }
}

function createExitDoors() {
    const exit1 = spawnSprite('door', -6, 2, 28, 2.5, 4);
    exit1.material.color.setHex(0xff3333);
    exitDoors.push({ sprite: exit1, id: 1, closed: false });

    const exit2 = spawnSprite('door', 6, 2, 28, 2.5, 4);
    exit2.material.color.setHex(0x33ff33);
    exitDoors.push({ sprite: exit2, id: 2, closed: false });
}

let sharedBsodaTexture = null;
function getBsodaTexture() {
    if (!sharedBsodaTexture) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0066ff'; ctx.fillRect(16, 10, 32, 44);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Arial'; ctx.fillText('Soda', 18, 36);
        sharedBsodaTexture = new THREE.CanvasTexture(canvas);
    }
    return sharedBsodaTexture;
}

function spawnBSODAItem(x, z) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getBsodaTexture() }));
    sprite.scale.set(0.8, 0.8, 1);
    sprite.position.set(x, 0.8, z);
    scene.add(sprite);
    bsodaItems.push(sprite);
}

// ==========================================
// 🎯 نظام اللعب والتفاعل
// ==========================================
function interactWithWorld() {
    if (!gameStarted || isGameOver) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // 1. التقاط الكتب
    const bookHits = raycaster.intersectObjects(books);
    if (bookHits.length > 0 && bookHits[0].distance < 4.0) {
        const picked = bookHits[0].object;
        books = books.filter(b => b !== picked);
        disposeObject(picked);
        
        collectedBooks++;
        document.getElementById('books-count').innerText = collectedBooks;
        
        baldiAngerLevel++;
        baldiSpeed += 0.02;
        showMessage("حصلت على كتاب! بالدي غاضب!");
        
        if (collectedBooks >= TOTAL_BOOKS) triggerRedAlert();
        return;
    }

    // 2. التقاط الببسي
    const itemHits = raycaster.intersectObjects(bsodaItems);
    if (itemHits.length > 0 && itemHits[0].distance < 3.5) {
        const item = itemHits[0].object;
        bsodaItems = bsodaItems.filter(i => i !== item);
        disposeObject(item);
        inventory.bsoda++;
        updateHUDItem();
        showMessage("حصلت على ببسي! استخدمه لإبعاد بالدي.");
        return;
    }

    // 3. التفاعل مع أبواب الخروج
    exitDoors.forEach(doorObj => {
        if (camera.position.distanceTo(doorObj.sprite.position) < 4) {
            if (isRedAlert) {
                if (!firstExitReached && doorObj.id === 1) {
                    firstExitReached = true;
                    doorObj.closed = true;
                    doorObj.sprite.material.color.setHex(0x333333);
                    showMessage("الباب مغلق! اهرب للباب الأخضر الآخر!");
                } else if (doorObj.id === 1 && doorObj.closed) {
                    showMessage("مغلق تماماً! اذهب للباب الثاني!");
                } else if (firstExitReached && doorObj.id === 2) {
                    triggerWin();
                }
            } else {
                showMessage("يجب جمع 4 كتب أولاً للهروب!");
            }
        }
    });
}

function shootBSODA() {
    if (!gameStarted || isGameOver) return;

    if (inventory.bsoda <= 0) {
        showMessage("لا تملك ببسي!");
        return;
    }
    
    inventory.bsoda--;
    updateHUDItem();

    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ffff'; ctx.fillRect(0,0,16,16);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) });
    const projectile = new THREE.Sprite(mat);
    
    projectile.position.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    
    activeProjectiles.push({ mesh: projectile, direction: dir, life: 100 });
    scene.add(projectile);
}

function triggerRedAlert() {
    isRedAlert = true;
    baldiSpeed = 0.11;
    scene.background = new THREE.Color(0x550000);
    scene.fog.color = new THREE.Color(0x550000);
    showMessage("🚨 جمعت كل الكتب! اهرب للباب الأحمر!");
}

function updateHUDItem() {
    document.getElementById('item-icon').innerText = inventory.bsoda > 0 ? `ببسي 🥤 (x${inventory.bsoda})` : "فارغ";
}

function showMessage(txt) {
    const m = document.getElementById('game-message');
    if (!m) return;
    m.innerText = txt;
    m.classList.remove('hidden');
    setTimeout(() => m.classList.add('hidden'), 2500);
}

function startGame() {
    const sc = document.getElementById('start-screen');
    if (sc) sc.classList.add('hidden');
    
    // إجبار الشاشة الأفقية عبر غوغل كروم أو WebView للـ APK
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }

    gameStarted = true;
}

// ==========================================
// 📱 التحكم باللمس المخصص للهواتف
// ==========================================
function setupTouchControls() {
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const container = document.getElementById('game-container');
    
    const btnUse = document.getElementById('btn-use-item');
    const btnInteract = document.getElementById('btn-interact');
    const btnSprint = document.getElementById('btn-sprint');

    let jStartX = 0, jStartY = 0;
    let joystickTouchId = null;
    let lookTouchId = null;
    let prevTouchX = 0, prevTouchY = 0;

    // 1. أزرار اللمس على اليمين
    btnUse.addEventListener('touchstart', (e) => { e.preventDefault(); shootBSODA(); });
    btnInteract.addEventListener('touchstart', (e) => { e.preventDefault(); interactWithWorld(); });
    
    btnSprint.addEventListener('touchstart', (e) => { e.preventDefault(); isSprinting = true; });
    btnSprint.addEventListener('touchend', (e) => { e.preventDefault(); isSprinting = false; });

    // 2. إدارة اللمس للشاشة والجوستيك
    container.addEventListener('touchstart', e => {
        if (!gameStarted || isGameOver) return;

        for (let t of e.changedTouches) {
            // النصف الأيمن من الشاشة للكاميرا
            if (t.clientX > window.innerWidth / 2 && lookTouchId === null) {
                lookTouchId = t.identifier;
                prevTouchX = t.clientX;
                prevTouchY = t.clientY;
            }
        }
    });

    container.addEventListener('touchmove', e => {
        if (!gameStarted || isGameOver) return;

        for (let t of e.changedTouches) {
            if (t.identifier === lookTouchId) {
                const deltaX = t.clientX - prevTouchX;
                const deltaY = t.clientY - prevTouchY;
                yaw -= deltaX * touchSensitivity;
                pitch -= deltaY * touchSensitivity;
                pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
                prevTouchX = t.clientX;
                prevTouchY = t.clientY;
            }
        }
    });

    container.addEventListener('touchend', e => {
        for (let t of e.changedTouches) {
            if (t.identifier === lookTouchId) lookTouchId = null;
        }
    });

    // 3. عصا التحكم (Joystick)
    base.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        jStartX = touch.clientX;
        jStartY = touch.clientY;
    });

    base.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let t of e.changedTouches) {
            if (t.identifier === joystickTouchId) {
                const dx = t.clientX - jStartX;
                const dy = t.clientY - jStartY;

                moveForward = dy < -15;
                moveBackward = dy > 15;
                moveLeft = dx < -15;
                moveRight = dx > 15;

                // تحريك شكل العصا داخل دائرتها
                const clampedX = Math.max(-25, Math.min(25, dx));
                const clampedY = Math.max(-25, Math.min(25, dy));
                if (stick) {
                    stick.style.left = (32.5 + clampedX) + 'px';
                    stick.style.top = (32.5 + clampedY) + 'px';
                }
            }
        }
    });

    base.addEventListener('touchend', e => {
        e.preventDefault();
        for (let t of e.changedTouches) {
            if (t.identifier === joystickTouchId) {
                joystickTouchId = null;
                moveForward = moveBackward = moveLeft = moveRight = false;
                if (stick) {
                    stick.style.left = '32.5px';
                    stick.style.top = '32.5px';
                }
            }
        }
    });
}

// ==========================================
// 🔄 حلقة التحديث الرئيسية
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    if (!gameStarted || isGameOver) return;

    // 1. الكاميرا
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = pitch; euler.y = yaw;
    camera.quaternion.setFromEuler(euler);

    // 2. حركة اللاعب واللياقة
    let speed = isSprinting && stamina > 0 ? 0.16 : 0.09;
    if (isSprinting && stamina > 0) stamina = Math.max(0, stamina - 0.4);
    else stamina = Math.min(100, stamina + 0.2);
    
    const staminaFill = document.getElementById('stamina-fill');
    if (staminaFill) staminaFill.style.width = stamina + '%';

    const moveVec = new THREE.Vector3();
    if (moveForward) moveVec.z -= 1;
    if (moveBackward) moveVec.z += 1;
    if (moveLeft) moveVec.x -= 1;
    if (moveRight) moveVec.x += 1;
    moveVec.normalize();
    moveVec.applyQuaternion(camera.quaternion);
    moveVec.y = 0;

    moveWithCollision(playerPos, moveVec, speed, 0.5);
    
    playerPos.x = Math.max(-14, Math.min(14, playerPos.x));
    playerPos.z = Math.max(-28, Math.min(28, playerPos.z));
    camera.position.copy(playerPos);

    // 3. ذكاء بالدي
    if (isBaldiPushed) {
        moveWithCollision(baldiPos, pushDirection, 0.25, 0.6);
        pushTimer--;
        if (pushTimer <= 0) isBaldiPushed = false;
    } else {
        const dirToPlayer = new THREE.Vector3().subVectors(playerPos, baldiPos).normalize();
        dirToPlayer.y = 0;
        moveWithCollision(baldiPos, dirToPlayer, baldiSpeed, 0.6);
    }
    
    baldiPos.y = 2.0;
    baldiSprite.position.copy(baldiPos);

    if (baldiPos.distanceTo(playerPos) < 1.6) triggerGameOver();

    // 4. مقذوفات الببسي
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.mesh.position.addScaledVector(p.direction, 0.5);
        p.life--;

        if (checkCollision(p.mesh.position, 0.2)) {
            disposeObject(p.mesh);
            activeProjectiles.splice(i, 1);
            continue;
        }

        if (p.mesh.position.distanceTo(baldiPos) < 2) {
            isBaldiPushed = true;
            pushDirection.copy(p.direction);
            pushTimer = 30;
            disposeObject(p.mesh);
            activeProjectiles.splice(i, 1);
            showMessage("أصبت بالدي!");
        } else if (p.life <= 0) {
            disposeObject(p.mesh);
            activeProjectiles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

function triggerGameOver() {
    isGameOver = true;
    const ov = document.getElementById('overlay');
    document.getElementById('overlay-title').innerText = "😱 الإمساك بك!";
    document.getElementById('overlay-message').innerText = "لقد أمسك بك بالدي!";
    if (ov) ov.classList.remove('hidden');
}

function triggerWin() {
    isGameOver = true;
    const ov = document.getElementById('overlay');
    document.getElementById('overlay-title').innerText = "🏆 الفوز العظيم!";
    document.getElementById('overlay-message').innerText = "نجحت في الهرب من بالدي عبر الباب الأخضر!";
    if (ov) ov.classList.remove('hidden');
}

window.onload = () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);
    
    initGame();
    animate();
};