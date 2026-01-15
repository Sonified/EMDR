// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Linear frequency slider (20-220 Hz range, direct mapping)
const FREQ_MIN = 20;
const FREQ_MAX = 220;

function sliderToFreq(sliderVal) {
    return Math.round(sliderVal);
}

function freqToSlider(freq) {
    return Math.max(FREQ_MIN, Math.min(FREQ_MAX, Math.round(freq)));
}

// Get toggle button state text based on button ID
function getToggleStateText(buttonId, isEnabled) {
    if (buttonId === 'audioEnabled') {
        return isEnabled ? 'Active' : 'Disabled';
    }
    if (buttonId === 'reverbEnabled') {
        return isEnabled ? 'Enabled' : 'Disabled';
    }
    return isEnabled ? 'On' : 'Off';
}

// SINGLE SOURCE OF TRUTH: Music track frequency mappings
const MUSIC_FREQUENCY_MAP = {
    'Music From The Sun': 65,
    'Imagine With Me (Day Mix)': 97,
    'Imagine With Me': 57,
    'Birth of the Evening Star': 56.75,
    // 'Endless Now': 51,  // Currently too large for playback settings
    'Synthesized Ocean': 40,
    'Electric Cello Improv': 66,
    'Re_Entry_Music': 66,
    'Eternal You': 66,
    'Cello_and_Childrens_Choir': 74,
    'HARP_Promo_Video_Subtle_Audio_Layers': 74,
    'Life in a Moment': 66,
    'Shepard\'s Rise': 48,
    'Shepards_Rise': 48,
    'Lullaby for the Heart': 71.5,
    'Hero\'s Journey': 65,
    'All Objects Foreground': 87,
    'Mist': 74,
    'passages': 75,
    'Speed of Thought': 68,
    'Dream': 65,
    'Cyberworld': 67,
    'Bless Me Now': 53,
    'Frozen Memories': 40,
    'Through the Storm': 67,
    'Sam Brown Rmx': 50,
    'New Year': 80,
    'Total Praise': 49,
    'Holiday': 78
};

// Helper function to set frequency based on track name
function setFrequencyForTrack(trackSrc, settings, frequencyInput, freqSlider) {
    if (!trackSrc) return;

    // Find matching track in frequency map
    for (const [trackName, frequency] of Object.entries(MUSIC_FREQUENCY_MAP)) {
        if (trackSrc.includes(trackName)) {
            settings.frequency = frequency;
            if (frequencyInput) frequencyInput.value = frequency;
            if (freqSlider) freqSlider.value = freqToSlider(frequency);

            // Special case: Birth of the Evening Star enables audio
            if (trackName === 'Birth of the Evening Star') {
                settings.audioEnabled = true;
                const audioEnabledInput = document.getElementById('audioEnabled');
                const audioBtn = document.getElementById('audioBtn');
                if (audioEnabledInput) {
                    audioEnabledInput.dataset.checked = 'true';
                    audioEnabledInput.querySelector('.toggle-state').textContent = getToggleStateText('audioEnabled', true);
                }
                if (audioBtn) audioBtn.textContent = '🔊';
            }
            return;
        }
    }
}

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
    const len = trailHistory.length;

    for (let i = 0; i < len; i++) {
        const point = trailHistory.get(i);
        const progress = i / len;
        positions.push(new THREE.Vector2(point.x, window.innerHeight - point.y));
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

// Settings elements (refreshed when UI is regenerated)
const settingsPanel = document.getElementById('settings');
let speedInput, ballSizeInput, ballStyleSelect, glowEnabledInput;
let trailStyleSelect, audioEnabledInput, frequencyInput;

// Custom Color Wheel Picker
class ColorWheel {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.size = this.canvas.width;
        this.center = this.size / 2;
        this.radius = this.size / 2 - 5;

        this.hue = options.hue || 0;
        this.saturation = options.saturation || 100;
        this.lightness = options.lightness || 50;
        this.onChange = options.onChange || (() => {});

        this.isDragging = false;
        this.draw();
        this.attachEvents();
    }

    draw() {
        const ctx = this.ctx;
        const center = this.center;
        const radius = this.radius;

        ctx.clearRect(0, 0, this.size, this.size);

        // Draw color wheel
        for (let angle = 0; angle < 360; angle++) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = (angle + 1) * Math.PI / 180;

            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, startAngle, endAngle);
            ctx.closePath();

            // Create gradient from center (white/gray) to edge (full saturation)
            const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
            gradient.addColorStop(0, `hsl(${angle}, 0%, ${this.lightness}%)`);
            gradient.addColorStop(1, `hsl(${angle}, 100%, ${this.lightness}%)`);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw selection indicator
        const selectedAngle = this.hue * Math.PI / 180;
        const selectedRadius = (this.saturation / 100) * radius;
        const x = center + Math.cos(selectedAngle) * selectedRadius;
        const y = center + Math.sin(selectedAngle) * selectedRadius;

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    getColorFromPosition(x, y) {
        const dx = x - this.center;
        const dy = y - this.center;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.radius) return null;

        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;

        const saturation = Math.min(100, (distance / this.radius) * 100);

        return { hue: angle, saturation };
    }

    handleInput(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        const color = this.getColorFromPosition(x, y);
        if (color) {
            this.hue = color.hue;
            this.saturation = color.saturation;
            this.draw();
            this.onChange(this.getHex());
        }
    }

    attachEvents() {
        const startDrag = (e) => {
            e.preventDefault();
            this.isDragging = true;
            this.handleInput(e);
        };

        const moveDrag = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            this.handleInput(e);
        };

        const endDrag = () => {
            this.isDragging = false;
        };

        this.canvas.addEventListener('mousedown', startDrag);
        this.canvas.addEventListener('touchstart', startDrag, { passive: false });

        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('touchmove', moveDrag, { passive: false });

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    setLightness(l) {
        this.lightness = l;
        this.draw();
        this.onChange(this.getHex());
    }

    setColor(hex) {
        const hsl = this.hexToHsl(hex);
        if (hsl) {
            this.hue = hsl.h;
            this.saturation = hsl.s;
            this.lightness = hsl.l;
            this.draw();
        }
    }

    getHex() {
        return this.hslToHex(this.hue, this.saturation, this.lightness);
    }

    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    hexToHsl(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return null;

        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
            h *= 360;
        }

        return { h, s: s * 100, l: l * 100 };
    }
}

// Color picker instances
let ballColorWheel = null;
let bgColorWheel = null;
let activeColorPopup = null; // Track which popup is open

// Detect mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Default settings (can be overridden by localStorage)
const defaultSettings = {
    cyclesPerMinute: 40,
    motionType: 'sine',
    ballSize: isMobile ? 15 : 25,
    ballColor: '#5661fa',
    ballStyle: 'sphere',
    glowEnabled: false,
    trailStyle: 'ripple',
    trailAdvanced: false,
    trailLength: 15,
    trailOpacity: 10,
    bgColor: '#03040c',
    audioEnabled: true,
    masterMuted: false,
    frequency: 110,
    toneVolume: 30,
    tonePanAmount: 100,
    musicPanAmount: 80,
    musicVolume: 50,
    waveSpeed: 0.49,
    waveDamping: 0.996,
    waveForce: 0.30,
    waveSourceSize: 6.5,
    waveGridSize: 1024,
    simSteps: 4,
    edgeReflect: 0.1,
    edgeBoundary: 1,
    reverbEnabled: false,
    reverbType: 'room',
    reverbMix: 15,
    reverbDecay: 2.0
};

// Load settings from localStorage, falling back to defaults
function loadSettings() {
    const saved = localStorage.getItem('emdr_settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return { ...defaultSettings, ...parsed };
        } catch (e) {
            console.warn('Failed to parse saved settings, using defaults');
        }
    }
    return { ...defaultSettings };
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('emdr_settings', JSON.stringify(settingsData));
}

