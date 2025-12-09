// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Dynamic favicon
function updateFavicon(color) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
        <circle cx='50' cy='50' r='45' fill='${color}'/>
    </svg>`;
    const encoded = encodeURIComponent(svg);
    const link = document.querySelector("link[rel='icon']");
    if (link) {
        link.href = `data:image/svg+xml,${encoded}`;
    }
}

// Three.js setup for fluid effect
let threeRenderer, threeScene, threeCamera, fluidMaterial;
let fluidCanvas = null;
const MAX_METABALLS = 50;

function initThreeJS() {
    if (threeRenderer) return;

    // Create separate canvas for WebGL
    fluidCanvas = document.createElement('canvas');
    fluidCanvas.id = 'fluidCanvas';
    fluidCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:1;';
    document.body.insertBefore(fluidCanvas, canvas);

    threeRenderer = new THREE.WebGLRenderer({ canvas: fluidCanvas, alpha: true });
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);

    threeScene = new THREE.Scene();
    threeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Metaball shader
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        precision highp float;
        varying vec2 vUv;

        uniform vec2 resolution;
        uniform vec3 ballColor;
        uniform vec3 bgColor;
        uniform float ballRadius;
        uniform int numBalls;
        uniform vec2 balls[${MAX_METABALLS}];
        uniform float ballSizes[${MAX_METABALLS}];
        uniform float opacity;

        void main() {
            vec2 pixel = vUv * resolution;
            float sum = 0.0;

            // Metaball field function - sum of 1/distance^2
            for (int i = 0; i < ${MAX_METABALLS}; i++) {
                if (i >= numBalls) break;
                vec2 diff = pixel - balls[i];
                float r = ballSizes[i];
                float dist = length(diff);
                // Smooth falloff
                sum += (r * r) / (dist * dist + 1.0);
            }

            // Threshold and smooth edge - higher threshold = tighter balls
            float threshold = 1.5;
            float edge = smoothstep(threshold - 0.2, threshold + 0.05, sum);

            // Add subtle glow
            float glow = smoothstep(0.0, threshold, sum) * 0.15;

            vec3 color = ballColor;
            float alpha = (edge + glow) * opacity;

            gl_FragColor = vec4(color, alpha);
        }
    `;

    fluidMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            ballColor: { value: new THREE.Vector3(1, 0, 0) },
            bgColor: { value: new THREE.Vector3(0, 0, 0) },
            ballRadius: { value: 60.0 },
            numBalls: { value: 0 },
            balls: { value: new Array(MAX_METABALLS).fill(new THREE.Vector2(0, 0)) },
            ballSizes: { value: new Array(MAX_METABALLS).fill(0) },
            opacity: { value: 1.0 }
        },
        transparent: true,
        depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, fluidMaterial);
    threeScene.add(mesh);
}

function updateFluidShader() {
    if (!fluidMaterial || settings.trailStyle !== 'fluid') return;

    const rgb = hexToRgb(settings.ballColor);
    fluidMaterial.uniforms.ballColor.value.set(rgb.r / 255, rgb.g / 255, rgb.b / 255);
    fluidMaterial.uniforms.ballRadius.value = settings.ballSize;
    fluidMaterial.uniforms.opacity.value = settings.trailOpacity / 100;

    // Pass all trail positions to shader
    const positions = [];
    const sizes = [];

    for (let i = 0; i < trailHistory.length; i++) {
        const progress = i / trailHistory.length;
        positions.push(new THREE.Vector2(trailHistory[i].x, window.innerHeight - trailHistory[i].y));
        // Smaller radii for tighter metaballs
        sizes.push(settings.ballSize * (0.15 + progress * 0.35));
    }

    // Pad arrays to MAX_METABALLS
    while (positions.length < MAX_METABALLS) {
        positions.push(new THREE.Vector2(-9999, -9999));
        sizes.push(0);
    }

    fluidMaterial.uniforms.balls.value = positions;
    fluidMaterial.uniforms.ballSizes.value = sizes;
    fluidMaterial.uniforms.numBalls.value = trailHistory.length;
}

