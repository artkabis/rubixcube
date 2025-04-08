import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
let scene, camera, renderer, controls;
let cubeGroup;
const cubies = [];
const CUBE_SIZE = 3;
const CUBIE_SIZE = 1;
const CUBIE_SPACING = 0.05;
const TOTAL_CUBIE_SIZE = CUBIE_SIZE + CUBIE_SPACING;
const CUBIE_LAYER_OFFSET = TOTAL_CUBIE_SIZE;
const ANIMATION_DURATION = 0.3; 
const epsilon = 0.01; 
const faces = ['U', 'D', 'F', 'B', 'L', 'R'];
const colorsInitial = { U: 'W', D: 'Y', F: 'G', B: 'B', L: 'O', R: 'R' };
let cubeState = {};
let lastShuffleSequence = []; 
const colorMap = { W: 0xFFFFFF, Y: 0xFFD500, G: 0x009E60, B: 0x0051BA, O: 0xFF5800, R: 0xC41E3A, inner: 0x111111 };
const statusElement = document.getElementById('status');
let isAnimating = false;
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);
    const container = document.getElementById('container');
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(4.5, 4.5, 5.5);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    resetCubeState();
    createVisualCube();
    updateVisualCube();

    document.getElementById('shuffleButton').addEventListener('click', shuffleCube);
    document.getElementById('solveButton').addEventListener('click', solveCubeAnimated);

    window.addEventListener('resize', onWindowResize, false);
    animate();
}
function createVisualCube() {
    cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    const materials = Array(6).fill(null).map(() => new THREE.MeshStandardMaterial({ color: colorMap.inner, side: THREE.FrontSide })); // FrontSide pour opti

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && y === 0 && z === 0) continue;
                const cubieMaterials = materials.map(mat => mat.clone());
                const cubie = new THREE.Mesh(geometry, cubieMaterials);
                cubie.position.set(x * TOTAL_CUBIE_SIZE, y * TOTAL_CUBIE_SIZE, z * TOTAL_CUBIE_SIZE);
                cubie.userData.logicalPosition = { x, y, z };
                cubeGroup.add(cubie);
                cubies.push(cubie);
            }
        }
    }
    scene.add(cubeGroup);
}
function updateVisualCube() {
    const state = cubeState;
    const faceMapping = {
        R: { axis: 'x', val: 1,  indices: [2, 5, 8, 1, 4, 7, 0, 3, 6], materialIndex: 0 },
        L: { axis: 'x', val: -1, indices: [6, 3, 0, 7, 4, 1, 8, 5, 2], materialIndex: 1 },
        U: { axis: 'y', val: 1,  indices: [0, 1, 2, 3, 4, 5, 6, 7, 8], materialIndex: 2 },
        D: { axis: 'y', val: -1, indices: [6, 7, 8, 3, 4, 5, 0, 1, 2], materialIndex: 3 },
        F: { axis: 'z', val: 1,  indices: [0, 1, 2, 3, 4, 5, 6, 7, 8], materialIndex: 4 },
        B: { axis: 'z', val: -1, indices: [2, 1, 0, 5, 4, 3, 8, 7, 6], materialIndex: 5 }
    };
     cubies.forEach(cubie => {
        const currentPos = cubie.position;
        cubie.material.forEach(mat => mat.color.set(colorMap.inner));

        for (const faceName in faceMapping) {
             const map = faceMapping[faceName];
             if (Math.abs(currentPos[map.axis] - (map.val * CUBIE_LAYER_OFFSET)) < epsilon) {
                 const initialPos = cubie.userData.logicalPosition;
                 let facetIndex = -1;
                 if (map.axis === 'x') { facetIndex = map.indices[ (initialPos.z + 1) + (-initialPos.y + 1) * 3 ]; }
                 else if (map.axis === 'y') { facetIndex = map.indices[ (initialPos.x + 1) + (initialPos.z * (map.val === 1 ? 1 : -1) + 1) * 3 ]; } // Ajustement Z pour U/D
                 else { facetIndex = map.indices[ (initialPos.x + 1) + (-initialPos.y + 1) * 3 ]; }


                if (facetIndex !== -1 && state[faceName] && state[faceName][facetIndex]) {
                    const colorChar = state[faceName][facetIndex];
                    cubie.material[map.materialIndex].color.set(colorMap[colorChar]);
                } else {
                    cubie.material[map.materialIndex].color.set(colorMap.inner);
                }
             }
        }
         cubie.material.forEach(m => m.needsUpdate = true);
    });
}
function updateLogicalState(face) {
    const state = cubeState;
    const faceIndices = [0, 1, 2, 5, 8, 7, 6, 3];
    const affectedFaces = { /* ... (comme avant) ... */
        U: { F: [0, 1, 2], R: [0, 1, 2], B: [0, 1, 2], L: [0, 1, 2] },
        D: { F: [6, 7, 8], L: [6, 7, 8], B: [6, 7, 8], R: [6, 7, 8] },
        F: { U: [6, 7, 8], L: [2, 5, 8], D: [0, 1, 2], R: [0, 3, 6] },
        B: { U: [0, 1, 2], R: [2, 5, 8], D: [6, 7, 8], L: [0, 3, 6] },
        L: { U: [0, 3, 6], B: [2, 5, 8], D: [0, 3, 6], F: [0, 3, 6] },
        R: { U: [2, 5, 8], F: [2, 5, 8], D: [2, 5, 8], B: [0, 3, 6] }
    };

    const faceColors = state[face];
    const tempFace = faceColors[faceIndices[faceIndices.length - 2]];
    const tempFace2 = faceColors[faceIndices[faceIndices.length - 1]];
    for (let i = faceIndices.length - 1; i >= 2; i--) { faceColors[faceIndices[i]] = faceColors[faceIndices[i - 2]]; }
    faceColors[faceIndices[0]] = tempFace; faceColors[faceIndices[1]] = tempFace2;
    const sides = affectedFaces[face];
    const sideNames = Object.keys(sides);
    const tempSide = sides[sideNames[3]].map(index => state[sideNames[3]][index]); 
    for (let i = 3; i > 0; i--) {
        for (let j = 0; j < 3; j++) {
            state[sideNames[i]][sides[sideNames[i]][j]] = state[sideNames[i-1]][sides[sideNames[i-1]][j]];
        }
    }
    for (let j = 0; j < 3; j++) { state[sideNames[0]][sides[sideNames[0]][j]] = tempSide[j]; }
}
async function applyMove(move) {
    if (!move) return;
    const face = move.charAt(0);
    const turns = move.length === 1 ? 1 : (move.charAt(1) === "'" ? 3 : 2);
    const direction = (move.charAt(1) === "'") ? -1 : 1;
    const angle = direction * (Math.PI / 2) * (turns === 2 ? 2 : 1); 

    const axisMap = { U: 'y', D: 'y', F: 'z', B: 'z', L: 'x', R: 'x' };
    const axis = axisMap[face];
    const layerVal = (face === 'U' || face === 'R' || face === 'F') ? CUBIE_LAYER_OFFSET : -CUBIE_LAYER_OFFSET;
    const cubiesToRotate = cubies.filter(cubie => Math.abs(cubie.position[axis] - layerVal) < epsilon);

    const pivot = new THREE.Group();
    scene.add(pivot);
    cubiesToRotate.forEach(cubie => {
        cubeGroup.remove(cubie);
        pivot.add(cubie);
    });

    await new Promise(resolve => {
        gsap.to(pivot.rotation, {
            [axis]: pivot.rotation[axis] + angle,
            duration: ANIMATION_DURATION,
            ease: "power1.inOut",
            onComplete: () => {
                pivot.updateMatrixWorld(); 
                cubiesToRotate.forEach(cubie => {
                    const worldPos = new THREE.Vector3();
                    const worldQuat = new THREE.Quaternion();
                    cubie.getWorldPosition(worldPos);
                    cubie.getWorldQuaternion(worldQuat);

                    pivot.remove(cubie); 
                    cubie.position.copy(worldPos);
                    cubie.quaternion.copy(worldQuat);

                    cubeGroup.add(cubie); 
                });

                scene.remove(pivot); 
                const logicalTurns = (move.charAt(1) === "'") ? 3 : (move.charAt(1) === '2' ? 2 : 1);
                for (let i = 0; i < logicalTurns; i++) {
                    updateLogicalState(face); 
                }

                resolve(); 
            }
        });
    });
}
function getInverseMove(move) {
    if (move.length === 1) return move + "'";
    if (move.charAt(1) === "'") return move.charAt(0);
    return move; 
}
function updateStatus(text) {
    statusElement.textContent = text;
}