// Clear saved settings (reset to defaults)
function resetSettings() {
    // Clear localStorage (both settings and music selection)
    localStorage.removeItem('emdr_settings');
    localStorage.removeItem('emdr_selectedMusic');

    // Stop any playing music
    stopMusicPlayback();

    // Reset settingsData object to defaults
    Object.assign(settingsData, defaultSettings);

    // Re-sync all UI elements with default settings
    // attachSettingsEventListeners syncs all UI values from the settings object
    if (window.attachSettingsEventListeners) {
        window.attachSettingsEventListeners();
    }

    // Reload the default music track and set its frequency
    const DEFAULT_TRACK = 'audio_files/1_Acoustic/Shepards_Rise_Interlochen.mp3';
    if (typeof loadMusicTrack === 'function') {
        loadMusicTrack(DEFAULT_TRACK);
    }

    // Update music picker UI to show default track
    const musicPickerLabel = document.querySelector('.music-picker-label');
    if (musicPickerLabel) {
        musicPickerLabel.textContent = "Music: Shepard's Rise (Interlochen)";
    }

    // Update selected track in dropdown
    const tracks = document.querySelectorAll('.music-picker-dropdown .track');
    tracks.forEach(track => {
        track.classList.remove('selected');
        if (track.dataset.value === DEFAULT_TRACK) {
            track.classList.add('selected');
        }
    });
}

// State (loaded from localStorage or defaults)
const settingsData = loadSettings();

// Proxy to auto-save on any change
const settings = new Proxy(settingsData, {
    set(target, prop, value) {
        target[prop] = value;
        saveSettings();
        return true;
    }
});

// Circular buffer for trail history - O(1) operations vs O(n) array.shift()
class CircularBuffer {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.buffer = new Array(maxSize);
        this.head = 0;
        this.size = 0;
    }

    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.maxSize;
        if (this.size < this.maxSize) this.size++;
    }

    get length() { return this.size; }

    get(index) {
        if (index >= this.size) return undefined;
        // Read from oldest to newest
        const readIndex = (this.head - this.size + index + this.maxSize) % this.maxSize;
        return this.buffer[readIndex];
    }

    clear() { this.size = 0; this.head = 0; }

    resize(newMaxSize) {
        if (newMaxSize === this.maxSize) return;
        const newBuffer = new Array(newMaxSize);
        const copyCount = Math.min(this.size, newMaxSize);
        for (let i = 0; i < copyCount; i++) {
            newBuffer[i] = this.get(this.size - copyCount + i);
        }
        this.buffer = newBuffer;
        this.maxSize = newMaxSize;
        this.size = copyCount;
        this.head = copyCount % newMaxSize;
    }

    // Iterator for for...of loops
    *[Symbol.iterator]() {
        for (let i = 0; i < this.size; i++) yield this.get(i);
    }
}

// Trail history for motion trail effect
const trailHistory = new CircularBuffer(50); // Max trail length from settings

// Wave equation simulation (WebGL)
let waveRenderer, waveScene, waveCamera, waveDisplayScene;
let waveRenderTargets = [null, null];
let currentWaveTarget = 0;
let waveSimMaterial, waveDisplayMaterial;
let waveQuad, waveDisplayQuad;
let waveCanvas = null;
let waveInitialized = false;

function initWaveEquation() {
    if (waveInitialized) return;

    // Create separate canvas for wave WebGL
    waveCanvas = document.createElement('canvas');
    waveCanvas.id = 'waveCanvas';
    waveCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:0;';
    document.body.insertBefore(waveCanvas, canvas);

    waveRenderer = new THREE.WebGLRenderer({ canvas: waveCanvas, alpha: true });
    waveRenderer.setSize(window.innerWidth, window.innerHeight);
    waveRenderer.setPixelRatio(1); // Use 1 for simulation, display scales up

    // Create render targets for ping-pong (RGBA Float)
    // R = current height, G = previous height
    const rtOptions = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType
    };
    const gridSize = settings.waveGridSize;
    waveRenderTargets[0] = new THREE.WebGLRenderTarget(gridSize, gridSize, rtOptions);
    waveRenderTargets[1] = new THREE.WebGLRenderTarget(gridSize, gridSize, rtOptions);

    // Scene for simulation (renders to texture)
    waveScene = new THREE.Scene();
    waveCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Wave simulation shader (ping-pong)
    const waveSimVertex = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    // Wave equation shader:
    // Laplacian = left + right + up + down - 4*center
    // Verlet: next = current + (current - previous) + c² * laplacian
    // With damping and forcing
    const waveSimFragment = `
        precision highp float;
        varying vec2 vUv;

        uniform sampler2D uPrevState;  // R = current, G = previous
        uniform vec2 uResolution;      // Grid resolution
        uniform float uWaveSpeed;      // c² term (keep < 0.5 for CFL stability)
        uniform float uDamping;        // Damping factor (0.99 = slow decay)
        uniform vec2 uBallPos;         // Ball position in UV space (0-1)
        uniform float uBallRadius;     // Ball radius in UV space
        uniform float uForceStrength;  // Forcing amplitude
        uniform float uEdgeReflect;    // 0 = absorb, 1 = full reflection
        uniform float uEdgeBoundary;   // Edge boundary width (0-0.15)

        // User interaction wave source (click/drag)
        uniform vec2 uUserWavePos;     // User click/drag position
        uniform float uUserWaveStrength; // User wave strength
        uniform float uUserWaveRadius;   // User wave radius

        void main() {
            vec2 texel = 1.0 / uResolution;

            // Sample current and neighboring cells
            vec4 state = texture2D(uPrevState, vUv);
            float current = state.r;
            float previous = state.g;

            // Get neighbors for Laplacian (with reflection at boundaries)
            vec2 leftUv = vUv + vec2(-texel.x, 0.0);
            vec2 rightUv = vUv + vec2(texel.x, 0.0);
            vec2 upUv = vUv + vec2(0.0, texel.y);
            vec2 downUv = vUv + vec2(0.0, -texel.y);

            // Reflect coordinates at boundaries for reflection mode
            leftUv.x = leftUv.x < 0.0 ? -leftUv.x : leftUv.x;
            rightUv.x = rightUv.x > 1.0 ? 2.0 - rightUv.x : rightUv.x;
            upUv.y = upUv.y > 1.0 ? 2.0 - upUv.y : upUv.y;
            downUv.y = downUv.y < 0.0 ? -downUv.y : downUv.y;

            float left = texture2D(uPrevState, leftUv).r;
            float right = texture2D(uPrevState, rightUv).r;
            float up = texture2D(uPrevState, upUv).r;
            float down = texture2D(uPrevState, downUv).r;

            // Discrete Laplacian
            float laplacian = left + right + up + down - 4.0 * current;

            // Verlet integration: next = 2*current - previous + c²*laplacian
            // Which is: next = current + (current - previous) + c²*laplacian
            float velocity = current - previous;
            float acceleration = uWaveSpeed * laplacian;
            float next = current + velocity * uDamping + acceleration;

            // Apply forcing from ball position (creates waves)
            float dist = length(vUv - uBallPos);
            if (dist < uBallRadius) {
                float falloff = 1.0 - (dist / uBallRadius);
                falloff = falloff * falloff; // Quadratic falloff
                next += uForceStrength * falloff;
            }

            // Apply forcing from user click/drag position
            if (uUserWaveStrength > 0.0) {
                float userDist = length(vUv - uUserWavePos);
                if (userDist < uUserWaveRadius) {
                    float userFalloff = 1.0 - (userDist / uUserWaveRadius);
                    userFalloff = userFalloff * userFalloff; // Quadratic falloff
                    next += uUserWaveStrength * userFalloff;
                }
            }

            // Boundary conditions: blend between absorb and reflect
            float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
            float edgeDamp = smoothstep(0.0, uEdgeBoundary, edgeDist);
            // Mix between damped (absorbed) and undamped (reflected)
            next = mix(next * edgeDamp, next, uEdgeReflect);

            // Store: R = new current (next), G = old current (now previous)
            gl_FragColor = vec4(next, current, 0.0, 1.0);
        }
    `;

    waveSimMaterial = new THREE.ShaderMaterial({
        vertexShader: waveSimVertex,
        fragmentShader: waveSimFragment,
        uniforms: {
            uPrevState: { value: null },
            uResolution: { value: new THREE.Vector2(gridSize, gridSize) },
            uWaveSpeed: { value: 0.3 },  // c², keep < 0.5 for stability
            uDamping: { value: 0.995 },  // Slight damping
            uBallPos: { value: new THREE.Vector2(0.5, 0.5) },
            uBallRadius: { value: 0.05 },
            uForceStrength: { value: 0.0 },
            uEdgeReflect: { value: 0.0 },
            uEdgeBoundary: { value: 0.03 },
            uUserWavePos: { value: new THREE.Vector2(-9999, -9999) },
            uUserWaveStrength: { value: 0.0 },
            uUserWaveRadius: { value: 0.05 }
        }
    });

    const simGeometry = new THREE.PlaneGeometry(2, 2);
    waveQuad = new THREE.Mesh(simGeometry, waveSimMaterial);
    waveScene.add(waveQuad);

    // Display scene (renders wave heights to screen)
    waveDisplayScene = new THREE.Scene();

    const waveDisplayVertex = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    const waveDisplayFragment = `
        precision highp float;
        varying vec2 vUv;

        uniform sampler2D uWaveState;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform vec2 uResolution;

        void main() {
            vec2 texel = 1.0 / uResolution;

            // Sample neighbors to compute gradient
            float left = texture2D(uWaveState, vUv + vec2(-texel.x, 0.0)).r;
            float right = texture2D(uWaveState, vUv + vec2(texel.x, 0.0)).r;
            float up = texture2D(uWaveState, vUv + vec2(0.0, texel.y)).r;
            float down = texture2D(uWaveState, vUv + vec2(0.0, -texel.y)).r;

            // Gradient shows wave fronts (where waves are moving)
            vec2 gradient = vec2(right - left, up - down);
            float steepness = length(gradient) * 15.0;  // Amplify for visibility

            // Add subtle highlights for steep gradients
            float highlight = smoothstep(0.3, 0.8, steepness);
            vec3 color = mix(uColor, vec3(1.0), highlight * 0.3);

            float alpha = min(steepness * uOpacity, 1.0);

            gl_FragColor = vec4(color, alpha);
        }
    `;

    waveDisplayMaterial = new THREE.ShaderMaterial({
        vertexShader: waveDisplayVertex,
        fragmentShader: waveDisplayFragment,
        uniforms: {
            uWaveState: { value: null },
            uColor: { value: new THREE.Vector3(1, 0, 0) },
            uOpacity: { value: 0.5 },
            uResolution: { value: new THREE.Vector2(gridSize, gridSize) }
        },
        transparent: true,
        depthTest: false
    });

    const displayGeometry = new THREE.PlaneGeometry(2, 2);
    waveDisplayQuad = new THREE.Mesh(displayGeometry, waveDisplayMaterial);
    waveDisplayScene.add(waveDisplayQuad);

    waveInitialized = true;
}