function renderFluid() {
    if (!threeRenderer || settings.trailStyle !== 'fluid') {
        if (fluidCanvas) fluidCanvas.style.display = 'none';
        return;
    }
    fluidCanvas.style.display = 'block';
    updateFluidShader();
    threeRenderer.render(threeScene, threeCamera);
}

// Settings elements
const settingsPanel = document.getElementById('settings');
const speedInput = document.getElementById('speed');
const ballSizeInput = document.getElementById('ballSize');
const ballStyleSelect = document.getElementById('ballStyle');
const glowEnabledInput = document.getElementById('glowEnabled');
const trailStyleSelect = document.getElementById('trailStyle');
const audioEnabledInput = document.getElementById('audioEnabled');
const frequencyInput = document.getElementById('frequency');

// Detect mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Load saved ball color from localStorage
const savedBallColor = localStorage.getItem('emdr_ballColor') || '#db4343';

// State
let settings = {
    cyclesPerMinute: 40,
    motionType: 'sine',
    ballSize: isMobile ? 30 : 60,
    ballColor: savedBallColor,
    ballStyle: 'sphere',
    glowEnabled: false,
    trailStyle: 'none',
    trailLength: 15,
    trailOpacity: 15,
    bgColor: '#000000',
    audioEnabled: true,
    frequency: 110,
    toneVolume: 30
};

// Trail history for motion trail effect
const trailHistory = [];

let ballPosition = 0; // -1 to 1 (left to right)
let mouseTimeout = null;
let isPlaying = false;

// Speed ramp state - controls how fast time advances (NOT amplitude!)
let speedMultiplier = 0; // 0 = stopped, 1 = full speed
let lastTimestamp = null;
let virtualTime = 0; // Accumulated time at variable speed - this drives the wave
const RAMP_DURATION = 800; // ms for speed ramp
let rampStartTime = null;
let rampDirection = null; // 'up' or 'down'
let rampStartSpeed = 0; // speed when ramp started

// Decelerate-to-zero state (when stopping)
let isDecelerating = false;
let decelStartPosition = 0; // position when decel started (for distance-based slowdown)
let waitingForEdge = false; // if true, we're heading to edge first before decelerating

const playPauseBtn = document.getElementById('playPauseBtn');

// Audio context and nodes
let audioContext = null;
let oscillator = null;
let panner = null;
let gainNode = null;

// Ambient audio with panning
let ambientAudio = null;
let ambientSource = null;
let ambientPanner = null;
let ambientGain = null;

// Resize canvas to fill window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Also resize Three.js renderer if initialized
    if (threeRenderer) {
        threeRenderer.setSize(window.innerWidth, window.innerHeight);
        if (fluidMaterial) {
            fluidMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        }
    }
}

// Initialize audio
function initAudio() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = settings.frequency;

    panner = audioContext.createStereoPanner();
    panner.pan.value = 0;

    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    oscillator.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
}

// Update audio state
let lastAudioLog = 0;
function updateAudio() {
    if (!audioContext) return;

    // Debug: log every 500ms when in background
    if (document.hidden && Date.now() - lastAudioLog > 500) {
        console.log('Audio update in background - virtualTime:', virtualTime.toFixed(0), 'speedMult:', speedMultiplier);
        lastAudioLog = Date.now();
    }

    // Calculate audio position for panning
    const cyclesPerSecond = settings.cyclesPerMinute / 60;
    const period = 1000 / cyclesPerSecond;
    let audioPosition;
    if (settings.motionType === 'sine') {
        const phase = (virtualTime / period) * Math.PI * 2;
        audioPosition = Math.sin(phase);
    } else {
        const cycleProgress = ((virtualTime % period) + period) % period / period;
        if (cycleProgress < 0.25) {
            audioPosition = cycleProgress * 4;
        } else if (cycleProgress < 0.75) {
            audioPosition = 1 - ((cycleProgress - 0.25) * 4);
        } else {
            audioPosition = -1 + ((cycleProgress - 0.75) * 4);
        }
    }

    // Update oscillator (panning tone) if initialized
    if (gainNode) {
        if (settings.audioEnabled && speedMultiplier > 0) {
            const toneVol = (settings.toneVolume / 100) * speedMultiplier;
            gainNode.gain.setTargetAtTime(toneVol, audioContext.currentTime, 0.1);
            panner.pan.setTargetAtTime(audioPosition, audioContext.currentTime, 0.02);
            oscillator.frequency.setTargetAtTime(settings.frequency, audioContext.currentTime, 0.1);
        } else {
            gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
        }
    }

    // Pan ambient audio (works independently of oscillator)
    if (ambientPanner && speedMultiplier > 0) {
        ambientPanner.pan.setTargetAtTime(audioPosition, audioContext.currentTime, 0.02);
    }
}