async function shuffleCube() {
    if (isAnimating) return;
    isAnimating = true;
    updateStatus("Mélange en cours...");
    lastShuffleSequence = []; 

    const moves = faces;
    const modifiers = ['', "'", '2'];
    const numMoves = 20;

    for (let i = 0; i < numMoves; i++) {
        let randomMove;
        let validMove = false;
        while(!validMove) {
            randomMove = moves[Math.floor(Math.random() * moves.length)] +
                       modifiers[Math.floor(Math.random() * modifiers.length)];
            if (i > 0) {
                const prevMove = lastShuffleSequence[i-1];
                if (randomMove.charAt(0) === prevMove.charAt(0)) continue;
            }
            validMove = true;
        }

        lastShuffleSequence.push(randomMove);
        updateStatus(`Mélange... (${i + 1}/${numMoves})`);
        await applyMove(randomMove);
    }

    updateStatus("Mélange terminé.");
    isAnimating = false;
}

async function solveCubeAnimated() {
    if (isAnimating) return;
    if (lastShuffleSequence.length === 0) {
        updateStatus("Mélangez d'abord le cube !");
        return;
    }
    isAnimating = true;
    updateStatus("Résolution en cours...");

    const inverseSequence = lastShuffleSequence.slice().reverse().map(getInverseMove);
    const totalMoves = inverseSequence.length;

    for (let i = 0; i < totalMoves; i++) {
        const move = inverseSequence[i];
        updateStatus(`Résolution... (${i + 1}/${totalMoves})`);
        await applyMove(move);
    }

    lastShuffleSequence = []; 
    updateStatus("Cube résolu !");
    isAnimating = false;
}
function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}
function resetCubeState() {
    cubeState = {};
    for (const face of faces) {
        cubeState[face] = Array(9).fill(colorsInitial[face]);
    }
    lastShuffleSequence = []; 
}
init();