// Resize wave grid (called when waveGridSize setting changes)
function resizeWaveGrid() {
    if (!waveInitialized) return;

    const gridSize = settings.waveGridSize;

    // Dispose old render targets
    if (waveRenderTargets[0]) waveRenderTargets[0].dispose();
    if (waveRenderTargets[1]) waveRenderTargets[1].dispose();

    // Create new render targets with new size
    const rtOptions = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType
    };
    waveRenderTargets[0] = new THREE.WebGLRenderTarget(gridSize, gridSize, rtOptions);
    waveRenderTargets[1] = new THREE.WebGLRenderTarget(gridSize, gridSize, rtOptions);
    currentWaveTarget = 0;

    // Update resolution uniforms
    waveSimMaterial.uniforms.uResolution.value.set(gridSize, gridSize);
    waveDisplayMaterial.uniforms.uResolution.value.set(gridSize, gridSize);
}

// Track previous ball position for velocity calculation
let prevBallX = null;
let prevBallY = null;

// Track user drag for creating waves
let isUserDragging = false;
let justFinishedDragging = false;
let userDragX = 0;
let userDragY = 0;

function updateWaveSimulation(ballX, ballY) {
    if (!waveInitialized || !waveSimMaterial) return;

    // Calculate ball velocity - only create waves when ball is actually moving
    let forceStrength = 0;
    let dx = 0;
    if (prevBallX !== null && prevBallY !== null) {
        dx = ballX - prevBallX;
        const dy = ballY - prevBallY;
        const velocity = Math.sqrt(dx * dx + dy * dy);

        // Scale force by velocity - faster movement = stronger waves
        // Normalize by screen width to get consistent behavior
        const normalizedVelocity = velocity / window.innerWidth;
        forceStrength = normalizedVelocity * settings.waveForce * 50;
    }
    prevBallX = ballX;
    prevBallY = ballY;

    // Offset source toward leading edge of ball based on movement direction
    // const offset = settings.ballSize * 0.5; // Half radius for subtler effect
    let sourceX = ballX;
    // if (dx > 0.1) {
    //     sourceX = ballX + offset; // Moving right, source offset right
    // } else if (dx < -0.1) {
    //     sourceX = ballX - offset; // Moving left, source offset left
    // }

    // Convert source position to UV space (0-1)
    const uvX = sourceX / window.innerWidth;
    const uvY = 1.0 - (ballY / window.innerHeight); // Flip Y for WebGL

    waveSimMaterial.uniforms.uBallPos.value.set(uvX, uvY);
    // Wave source size is independent of ball size - use waveSourceSize as percentage of screen
    waveSimMaterial.uniforms.uBallRadius.value = (settings.waveSourceSize / 100) * 0.1;

    waveSimMaterial.uniforms.uForceStrength.value = forceStrength;

    // Update colors
    const rgb = hexToRgb(settings.ballColor);
    waveDisplayMaterial.uniforms.uColor.value.set(rgb.r / 255, rgb.g / 255, rgb.b / 255);
    waveDisplayMaterial.uniforms.uOpacity.value = settings.trailOpacity / 100;

    // Update user drag wave source
    if (isUserDragging) {
        const uvX = userDragX / window.innerWidth;
        const uvY = 1.0 - (userDragY / window.innerHeight); // Flip Y for WebGL
        waveSimMaterial.uniforms.uUserWavePos.value.set(uvX, uvY);
        waveSimMaterial.uniforms.uUserWaveStrength.value = settings.waveForce * 0.5; // Use same force setting as ball
        waveSimMaterial.uniforms.uUserWaveRadius.value = (settings.waveSourceSize / 100) * 0.1;
    } else {
        // No user interaction - disable user wave source
        waveSimMaterial.uniforms.uUserWaveStrength.value = 0.0;
    }

    // Run simulation steps (multiple steps per frame for higher precision)
    for (let step = 0; step < settings.simSteps; step++) {
        const readTarget = waveRenderTargets[currentWaveTarget];
        const writeTarget = waveRenderTargets[1 - currentWaveTarget];

        waveSimMaterial.uniforms.uPrevState.value = readTarget.texture;

        waveRenderer.setRenderTarget(writeTarget);
        waveRenderer.render(waveScene, waveCamera);

        // Swap buffers
        currentWaveTarget = 1 - currentWaveTarget;
    }
}

function renderWaveEquation() {
    if (!waveInitialized || settings.trailStyle !== 'ripple') {
        if (waveCanvas) waveCanvas.style.display = 'none';
        return;
    }

    waveCanvas.style.display = 'block';

    // Render final wave state to screen
    waveDisplayMaterial.uniforms.uWaveState.value = waveRenderTargets[currentWaveTarget].texture;

    waveRenderer.setRenderTarget(null);
    waveRenderer.render(waveDisplayScene, waveCamera);
}

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
const audioBtn = document.getElementById('audioBtn');

// Audio context and nodes
let audioContext = null;
let oscillator = null;
let panner = null;
let gainNode = null;

// Music audio with panning (using AudioBufferSourceNode for true sample-rate speed control)
let musicBuffer = null;      // Decoded AudioBuffer
let musicSource = null;      // AudioBufferSourceNode (recreated each play)
let musicPanner = null;
let musicGain = null;
let musicStartTime = 0;      // audioContext.currentTime when started
let musicPausedAt = 0;       // Offset into buffer when paused
let musicIsPlaying = false;

// Reverb nodes
let reverbConvolver = null;
let reverbDryGain = null;
let reverbWetGain = null;
let masterGain = null;

// Web Worker for reverb impulse generation (non-blocking)
let reverbWorker = null;
let reverbRequestId = 0;