// Audio loop runs independently of animation frame
let audioInterval = null;
let lastAudioTime = null;

function startAudioLoop() {
    if (audioInterval) return;
    lastAudioTime = performance.now();
    audioInterval = setInterval(() => {
        const now = performance.now();
        const dt = Math.min(now - lastAudioTime, 100);
        lastAudioTime = now;

        // If tab is hidden, advance virtualTime here since RAF is throttled
        if (document.hidden && isPlaying && speedMultiplier > 0) {
            virtualTime += dt * speedMultiplier;
        }

        updateAudio();
    }, 16);
}

function stopAudioLoop() {
    if (audioInterval) {
        clearInterval(audioInterval);
        audioInterval = null;
    }
}

// Easing function for smooth speed transitions
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Get current velocity direction (positive = moving right, negative = moving left)
function getVelocityDirection() {
    const cyclesPerSecond = settings.cyclesPerMinute / 60;
    const period = 1000 / cyclesPerSecond;

    if (settings.motionType === 'sine') {
        const phase = (virtualTime / period) * Math.PI * 2;
        return Math.cos(phase); // derivative of sin is cos
    } else {
        const cycleProgress = ((virtualTime % period) + period) % period / period;
        if (cycleProgress < 0.25 || cycleProgress >= 0.75) {
            return 1; // moving right
        } else {
            return -1; // moving left
        }
    }
}

// Check if heading toward zero
function isHeadingTowardZero() {
    const vel = getVelocityDirection();
    // Heading toward zero if: (position > 0 and moving left) or (position < 0 and moving right)
    return (ballPosition > 0 && vel < 0) || (ballPosition < 0 && vel > 0);
}