function initReverbWorker() {
    if (reverbWorker) return;

    try {
        reverbWorker = new Worker('reverb-worker.js');
        reverbWorker.onmessage = function(e) {
            const { channels, length, sampleRate } = e.data;

            if (!audioContext || !reverbConvolver) return;

            // Create AudioBuffer from worker's raw data
            const impulse = audioContext.createBuffer(2, length, sampleRate);
            impulse.copyToChannel(channels[0], 0);
            impulse.copyToChannel(channels[1], 1);

            reverbConvolver.buffer = impulse;
        };

        reverbWorker.onerror = function(err) {
            console.warn('Reverb worker error, falling back to main thread:', err);
            reverbWorker = null;
        };
    } catch (err) {
        console.warn('Web Worker not supported, using main thread for reverb');
        reverbWorker = null;
    }
}

// Fallback: Generate impulse on main thread (blocks UI)
function createReverbImpulseFallback(audioCtx, type, decay) {
    const sampleRate = audioCtx.sampleRate;
    const presets = {
        room: { duration: decay * 0.7, earlyDelay: 0.01, diffusion: 0.7, damping: 0.3 },
        hall: { duration: decay * 1.2, earlyDelay: 0.03, diffusion: 0.85, damping: 0.15 },
        plate: { duration: decay * 0.9, earlyDelay: 0.005, diffusion: 0.95, damping: 0.1 },
        cathedral: { duration: decay * 1.5, earlyDelay: 0.05, diffusion: 0.9, damping: 0.08 }
    };

    const preset = presets[type] || presets.room;
    const duration = Math.min(preset.duration, 6);
    const length = Math.floor(sampleRate * duration);
    const impulse = audioCtx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        const stereoOffset = channel === 0 ? 1 : 0.97;

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const progress = i / length;
            const envelope = Math.exp(-t / (decay * 0.5));
            const dampingFactor = 1 - (progress * preset.damping);
            let sample = Math.random() * 2 - 1;

            if (t < preset.earlyDelay * 3) {
                sample += (Math.random() * 2 - 1) * Math.exp(-t / preset.earlyDelay) * 0.5;
            }
            if (preset.diffusion > 0.5 && i > 0) {
                sample = sample * (1 - preset.diffusion * 0.3) + channelData[i - 1] * preset.diffusion * 0.3;
            }

            channelData[i] = sample * envelope * dampingFactor * stereoOffset;
        }
    }
    return impulse;
}

// Update reverb impulse response (async via Worker, fallback to sync)
function updateReverbImpulse() {
    if (!audioContext || !reverbConvolver) return;

    if (reverbWorker) {
        // Non-blocking: send to worker
        reverbWorker.postMessage({
            id: ++reverbRequestId,
            sampleRate: audioContext.sampleRate,
            type: settings.reverbType,
            decay: settings.reverbDecay
        });
    } else {
        // Blocking fallback
        reverbConvolver.buffer = createReverbImpulseFallback(audioContext, settings.reverbType, settings.reverbDecay);
    }
}

// Update reverb mix (wet/dry)
function updateReverbMix() {
    if (!reverbDryGain || !reverbWetGain || !audioContext) return;

    const mixRatio = settings.reverbMix / 100;
    // Equal power crossfade for smoother mixing
    const dry = Math.cos(mixRatio * Math.PI / 2);
    const wet = Math.sin(mixRatio * Math.PI / 2) * 1.5; // Boost wet signal

    reverbDryGain.gain.setTargetAtTime(dry, audioContext.currentTime, 0.05);
    reverbWetGain.gain.setTargetAtTime(wet, audioContext.currentTime, 0.05);
}

// Start music playback - reuse source if exists, just fade in
function startMusicPlayback() {
    if (!musicBuffer || !audioContext || musicIsPlaying) {
        return;
    }

    // Create source only if needed (first time or after track change)
    if (!musicSource) {
        musicSource = audioContext.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.loop = true;
        musicSource.playbackRate.value = speedMultiplier;

        // Create panner/gain if needed
        if (!musicPanner) {
            musicPanner = audioContext.createStereoPanner();
            musicGain = audioContext.createGain();
            musicGain.gain.value = 0;
            musicPanner.connect(musicGain);
            musicGain.connect(masterGain);
        }

        musicSource.connect(musicPanner);
        musicSource.start(0, musicPausedAt % musicBuffer.duration);
    }

    // Fade in to music volume (master mute is handled by masterGain)
    musicGain.gain.cancelScheduledValues(audioContext.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, audioContext.currentTime);
    musicGain.gain.linearRampToValueAtTime(settings.musicVolume / 100, audioContext.currentTime + RAMP_DURATION / 1000);

    musicStartTime = audioContext.currentTime;
    musicIsPlaying = true;
}

// Stop music playback - just fade gain to 0, keep source alive
function stopMusicPlayback() {
    // Always mark as not playing
    const wasPlaying = musicIsPlaying;
    musicIsPlaying = false;

    if (!musicGain || !wasPlaying) {
        return;
    }

    // Just fade out - source stays alive at rate 0
    musicGain.gain.cancelScheduledValues(audioContext.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, audioContext.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + RAMP_DURATION / 1000);
}

// Update music playback rate and track position (true sample-rate change = pitch shifts with speed)
let lastMusicUpdateTime = 0;
function updateMusicPlaybackRate(rate) {
    if (musicSource && musicIsPlaying && musicBuffer) {
        const now = audioContext.currentTime;
        const deltaTime = lastMusicUpdateTime ? (now - lastMusicUpdateTime) : 0;
        lastMusicUpdateTime = now;

        // Track position continuously based on actual playback rate
        musicPausedAt = (musicPausedAt + deltaTime * musicSource.playbackRate.value) % musicBuffer.duration;

        // Update rate for next frame
        musicSource.playbackRate.value = rate;
    }
}

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

    // Resize wave equation renderer if initialized
    if (waveRenderer) {
        waveRenderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialize audio context and reverb chain (shared by all audio)
function initAudioContext() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create master gain node (all audio goes through this)
    masterGain = audioContext.createGain();
    masterGain.gain.value = 1;

    // Create reverb nodes
    reverbConvolver = audioContext.createConvolver();
    reverbDryGain = audioContext.createGain();
    reverbWetGain = audioContext.createGain();

    // Initialize reverb worker (non-blocking impulse generation)
    initReverbWorker();

    // Set initial reverb impulse
    updateReverbImpulse();

    // Reverb routing: master -> dry/wet split -> destination
    masterGain.connect(reverbDryGain);
    masterGain.connect(reverbConvolver);
    reverbConvolver.connect(reverbWetGain);
    reverbDryGain.connect(audioContext.destination);
    reverbWetGain.connect(audioContext.destination);

    // Set initial mix (dry = 1, wet = 0 when disabled)
    if (settings.reverbEnabled) {
        updateReverbMix();
    } else {
        reverbDryGain.gain.value = 1;
        reverbWetGain.gain.value = 0;
    }
}

// Initialize panning tone oscillator
function initOscillator() {
    if (oscillator) return;

    // Ensure audio context exists
    initAudioContext();

    // Create oscillator chain
    oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = Math.max(20, settings.frequency);

    panner = audioContext.createStereoPanner();
    panner.pan.value = 0;

    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    oscillator.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start();
}

// Initialize audio (legacy wrapper)
function initAudio() {
    initAudioContext();
    initOscillator();
}

// Update audio state
function updateAudio() {
    if (!audioContext) return;

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
            const scaledTonePan = audioPosition * (settings.tonePanAmount / 100);
            const freq = Math.max(20, settings.frequency); // Clamp to audible range
            gainNode.gain.setTargetAtTime(toneVol, audioContext.currentTime, 0.1);
            panner.pan.setTargetAtTime(scaledTonePan, audioContext.currentTime, 0.02);
            oscillator.frequency.setTargetAtTime(freq, audioContext.currentTime, 0.1);
        } else {
            gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
        }
    }

    // Pan music audio (works independently of oscillator)
    if (musicPanner && speedMultiplier > 0) {
        const scaledPan = audioPosition * (settings.musicPanAmount / 100);
        musicPanner.pan.setTargetAtTime(scaledPan, audioContext.currentTime, 0.02);
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

    // Sync music playback rate to ball speed (true sample-rate change)
    updateMusicPlaybackRate(speedMultiplier);
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

    // Clear canvas - use transparent when ripple mode so waves show through
    if (settings.trailStyle === 'ripple') {
        ctx.clearRect(0, 0, width, height);
        document.body.style.backgroundColor = settings.bgColor;
    } else {
        ctx.fillStyle = settings.bgColor;
        ctx.fillRect(0, 0, width, height);
    }

    // Calculate ball screen position
    const ballRadius = settings.ballSize;
    const padding = ballRadius + 50;
    const travelWidth = width - (padding * 2);
    const ballX = padding + ((ballPosition + 1) / 2) * travelWidth;
    const ballY = height / 2;

    // Update trail history (circular buffer auto-limits to maxSize)
    if (settings.trailStyle !== 'none') {
        trailHistory.resize(settings.trailLength); // Adjust capacity if setting changed
        trailHistory.push({ x: ballX, y: ballY });
    } else {
        trailHistory.clear();
    }

    // Draw motion trail (Canvas 2D - basic and 3d styles only)
    if (settings.trailStyle !== 'none' && settings.trailStyle !== 'fluid' && settings.trailStyle !== 'ripple' && trailHistory.length > 1) {
        const rgb = hexToRgb(settings.ballColor);
        const maxAlpha = settings.trailOpacity / 100;

        const len = trailHistory.length;
        for (let i = 0; i < len - 1; i++) {
            const point = trailHistory.get(i);
            const progress = i / len;
            const alpha = progress * maxAlpha;

            let trailRadius, trailY;
            if (settings.trailStyle === '3d') {
                const depth = 1 - progress;
                trailRadius = ballRadius * (0.2 + progress * 0.8) * (0.3 + progress * 0.7);
                trailY = point.y - (depth * ballRadius * 1.5);
            } else {
                trailRadius = ballRadius * (0.3 + progress * 0.7);
                trailY = point.y;
            }

            ctx.beginPath();
            ctx.arc(point.x, trailY, trailRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            ctx.fill();
        }
    }

    // Update wave equation simulation (WebGL)
    if (settings.trailStyle === 'ripple') {
        updateWaveSimulation(ballX, ballY);
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

    // Remove pulse animation on first interaction
    playPauseBtn.classList.remove('pulse');

    // Hide start overlay on first play
    if (isPlaying && startOverlay) {
        startOverlay.style.display = 'none';
    }

    if (isPlaying) {
        // Clear any deceleration state
        isDecelerating = false;
        waitingForEdge = false;

        // Initialize audio on first play if tone enabled
        if (settings.audioEnabled) {
            initAudio(); // Safe to call multiple times - checks internally
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        // Always start audio loop if we have audio context (needed for music panning too)
        if (audioContext) {
            startAudioLoop();
        }

        // Start music playback (fade-in handled in startMusicPlayback)
        if (musicBuffer && audioContext) {
            stopMusicPlayback(); // Force stop first in case timeout hasn't fired
            startMusicPlayback();
        }

        // Start speed ramp UP
        rampDirection = 'up';
        rampStartTime = performance.now();
        rampStartSpeed = speedMultiplier;
    } else {
        // Gentle fade out - let playback rate slowdown do most of the work
        if (musicGain && audioContext && musicIsPlaying) {
            musicGain.gain.setValueAtTime(musicGain.gain.value, audioContext.currentTime);
            musicGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.2);
            setTimeout(() => {
                if (!isPlaying) {
                    stopMusicPlayback();
                }
            }, 1300);
        }

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
    renderWaveEquation();
    requestAnimationFrame(animate);
}

// Settings panel visibility
let pickerIsOpen = false; // Simple flag: is ANY picker currently open?
let inputFocused = false;

function showSettings() {
    settingsPanel.classList.remove('hidden');

    if (mouseTimeout) {
        clearTimeout(mouseTimeout);
    }

    // Don't start hide timeout if picker is open or input is focused
    if (!pickerIsOpen && !inputFocused) {
        mouseTimeout = setTimeout(() => {
            settingsPanel.classList.add('hidden');
        }, 1500);
    }
}

// Reset button click handler (defined once to allow removeEventListener)
function handleResetClick(e) {
    if (confirm('Reset all settings to defaults?')) {
        resetSettings();
    }
    e.currentTarget.blur();
}

// Attach all settings event listeners (called after UI generation/reload)
function attachSettingsEventListeners() {
    // Refresh element references
    speedInput = document.getElementById('speed');
    ballSizeInput = document.getElementById('ballSize');
    ballStyleSelect = document.getElementById('ballStyle');
    glowEnabledInput = document.getElementById('glowEnabled');
    trailStyleSelect = document.getElementById('trailStyle');
    audioEnabledInput = document.getElementById('audioEnabled');
    frequencyInput = document.getElementById('frequency');

    if (!speedInput) return; // Settings UI not yet loaded

    // Speed input
    speedInput.addEventListener('input', (e) => {
        settings.cyclesPerMinute = parseFloat(e.target.value) || 40;
    });

    // Motion type
    document.getElementById('motionType').addEventListener('change', (e) => {
        settings.motionType = e.target.value;
    });

    // Ball size
    ballSizeInput.addEventListener('input', (e) => {
        settings.ballSize = parseFloat(e.target.value) || 60;
        document.getElementById('ballSizeValue').textContent = settings.ballSize;
    });

    // Initialize custom color wheel pickers
    function initColorPicker(id, initialColor, onColorChange) {
        const btn = document.getElementById(id + 'Btn');
        const popup = document.getElementById(id + 'Popup');
        const hexInput = document.getElementById(id + 'Hex');
        const lightnessSlider = document.getElementById(id + 'Lightness');

        if (!btn || !popup) return null;

        // Toggle popup on button click
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close any other open popup
            if (activeColorPopup && activeColorPopup !== popup) {
                activeColorPopup.classList.add('hidden');
            }

            const isOpening = popup.classList.contains('hidden');
            popup.classList.toggle('hidden');

            if (isOpening) {
                // Position popup next to the button
                const btnRect = btn.getBoundingClientRect();
                popup.style.left = (btnRect.right + 10) + 'px';
                popup.style.top = btnRect.top + 'px';

                activeColorPopup = popup;
                pickerIsOpen = true;
                if (mouseTimeout) clearTimeout(mouseTimeout);
            } else {
                activeColorPopup = null;
                pickerIsOpen = false;
            }
        });

        // Create color wheel
        const wheel = new ColorWheel(id + 'Wheel', {
            onChange: (hex) => {
                btn.style.background = hex;
                hexInput.value = hex;
                onColorChange(hex);
            }
        });

        if (wheel.canvas) {
            wheel.setColor(initialColor);
            btn.style.background = initialColor;

            // Lightness slider
            const hsl = wheel.hexToHsl(initialColor);
            if (hsl) {
                lightnessSlider.value = hsl.l;
            }

            lightnessSlider.addEventListener('input', (e) => {
                wheel.setLightness(parseFloat(e.target.value));
            });

            // Prevent clicks inside popup from closing it
            popup.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        return wheel;
    }

    // Ball color picker
    ballColorWheel = initColorPicker('ballColor', settings.ballColor, (hex) => {
        settings.ballColor = hex;
        localStorage.setItem('emdr_ballColor', hex);
        updateFavicon(hex);
    });

    // Background color picker
    bgColorWheel = initColorPicker('bgColor', settings.bgColor, (hex) => {
        settings.bgColor = hex;
    });

    // Ball color hex input
    document.getElementById('ballColorHex').addEventListener('input', (e) => {
        const hex = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            settings.ballColor = hex;
            if (ballColorWheel) ballColorWheel.setColor(hex);
            document.getElementById('ballColorBtn').style.background = hex;
            localStorage.setItem('emdr_ballColor', hex);
            updateFavicon(hex);
        }
    });

    // Background color hex input
    document.getElementById('bgColorHex').addEventListener('input', (e) => {
        const hex = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            settings.bgColor = hex;
            if (bgColorWheel) bgColorWheel.setColor(hex);
            document.getElementById('bgColorBtn').style.background = hex;
        }
    });

    // Ball style
    ballStyleSelect.addEventListener('change', (e) => {
        settings.ballStyle = e.target.value;
    });

    // Glow (toggle button)
    glowEnabledInput.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const isChecked = button.dataset.checked === 'true';
        const newState = !isChecked;
        settings.glowEnabled = newState;
        button.dataset.checked = newState.toString();
        button.querySelector('.toggle-state').textContent = newState ? 'On' : 'Off';
        button.blur(); // Remove focus so spacebar can trigger play/pause
    });

    // Trail style
    trailStyleSelect.addEventListener('change', (e) => {
        settings.trailStyle = e.target.value;
        // Show/hide the advanced checkbox (only show when a trail effect is active)
        document.querySelectorAll('.trail-show').forEach(el => {
            el.classList.toggle('hidden', e.target.value === 'none');
        });
        // Hide advanced options when switching trail types (user needs to re-enable)
        const advancedCheckbox = document.getElementById('trailAdvanced');
        if (advancedCheckbox && !advancedCheckbox.checked) {
            document.querySelectorAll('.trail-advanced-options').forEach(el => {
                el.classList.add('hidden');
            });
        }
        // Initialize Three.js when fluid is selected
        if (e.target.value === 'fluid') {
            initThreeJS();
        }
        // Initialize wave equation when ripple is selected
        if (e.target.value === 'ripple') {
            initWaveEquation();
        }
    });

    // Trail advanced checkbox
    const trailAdvancedCheckbox = document.getElementById('trailAdvanced');
    if (trailAdvancedCheckbox) {
        // Restore checkbox state from settings
        trailAdvancedCheckbox.checked = settings.trailAdvanced;
        // Show/hide advanced options based on saved state
        document.querySelectorAll('.trail-advanced-options').forEach(el => {
            el.classList.toggle('hidden', !settings.trailAdvanced);
        });

        // Save state when changed
        trailAdvancedCheckbox.addEventListener('change', (e) => {
            settings.trailAdvanced = e.target.checked;
            document.querySelectorAll('.trail-advanced-options').forEach(el => {
                el.classList.toggle('hidden', !e.target.checked);
            });
        });
    }

    // Trail length
    document.getElementById('trailLength').addEventListener('input', (e) => {
        settings.trailLength = parseInt(e.target.value) || 15;
        document.getElementById('trailLengthValue').textContent = settings.trailLength;
    });

    // Trail opacity
    document.getElementById('trailOpacity').addEventListener('input', (e) => {
        settings.trailOpacity = parseInt(e.target.value);
        document.getElementById('trailOpacityValue').textContent = settings.trailOpacity;
    });

    // Wave equation parameter controls
    document.getElementById('waveSpeed').addEventListener('input', (e) => {
        settings.waveSpeed = parseFloat(e.target.value);
        document.getElementById('waveSpeedValue').textContent = settings.waveSpeed.toFixed(2);
        if (waveSimMaterial) {
            waveSimMaterial.uniforms.uWaveSpeed.value = settings.waveSpeed;
        }
    });

    document.getElementById('waveDamping').addEventListener('input', (e) => {
        settings.waveDamping = parseFloat(e.target.value);
        document.getElementById('waveDampingValue').textContent = settings.waveDamping.toFixed(3);
        if (waveSimMaterial) {
            waveSimMaterial.uniforms.uDamping.value = settings.waveDamping;
        }
    });

    document.getElementById('waveForce').addEventListener('input', (e) => {
        settings.waveForce = parseFloat(e.target.value);
        document.getElementById('waveForceValue').textContent = settings.waveForce.toFixed(2);
    });

    document.getElementById('simSteps').addEventListener('input', (e) => {
        settings.simSteps = parseInt(e.target.value);
        document.getElementById('simStepsValue').textContent = settings.simSteps;
    });

    document.getElementById('edgeReflect').addEventListener('input', (e) => {
        settings.edgeReflect = parseInt(e.target.value) / 100;
        document.getElementById('edgeReflectValue').textContent = e.target.value;
        if (waveSimMaterial) {
            waveSimMaterial.uniforms.uEdgeReflect.value = settings.edgeReflect;
        }
    });

    document.getElementById('edgeBoundary').addEventListener('input', (e) => {
        settings.edgeBoundary = parseFloat(e.target.value);
        document.getElementById('edgeBoundaryValue').textContent = settings.edgeBoundary.toFixed(1);
        if (waveSimMaterial) {
            waveSimMaterial.uniforms.uEdgeBoundary.value = settings.edgeBoundary / 100;
        }
    });

    document.getElementById('waveSourceSize').addEventListener('input', (e) => {
        settings.waveSourceSize = parseFloat(e.target.value);
        document.getElementById('waveSourceSizeValue').textContent = settings.waveSourceSize.toFixed(1);
    });

    document.getElementById('waveGridSize').addEventListener('change', (e) => {
        settings.waveGridSize = parseInt(e.target.value);
        resizeWaveGrid();
    });

    // Sustained Tone toggle (controls panning tone only, not the audio loop)
    audioEnabledInput.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const isChecked = button.dataset.checked === 'true';
        const newState = !isChecked;
        settings.audioEnabled = newState;
        button.dataset.checked = newState.toString();
        button.querySelector('.toggle-state').textContent = getToggleStateText('audioEnabled', newState);
        button.blur(); // Remove focus so spacebar can trigger play/pause

        // Show/hide tone options
        document.querySelectorAll('.tone-options').forEach(el => {
            el.classList.toggle('hidden', !newState);
        });

        if (newState) {
            initAudio();
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            startAudioLoop();
        }
        // Don't stop audio loop here - it's needed for music panning too
        updateAudio();
    });

    // Frequency input and logarithmic slider
    const freqSlider = document.getElementById('frequencySlider');

    frequencyInput.addEventListener('input', (e) => {
        settings.frequency = Math.max(20, parseFloat(e.target.value) || 110);
        // Sync slider (only if within slider range)
        if (settings.frequency <= FREQ_MAX) {
            freqSlider.value = freqToSlider(settings.frequency);
        }
    });

    freqSlider.addEventListener('input', (e) => {
        const freq = sliderToFreq(parseFloat(e.target.value));
        settings.frequency = Math.round(freq * 10) / 10; // Round to 1 decimal
        frequencyInput.value = settings.frequency;
    });

    // Tone volume
    document.getElementById('toneVolume').addEventListener('input', (e) => {
        settings.toneVolume = parseInt(e.target.value) || 30;
        document.getElementById('toneVolumeValue').textContent = settings.toneVolume;
    });

    // Tone pan
    document.getElementById('tonePan').addEventListener('input', (e) => {
        settings.tonePanAmount = parseInt(e.target.value);
        document.getElementById('tonePanValue').textContent = settings.tonePanAmount;
    });

    // Music audio controls
    const musicSelectEl = document.getElementById('musicSelect');
    const musicVolumeInput = document.getElementById('musicVolume');
    const musicVolumeControls = document.querySelectorAll('.music-volume-control');

    musicSelectEl.addEventListener('change', (e) => {
        const src = e.target.value;

        // Set frequency based on track using centralized map
        setFrequencyForTrack(src, settings, frequencyInput, freqSlider);

        // Update music picker label
        const tracks = musicPickerDropdown.querySelectorAll('.track');
        let selectedLabel = 'None';
        tracks.forEach(track => {
            if (track.dataset.value === src) {
                selectedLabel = track.dataset.label;
                track.classList.add('selected');
            } else {
                track.classList.remove('selected');
            }
        });
        selectedMusicValue = src;
        musicPickerLabel.textContent = src ? `Music: ${selectedLabel}` : 'Music: None';

        // Save selected track to localStorage
        localStorage.setItem('emdr_selectedMusic', src);

        // Stop and disconnect existing audio
        stopMusicPlayback();
        if (musicSource) {
            try { musicSource.stop(); } catch(e) {}
            musicSource.disconnect();
            musicSource = null;
        }
        if (musicPanner) {
            musicPanner.disconnect();
            musicPanner = null;
        }
        if (musicGain) {
            musicGain.disconnect();
            musicGain = null;
        }
        musicBuffer = null;
        musicPausedAt = 0;

        if (src) {
            // Initialize audio context and reverb chain
            initAudioContext();
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Fetch and decode audio to buffer (enables true sample-rate speed control)
            fetch(src)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
                .then(buffer => {
                    musicBuffer = buffer;

                    // Create panner and gain nodes
                    musicPanner = audioContext.createStereoPanner();
                    musicGain = audioContext.createGain();
                    musicGain.gain.value = settings.musicVolume / 100;
                    musicPanner.connect(musicGain);
                    musicGain.connect(masterGain);

                    // Auto-play if already playing
                    if (isPlaying) {
                        startMusicPlayback();
                    }
                })
                .catch(err => {
                    console.log('Failed to load music:', err);
                });

            // Show volume/pan controls
            musicVolumeControls.forEach(el => el.classList.remove('hidden'));

            // Start audio loop if not already running
            startAudioLoop();
        } else {
            // Hide volume/pan controls
            musicVolumeControls.forEach(el => el.classList.add('hidden'));
        }
    });

    // Sync music picker selection to settings select
    if (selectedMusicValue) {
        musicSelectEl.value = selectedMusicValue;
        // Show volume controls if a track is selected
        musicVolumeControls.forEach(el => el.classList.remove('hidden'));
    }

    // Music volume
    musicVolumeInput.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        settings.musicVolume = volume;
        document.getElementById('musicVolumeValue').textContent = volume;
        if (musicGain) {
            musicGain.gain.value = volume / 100;
        }
    });

    // Music pan
    document.getElementById('musicPan').addEventListener('input', (e) => {
        settings.musicPanAmount = parseInt(e.target.value);
        document.getElementById('musicPanValue').textContent = settings.musicPanAmount;
    });

    // Reverb controls (toggle button)
    document.getElementById('reverbEnabled').addEventListener('click', (e) => {
        const button = e.currentTarget;
        const isChecked = button.dataset.checked === 'true';
        const newState = !isChecked;
        settings.reverbEnabled = newState;
        button.dataset.checked = newState.toString();
        button.querySelector('.toggle-state').textContent = newState ? 'On' : 'Off';
        button.blur(); // Remove focus so spacebar can trigger play/pause

        document.querySelectorAll('.reverb-options').forEach(el => {
            el.classList.toggle('hidden', !newState);
        });

        if (newState) {
            // Initialize audio context if needed
            initAudioContext();
            updateReverbMix();
        } else {
            // Disable reverb (full dry)
            if (reverbDryGain && reverbWetGain) {
                reverbDryGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.05);
                reverbWetGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.05);
            }
        }
    });

    document.getElementById('reverbType').addEventListener('change', (e) => {
        settings.reverbType = e.target.value;
        updateReverbImpulse();
    });

    document.getElementById('reverbMix').addEventListener('input', (e) => {
        settings.reverbMix = parseInt(e.target.value);
        document.getElementById('reverbMixValue').textContent = settings.reverbMix;
        if (settings.reverbEnabled) {
            updateReverbMix();
        }
    });

    document.getElementById('reverbDecay').addEventListener('input', (e) => {
        settings.reverbDecay = parseFloat(e.target.value);
        document.getElementById('reverbDecayValue').textContent = settings.reverbDecay.toFixed(1);
        updateReverbImpulse();
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
        // Blur after change so spacebar still works for play/pause
        el.addEventListener('change', () => {
            el.blur();
        });
    });

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

    // Reset settings button handler
    const resetBtn = document.getElementById('resetSettings');
    if (resetBtn) {
        // Remove old listener if it exists, then add new one
        resetBtn.removeEventListener('click', handleResetClick);
        resetBtn.addEventListener('click', handleResetClick);
    }

    // Sync ALL UI elements with current settings values (from localStorage)
    speedInput.value = settings.cyclesPerMinute;
    document.getElementById('motionType').value = settings.motionType;
    ballSizeInput.value = settings.ballSize;
    document.getElementById('ballSizeValue').textContent = settings.ballSize;
    document.getElementById('ballColorHex').value = settings.ballColor;
    document.getElementById('bgColorHex').value = settings.bgColor;
    ballStyleSelect.value = settings.ballStyle;
    glowEnabledInput.dataset.checked = settings.glowEnabled.toString();
    glowEnabledInput.querySelector('.toggle-state').textContent = settings.glowEnabled ? 'On' : 'Off';
    trailStyleSelect.value = settings.trailStyle;

    // Trail options
    document.getElementById('trailLength').value = settings.trailLength;
    document.getElementById('trailLengthValue').textContent = settings.trailLength;
    document.getElementById('trailOpacity').value = settings.trailOpacity;
    document.getElementById('trailOpacityValue').textContent = settings.trailOpacity;

    // Wave/ripple options
    document.getElementById('waveSpeed').value = settings.waveSpeed;
    document.getElementById('waveSpeedValue').textContent = settings.waveSpeed.toFixed(2);
    document.getElementById('waveDamping').value = settings.waveDamping;
    document.getElementById('waveDampingValue').textContent = settings.waveDamping.toFixed(3);
    document.getElementById('waveForce').value = settings.waveForce;
    document.getElementById('waveForceValue').textContent = settings.waveForce.toFixed(2);
    document.getElementById('simSteps').value = settings.simSteps;
    document.getElementById('simStepsValue').textContent = settings.simSteps;
    document.getElementById('edgeReflect').value = settings.edgeReflect * 100;
    document.getElementById('edgeReflectValue').textContent = Math.round(settings.edgeReflect * 100);
    document.getElementById('edgeBoundary').value = settings.edgeBoundary;
    document.getElementById('edgeBoundaryValue').textContent = settings.edgeBoundary.toFixed(1);
    document.getElementById('waveSourceSize').value = settings.waveSourceSize;
    document.getElementById('waveSourceSizeValue').textContent = settings.waveSourceSize.toFixed(1);
    document.getElementById('waveGridSize').value = settings.waveGridSize;

    // Music select (sync to default or saved track)
    const savedMusicTrack = localStorage.getItem('emdr_selectedMusic');
    musicSelectEl.value = savedMusicTrack || DEFAULT_TRACK;

    // Audio options
    audioEnabledInput.dataset.checked = settings.audioEnabled.toString();
    audioEnabledInput.querySelector('.toggle-state').textContent = getToggleStateText('audioEnabled', settings.audioEnabled);
    frequencyInput.value = settings.frequency;
    // Sync frequency slider (logarithmic)
    if (settings.frequency <= FREQ_MAX) {
        freqSlider.value = freqToSlider(settings.frequency);
    } else {
        freqSlider.value = 100;
    }
    document.getElementById('toneVolume').value = settings.toneVolume;
    document.getElementById('toneVolumeValue').textContent = settings.toneVolume;
    document.getElementById('tonePan').value = settings.tonePanAmount;
    document.getElementById('tonePanValue').textContent = settings.tonePanAmount;
    document.getElementById('musicPan').value = settings.musicPanAmount;
    document.getElementById('musicPanValue').textContent = settings.musicPanAmount;
    document.getElementById('musicVolume').value = settings.musicVolume || 50;
    document.getElementById('musicVolumeValue').textContent = settings.musicVolume || 50;

    // Reverb options
    const reverbEnabledBtn = document.getElementById('reverbEnabled');
    reverbEnabledBtn.dataset.checked = settings.reverbEnabled.toString();
    reverbEnabledBtn.querySelector('.toggle-state').textContent = settings.reverbEnabled ? 'On' : 'Off';
    document.getElementById('reverbType').value = settings.reverbType;
    document.getElementById('reverbMix').value = settings.reverbMix;
    document.getElementById('reverbMixValue').textContent = settings.reverbMix;
    document.getElementById('reverbDecay').value = settings.reverbDecay;
    document.getElementById('reverbDecayValue').textContent = settings.reverbDecay.toFixed(1);

    // Show/hide conditional option groups based on current settings
    document.querySelectorAll('.trail-options').forEach(el => {
        el.classList.toggle('hidden', settings.trailStyle === 'none' || settings.trailStyle === 'ripple');
    });
    document.querySelectorAll('.ripple-options').forEach(el => {
        el.classList.toggle('hidden', settings.trailStyle !== 'ripple');
    });
    document.querySelectorAll('.tone-options').forEach(el => {
        el.classList.toggle('hidden', !settings.audioEnabled);
    });
    document.querySelectorAll('.reverb-options').forEach(el => {
        el.classList.toggle('hidden', !settings.reverbEnabled);
    });

    // Initialize effects based on saved trail style
    if (settings.trailStyle === 'fluid') {
        initThreeJS();
    }
    if (settings.trailStyle === 'ripple') {
        initWaveEquation();
    }

    // Apply wave settings to shader after initialization
    if (waveSimMaterial) {
        waveSimMaterial.uniforms.uWaveSpeed.value = settings.waveSpeed;
        waveSimMaterial.uniforms.uDamping.value = settings.waveDamping;
        waveSimMaterial.uniforms.uEdgeReflect.value = settings.edgeReflect;
        waveSimMaterial.uniforms.uEdgeBoundary.value = settings.edgeBoundary / 100;
    }

    // Update audio button icon
    audioBtn.textContent = settings.masterMuted ? '🔇' : '🔊';

    updateFavicon(settings.ballColor);
}