// Calculate ball position based on virtual time (speed ramp approach)
function calculateBallPosition(timestamp) {
    if (lastTimestamp === null) {
        lastTimestamp = timestamp;
    }
    // Cap deltaTime to prevent jumps after UI interactions
    const deltaTime = Math.min(timestamp - lastTimestamp, 50);
    lastTimestamp = timestamp;

    const prevPosition = ballPosition;

    // Handle waiting for edge (user pressed stop while heading away from zero)
    if (waitingForEdge) {
        virtualTime += deltaTime * speedMultiplier;

        // Check if we hit the edge (position magnitude >= 0.99)
        const cyclesPerSecond = settings.cyclesPerMinute / 60;
        const period = 1000 / cyclesPerSecond;
        const phase = (virtualTime / period) * Math.PI * 2;
        const newPos = Math.sin(phase);

        if (Math.abs(newPos) >= 0.99) {
            waitingForEdge = false;
            isDecelerating = true;
            decelStartPosition = newPos;
        }
    }
    // Handle deceleration - speed with ease-out curve
    else if (isDecelerating) {
        // Speed based on distance from zero, with ease-out curve
        // sqrt makes it maintain speed longer, then drop quickly at the end
        const distanceFromZero = Math.abs(ballPosition);
        const startDistance = Math.abs(decelStartPosition);

        if (startDistance > 0.01) {
            const ratio = distanceFromZero / startDistance;
            // Use sqrt for ease-out feel (maintains speed, quick stop)
            speedMultiplier = Math.max(0.08, Math.sqrt(ratio));
        } else {
            speedMultiplier = 0;
        }

        virtualTime += deltaTime * speedMultiplier;
    }
    // Handle ramp up
    else if (rampDirection === 'up') {
        const rampElapsed = timestamp - rampStartTime;
        const rampProgress = Math.min(rampElapsed / RAMP_DURATION, 1);
        const easedProgress = easeInOutCubic(rampProgress);
        speedMultiplier = rampStartSpeed + (1 - rampStartSpeed) * easedProgress;

        if (rampProgress >= 1) {
            rampDirection = null;
        }

        virtualTime += deltaTime * speedMultiplier;
    }
    // Normal playback
    else {
        virtualTime += deltaTime * speedMultiplier;
    }

    // Calculate wave position from virtual time
    const cyclesPerSecond = settings.cyclesPerMinute / 60;
    const period = 1000 / cyclesPerSecond;

    if (settings.motionType === 'sine') {
        const phase = (virtualTime / period) * Math.PI * 2;
        ballPosition = Math.sin(phase);
    } else {
        const cycleProgress = ((virtualTime % period) + period) % period / period;
        if (cycleProgress < 0.25) {
            ballPosition = cycleProgress * 4;
        } else if (cycleProgress < 0.75) {
            ballPosition = 1 - ((cycleProgress - 0.25) * 4);
        } else {
            ballPosition = -1 + ((cycleProgress - 0.75) * 4);
        }
    }

    // Check if we crossed zero while decelerating
    if (isDecelerating) {
        if ((prevPosition > 0 && ballPosition <= 0) || (prevPosition < 0 && ballPosition >= 0)) {
            // Clear ALL animation state
            isDecelerating = false;
            waitingForEdge = false;
            rampDirection = null;
            virtualTime = 0;
            speedMultiplier = 0;
            ballPosition = 0;
        }
    }
}

// Helper to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