// Expose globally for settings-ui.js to call after UI reload
window.attachSettingsEventListeners = attachSettingsEventListeners;

// Mouse movement shows settings (unless dragging to create waves)
document.addEventListener('mousemove', () => {
    if (!isUserDragging && !justFinishedDragging) {
        showSettings();
    }
});

// Scrolling/dragging in settings resets fade timer
settingsPanel.addEventListener('scroll', showSettings);
settingsPanel.addEventListener('touchmove', showSettings);

// Click outside settings toggles visibility
document.addEventListener('click', (e) => {
    const insideSettings = settingsPanel.contains(e.target);
    const insideColorPopup = e.target.closest('.color-popup');

    // Close any open color popup if clicking outside of it
    if (activeColorPopup && !insideColorPopup && !e.target.closest('.color-swatch-btn')) {
        activeColorPopup.classList.add('hidden');
        activeColorPopup = null;
        pickerIsOpen = false;
    }

    // Don't toggle settings if clicking inside settings or on control buttons
    if (insideSettings || e.target === playPauseBtn || e.target === audioBtn) {
        return;
    }

    // Toggle settings panel visibility (unless just finished dragging waves)
    if (justFinishedDragging) {
        return;
    }

    if (settingsPanel.classList.contains('hidden')) {
        showSettings();
    } else {
        settingsPanel.classList.add('hidden');
        if (mouseTimeout) clearTimeout(mouseTimeout);
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

// Audio button - Master Output Mute
function toggleAudio() {
    settings.masterMuted = !settings.masterMuted;
    audioBtn.textContent = settings.masterMuted ? '🔇' : '🔊';

    if (!audioContext || !masterGain) {
        // Audio not initialized yet, just update the button
        return;
    }

    if (settings.masterMuted) {
        // Fade out master gain
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
        masterGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + RAMP_DURATION / 1000);
    } else {
        // Fade in master gain
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
        masterGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + RAMP_DURATION / 1000);
    }
}
audioBtn.addEventListener('click', () => {
    toggleAudio();
    audioBtn.blur(); // Prevent spacebar from toggling mute
});
audioBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    toggleAudio();
    audioBtn.blur();
});

// Music picker dropdown
const musicPicker = document.getElementById('musicPicker');
const musicPickerLabel = document.getElementById('musicPickerLabel');
const musicPickerDropdown = document.getElementById('musicPickerDropdown');
let selectedMusicValue = '';

// Load music tracks and populate dropdown
const DEFAULT_TRACK = 'audio_files/1_Acoustic/Shepards_Rise_Interlochen.mp3';
const DEFAULT_TRACK_LABEL = "Shepard's Rise (Interlochen)";

fetch('settings-config.json')
    .then(r => r.json())
    .then(config => {
        const tracks = config.musicTracks;

        // Load saved track from localStorage, or use default
        const savedTrack = localStorage.getItem('emdr_selectedMusic');
        const trackToLoad = savedTrack || DEFAULT_TRACK;

        // Build dropdown HTML with correct selection
        let html = '<div class="track none-option" data-value="">None</div>';
        for (const category in tracks) {
            html += `<div class="category">${category}</div>`;
            for (const track of tracks[category]) {
                if (!track.disabled) {
                    const isSelected = track.value === trackToLoad;
                    html += `<div class="track${isSelected ? ' selected' : ''}" data-value="${track.value}" data-label="${track.label}">${track.label}</div>`;
                }
            }
        }
        musicPickerDropdown.innerHTML = html;

        // Find the label for the track
        let trackLabel = DEFAULT_TRACK_LABEL;
        if (savedTrack) {
            for (const category in tracks) {
                const found = tracks[category].find(t => t.value === savedTrack);
                if (found) {
                    trackLabel = found.label;
                    break;
                }
            }
        }

        selectedMusicValue = trackToLoad;
        musicPickerLabel.textContent = trackToLoad ? `Music: ${trackLabel}` : 'Music: None';

        // Set default frequency (will be overridden by change event if track has custom frequency)
        if (!savedTrack) {
            settings.frequency = 97;
        }

        loadMusicTrack(trackToLoad);

        // Sync to settings select if it exists
        const musicSelectEl = document.getElementById('musicSelect');
        if (musicSelectEl) {
            musicSelectEl.value = trackToLoad;
            // Trigger change event to set custom frequency for the track
            if (savedTrack) {
                musicSelectEl.dispatchEvent(new Event('change'));
            }
        }
    });