// Draw the scene
function draw() {
    const width = canvas.width;
    const height = canvas.height;

    // Clear with background color
    ctx.fillStyle = settings.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Calculate ball screen position
    const ballRadius = settings.ballSize;
    const padding = ballRadius + 50;
    const travelWidth = width - (padding * 2);
    const ballX = padding + ((ballPosition + 1) / 2) * travelWidth;
    const ballY = height / 2;

    // Update trail history
    if (settings.trailStyle !== 'none') {
        trailHistory.push({ x: ballX, y: ballY });
        // Keep positions based on trail length setting
        while (trailHistory.length > settings.trailLength) {
            trailHistory.shift();
        }
    } else {
        trailHistory.length = 0;
    }

    // Draw motion trail (Canvas 2D - basic and 3d styles only)
    if (settings.trailStyle !== 'none' && settings.trailStyle !== 'fluid' && trailHistory.length > 1) {
        const rgb = hexToRgb(settings.ballColor);
        const maxAlpha = settings.trailOpacity / 100;

        for (let i = 0; i < trailHistory.length - 1; i++) {
            const progress = i / trailHistory.length;
            const alpha = progress * maxAlpha;

            let trailRadius, trailY;
            if (settings.trailStyle === '3d') {
                // 3D effect: trail goes back into the screen
                const depth = 1 - progress; // 0 = front, 1 = back
                trailRadius = ballRadius * (0.2 + progress * 0.8) * (0.3 + progress * 0.7);
                // Move up towards vanishing point as depth increases
                trailY = trailHistory[i].y - (depth * ballRadius * 1.5);
            } else {
                trailRadius = ballRadius * (0.3 + progress * 0.7);
                trailY = trailHistory[i].y;
            }

            ctx.beginPath();
            ctx.arc(trailHistory[i].x, trailY, trailRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            ctx.fill();
        }
    }

    // Draw glow effect
    if (settings.glowEnabled) {
        const rgb = hexToRgb(settings.ballColor);
        const glowRadius = ballRadius * 3;
        const gradient = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, glowRadius);
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
        gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

        ctx.beginPath();
        ctx.arc(ballX, ballY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    // Draw ball based on style
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);

    switch (settings.ballStyle) {
        case 'flat':
            ctx.fillStyle = settings.ballColor;
            ctx.fill();
            break;

        case 'sphere':
            // Create 3D sphere effect with gradient
            const sphereGradient = ctx.createRadialGradient(
                ballX - ballRadius * 0.3,
                ballY - ballRadius * 0.3,
                0,
                ballX,
                ballY,
                ballRadius
            );
            const rgb = hexToRgb(settings.ballColor);
            sphereGradient.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
            sphereGradient.addColorStop(0.2, settings.ballColor);
            sphereGradient.addColorStop(1, `rgba(${Math.floor(rgb.r * 0.3)}, ${Math.floor(rgb.g * 0.3)}, ${Math.floor(rgb.b * 0.3)}, 1)`);
            ctx.fillStyle = sphereGradient;
            ctx.fill();
            break;
    }
}

// Toggle play/pause
const startOverlay = document.getElementById('startOverlay');
function togglePlayPause() {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? '❚❚' : '▶';

    // Hide start overlay on first play
    if (isPlaying && startOverlay) {
        startOverlay.style.display = 'none';
    }

    if (isPlaying) {
        // Clear any deceleration state
        isDecelerating = false;
        waitingForEdge = false;

        // Initialize audio on first play if enabled
        if (settings.audioEnabled && !audioContext) {
            initAudio();
            startAudioLoop();
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Start speed ramp UP
        rampDirection = 'up';
        rampStartTime = performance.now();
        rampStartSpeed = speedMultiplier;
    } else {
        const headingToZero = isHeadingTowardZero();

        if (headingToZero) {
            // Already heading toward zero - start decelerating based on distance
            isDecelerating = true;
            decelStartPosition = ballPosition;
        } else {
            // Heading toward edge - wait until we hit edge, then decelerate
            waitingForEdge = true;
            rampDirection = null;
            speedMultiplier = 1;
        }
    }
}

// Animation loop
function animate(timestamp) {
    // Always calculate position when playing, ramping, decelerating, or waiting for edge
    if (isPlaying || rampDirection !== null || isDecelerating || waitingForEdge || speedMultiplier > 0) {
        calculateBallPosition(timestamp);
    }
    draw();
    renderFluid();
    requestAnimationFrame(animate);
}

// Settings panel visibility
let pickerOpen = false;
let inputFocused = false;

function showSettings() {
    settingsPanel.classList.remove('hidden');

    if (mouseTimeout) {
        clearTimeout(mouseTimeout);
    }

    if (!pickerOpen && !inputFocused) {
        mouseTimeout = setTimeout(() => {
            settingsPanel.classList.add('hidden');
        }, 2000);
    }
}

// Event listeners for settings
speedInput.addEventListener('input', (e) => {
    settings.cyclesPerMinute = parseFloat(e.target.value) || 40;
});

document.getElementById('motionType').addEventListener('change', (e) => {
    settings.motionType = e.target.value;
});

ballSizeInput.addEventListener('input', (e) => {
    settings.ballSize = parseFloat(e.target.value) || 60;
    document.getElementById('ballSizeValue').textContent = settings.ballSize;
});

// Initialize Pickr color pickers
const ballColorPicker = Pickr.create({
    el: '#ballColorPicker',
    theme: 'nano',
    default: settings.ballColor,
    swatches: [
        '#db4343', '#e74c3c', '#ff6b6b', '#f39c12', '#f1c40f',
        '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#ffffff'
    ],
    components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
            hex: true,
            input: true,
            save: true
        }
    }
});

ballColorPicker.on('show', () => {
    pickerOpen = true;
    if (mouseTimeout) clearTimeout(mouseTimeout);
});

ballColorPicker.on('hide', () => {
    pickerOpen = false;
    showSettings();
});

ballColorPicker.on('change', (color) => {
    const hex = color.toHEXA().toString();
    settings.ballColor = hex;
    document.getElementById('ballColorHex').value = hex;
    ballColorPicker.applyColor();
    localStorage.setItem('emdr_ballColor', hex);
    updateFavicon(hex);
});

ballColorPicker.on('save', () => {
    ballColorPicker.hide();
});

const bgColorPicker = Pickr.create({
    el: '#bgColorPicker',
    theme: 'nano',
    default: settings.bgColor,
    swatches: [
        '#000000', '#1a1a2e', '#16213e', '#0f3460', '#2c3e50',
        '#34495e', '#1e272e', '#2d3436', '#636e72', '#ffffff'
    ],
    components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
            hex: true,
            input: true,
            save: true
        }
    }
});

bgColorPicker.on('show', () => {
    pickerOpen = true;
    if (mouseTimeout) clearTimeout(mouseTimeout);
});

bgColorPicker.on('hide', () => {
    pickerOpen = false;
    showSettings();
});

bgColorPicker.on('change', (color) => {
    const hex = color.toHEXA().toString();
    settings.bgColor = hex;
    document.getElementById('bgColorHex').value = hex;
    bgColorPicker.applyColor();
});

bgColorPicker.on('save', () => {
    bgColorPicker.hide();
});

document.getElementById('ballColorHex').addEventListener('input', (e) => {
    const hex = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        settings.ballColor = hex;
        ballColorPicker.setColor(hex);
        localStorage.setItem('emdr_ballColor', hex);
        updateFavicon(hex);
    }
});

ballStyleSelect.addEventListener('change', (e) => {
    settings.ballStyle = e.target.value;
});

glowEnabledInput.addEventListener('change', (e) => {
    settings.glowEnabled = e.target.checked;
});

trailStyleSelect.addEventListener('change', (e) => {
    settings.trailStyle = e.target.value;
    document.querySelectorAll('.trail-options').forEach(el => {
        el.classList.toggle('hidden', e.target.value === 'none');
    });
    // Initialize Three.js when fluid is selected
    if (e.target.value === 'fluid') {
        initThreeJS();
    }
});

document.getElementById('trailLength').addEventListener('input', (e) => {
    settings.trailLength = parseInt(e.target.value) || 15;
    document.getElementById('trailLengthValue').textContent = settings.trailLength;
});

document.getElementById('trailOpacity').addEventListener('input', (e) => {
    settings.trailOpacity = parseInt(e.target.value) || 15;
    document.getElementById('trailOpacityValue').textContent = settings.trailOpacity;
});

document.getElementById('bgColorHex').addEventListener('input', (e) => {
    const hex = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        settings.bgColor = hex;
        bgColorPicker.setColor(hex);
    }
});

audioEnabledInput.addEventListener('change', (e) => {
    settings.audioEnabled = e.target.checked;
    audioBtn.textContent = settings.audioEnabled ? '🔊' : '🔇';
    if (settings.audioEnabled) {
        initAudio();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        startAudioLoop();
    } else {
        stopAudioLoop();
    }
    updateAudio();
});

frequencyInput.addEventListener('input', (e) => {
    settings.frequency = parseFloat(e.target.value) || 220;
});

document.getElementById('toneVolume').addEventListener('input', (e) => {
    settings.toneVolume = parseInt(e.target.value) || 30;
    document.getElementById('toneVolumeValue').textContent = settings.toneVolume;
});

// Ambient audio controls
const ambientAudioSelect = document.getElementById('ambientAudio');
const ambientVolumeInput = document.getElementById('ambientVolume');
const ambientVolumeControl = document.querySelector('.ambient-volume-control');