// Toggle dropdown
musicPickerLabel.addEventListener('click', () => {
    musicPickerDropdown.classList.toggle('hidden');
});

// Handle track selection
musicPickerDropdown.addEventListener('click', (e) => {
    const track = e.target.closest('.track');
    if (!track) return;

    const value = track.dataset.value;
    const label = track.textContent;

    // Update selection
    selectedMusicValue = value;
    musicPickerLabel.textContent = value ? `Music: ${label}` : 'Music: None';
    musicPickerDropdown.classList.add('hidden');

    // Update selected styling
    musicPickerDropdown.querySelectorAll('.track').forEach(t => t.classList.remove('selected'));
    track.classList.add('selected');

    // Trigger music change (same as settings musicSelect)
    const musicSelectEl = document.getElementById('musicSelect');
    if (musicSelectEl) {
        musicSelectEl.value = value;
        musicSelectEl.dispatchEvent(new Event('change'));
    } else {
        // Direct load if settings select doesn't exist
        loadMusicTrack(value);
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!musicPicker.contains(e.target)) {
        musicPickerDropdown.classList.add('hidden');
    }
});

// Helper to load music track directly
function loadMusicTrack(src) {
    // Set frequency based on track using centralized map
    const freqSlider = document.getElementById('frequencySlider');
    setFrequencyForTrack(src, settings, frequencyInput, freqSlider);

    // Stop existing
    stopMusicPlayback();
    if (musicSource) {
        musicSource.stop();
        musicSource.disconnect();
        musicSource = null;
    }
    if (musicPanner) {
        musicPanner.disconnect();
        musicPanner = null;
    }
    if (musicGain) {
        musicGain.disconnect();
        musicGain = null;
    }
    musicBuffer = null;
    musicPausedAt = 0;

    if (!src) return;

    initAudioContext();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    fetch(src)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(buffer => {
            musicBuffer = buffer;
            musicPanner = audioContext.createStereoPanner();
            musicGain = audioContext.createGain();
            musicGain.gain.value = 0;
            musicPanner.connect(musicGain);
            musicGain.connect(masterGain);

            if (isPlaying) {
                startMusicPlayback();
            }
        })
        .catch(err => console.log('Failed to load music:', err));
}

// Canvas click/drag to create waves (only in ripple mode)
canvas.addEventListener('mousedown', (e) => {
    if (settings.trailStyle !== 'ripple') return;
    // Ignore right-clicks and control/command-clicks
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
    isUserDragging = true;
    userDragX = e.clientX;
    userDragY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isUserDragging || settings.trailStyle !== 'ripple') return;
    userDragX = e.clientX;
    userDragY = e.clientY;
});

canvas.addEventListener('mouseup', () => {
    isUserDragging = false;
    // Prevent settings from showing immediately after drag ends
    justFinishedDragging = true;
    setTimeout(() => {
        justFinishedDragging = false;
    }, 200);
});

canvas.addEventListener('mouseleave', () => {
    if (isUserDragging) {
        // Prevent settings from showing immediately after drag ends
        justFinishedDragging = true;
        setTimeout(() => {
            justFinishedDragging = false;
        }, 200);
    }
    isUserDragging = false;
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    if (settings.trailStyle !== 'ripple') return;
    e.preventDefault();
    const touch = e.touches[0];
    isUserDragging = true;
    userDragX = touch.clientX;
    userDragY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (!isUserDragging || settings.trailStyle !== 'ripple') return;
    e.preventDefault();
    const touch = e.touches[0];
    userDragX = touch.clientX;
    userDragY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchend', () => {
    isUserDragging = false;
});

canvas.addEventListener('touchcancel', () => {
    isUserDragging = false;
});

// Initialize
resizeCanvas();

// Add pulse animation to play button on first load
playPauseBtn.classList.add('pulse');

requestAnimationFrame(animate);