ambientAudioSelect.addEventListener('change', (e) => {
    const src = e.target.value;

    // Set frequency to 65Hz for Music From The Sun
    if (src.includes('Music From The Sun')) {
        settings.frequency = 65;
        frequencyInput.value = 65;
    }

    // Stop and disconnect existing audio
    if (ambientAudio) {
        ambientAudio.pause();
        ambientAudio = null;
    }
    if (ambientSource) {
        ambientSource.disconnect();
        ambientSource = null;
    }
    if (ambientPanner) {
        ambientPanner.disconnect();
        ambientPanner = null;
    }
    if (ambientGain) {
        ambientGain.disconnect();
        ambientGain = null;
    }

    if (src) {
        // Initialize audio context if needed
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        // Create new audio element
        ambientAudio = new Audio(src);
        ambientAudio.loop = true;

        // Route through Web Audio API for panning
        ambientSource = audioContext.createMediaElementSource(ambientAudio);
        ambientPanner = audioContext.createStereoPanner();
        ambientGain = audioContext.createGain();
        ambientGain.gain.value = (ambientVolumeInput.value || 50) / 100;

        ambientSource.connect(ambientPanner);
        ambientPanner.connect(ambientGain);
        ambientGain.connect(audioContext.destination);

        ambientAudio.play().catch(err => {
            console.log('Ambient audio autoplay blocked, will play on user interaction');
        });

        // Show volume control
        ambientVolumeControl.classList.remove('hidden');

        // Start audio loop if not already running
        startAudioLoop();
    } else {
        // Hide volume control
        ambientVolumeControl.classList.add('hidden');
    }
});

ambientVolumeInput.addEventListener('input', (e) => {
    const volume = parseInt(e.target.value) || 50;
    document.getElementById('ambientVolumeValue').textContent = volume;
    if (ambientGain) {
        ambientGain.gain.value = volume / 100;
    }
});

// Keep settings visible while any input/select is focused
settingsPanel.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('focus', () => {
        inputFocused = true;
        if (mouseTimeout) clearTimeout(mouseTimeout);
    });
    el.addEventListener('blur', () => {
        inputFocused = false;
        showSettings();
    });
});

// Mouse movement shows settings
document.addEventListener('mousemove', showSettings);

// Click outside settings toggles visibility
document.addEventListener('click', (e) => {
    // Don't hide if clicking inside a Pickr popup or picker is open
    if (pickerOpen || e.target.closest('.pcr-app')) return;

    if (!settingsPanel.contains(e.target) && e.target !== playPauseBtn && e.target !== audioBtn) {
        if (settingsPanel.classList.contains('hidden')) {
            showSettings();
        } else {
            settingsPanel.classList.add('hidden');
            if (mouseTimeout) clearTimeout(mouseTimeout);
        }
    }
});

// Handle window resize and orientation change
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    // Delay to let the browser finish rotating
    setTimeout(resizeCanvas, 100);
});

// Also handle visual viewport changes (for mobile browsers with dynamic toolbars)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
}

// Copy button handlers
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.dataset.target;
        const input = document.getElementById(targetId);
        navigator.clipboard.writeText(input.value).then(() => {
            const originalText = e.target.textContent;
            e.target.textContent = 'Copied!';
            setTimeout(() => {
                e.target.textContent = originalText;
            }, 1000);
        });
    });
});

// Play/pause button click/touch
playPauseBtn.addEventListener('click', togglePlayPause);
playPauseBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    togglePlayPause();
});

// Space bar toggles play/pause
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
    }
});

// Audio button
const audioBtn = document.getElementById('audioBtn');
function toggleAudio() {
    settings.audioEnabled = !settings.audioEnabled;
    audioEnabledInput.checked = settings.audioEnabled;
    audioBtn.textContent = settings.audioEnabled ? '🔊' : '🔇';

    if (settings.audioEnabled) {
        initAudio();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        startAudioLoop();
    } else {
        stopAudioLoop();
    }
    updateAudio();
}
audioBtn.addEventListener('click', toggleAudio);
audioBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    toggleAudio();
});

// Initialize
resizeCanvas();

// Sync ball size UI with settings (for mobile default)
ballSizeInput.value = settings.ballSize;
document.getElementById('ballSizeValue').textContent = settings.ballSize;

// Sync ball color UI with settings (for saved color)
document.getElementById('ballColorHex').value = settings.ballColor;
updateFavicon(settings.ballColor);

// Debug: track visibility changes
document.addEventListener('visibilitychange', () => {
    console.log('Visibility changed:', document.hidden ? 'HIDDEN' : 'VISIBLE');
    console.log('isPlaying:', isPlaying, 'speedMultiplier:', speedMultiplier);
});

requestAnimationFrame(animate);
