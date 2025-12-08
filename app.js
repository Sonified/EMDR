// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Settings elements
const settingsPanel = document.getElementById('settings');
const speedInput = document.getElementById('speed');
const ballColorInput = document.getElementById('ballColor');
const ballStyleSelect = document.getElementById('ballStyle');
const glowEnabledInput = document.getElementById('glowEnabled');
const trailEnabledInput = document.getElementById('trailEnabled');
const bgColorInput = document.getElementById('bgColor');
const audioEnabledInput = document.getElementById('audioEnabled');
const frequencyInput = document.getElementById('frequency');

// State
let settings = {
    cyclesPerMinute: 20,
    ballColor: '#ffffff',
    ballStyle: 'solid',
    glowEnabled: false,
    trailEnabled: false,
    bgColor: '#000000',
    audioEnabled: false,
    frequency: 220
};

// Trail history for motion trail effect
const trailHistory = [];

let ballPosition = 0; // -1 to 1 (left to right)
let startTime = null;
let mouseTimeout = null;

// Audio context and nodes
let audioContext = null;
let oscillator = null;
let panner = null;
let gainNode = null;

// Resize canvas to fill window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
function updateAudio() {
    if (!audioContext) return;

    if (settings.audioEnabled) {
        gainNode.gain.setTargetAtTime(0.3, audioContext.currentTime, 0.1);
        panner.pan.setTargetAtTime(ballPosition, audioContext.currentTime, 0.02);
        oscillator.frequency.setTargetAtTime(settings.frequency, audioContext.currentTime, 0.1);
    } else {
        gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
    }
}

// Calculate ball position based on time
function calculateBallPosition(timestamp) {
    if (!startTime) startTime = timestamp;

    const elapsed = timestamp - startTime;
    const cyclesPerSecond = settings.cyclesPerMinute / 60;
    const period = 1000 / cyclesPerSecond; // ms per cycle

    // Use sine wave for smooth back and forth motion
    const phase = (elapsed / period) * Math.PI * 2;
    ballPosition = Math.sin(phase);
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
    const ballRadius = Math.min(width, height) * 0.03;
    const padding = ballRadius + 50;
    const travelWidth = width - (padding * 2);
    const ballX = padding + ((ballPosition + 1) / 2) * travelWidth;
    const ballY = height / 2;

    // Update trail history
    if (settings.trailEnabled) {
        trailHistory.push({ x: ballX, y: ballY });
        // Keep last 20 positions
        if (trailHistory.length > 20) {
            trailHistory.shift();
        }
    } else {
        trailHistory.length = 0;
    }

    // Draw motion trail
    if (settings.trailEnabled && trailHistory.length > 1) {
        const rgb = hexToRgb(settings.ballColor);
        for (let i = 0; i < trailHistory.length - 1; i++) {
            const alpha = (i / trailHistory.length) * 0.5;
            const trailRadius = ballRadius * (0.3 + (i / trailHistory.length) * 0.7);

            ctx.beginPath();
            ctx.arc(trailHistory[i].x, trailHistory[i].y, trailRadius, 0, Math.PI * 2);
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
        case 'solid':
            ctx.fillStyle = settings.ballColor;
            ctx.fill();
            break;

        case 'circle':
            ctx.strokeStyle = settings.ballColor;
            ctx.lineWidth = 3;
            ctx.stroke();
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

// Animation loop
function animate(timestamp) {
    calculateBallPosition(timestamp);
    draw();
    updateAudio();
    requestAnimationFrame(animate);
}

// Settings panel visibility
function showSettings() {
    settingsPanel.classList.remove('hidden');

    if (mouseTimeout) {
        clearTimeout(mouseTimeout);
    }

    mouseTimeout = setTimeout(() => {
        settingsPanel.classList.add('hidden');
    }, 2000);
}

// Event listeners for settings
speedInput.addEventListener('input', (e) => {
    settings.cyclesPerMinute = parseFloat(e.target.value) || 20;
});

ballColorInput.addEventListener('input', (e) => {
    settings.ballColor = e.target.value;
});

ballStyleSelect.addEventListener('change', (e) => {
    settings.ballStyle = e.target.value;
});

glowEnabledInput.addEventListener('change', (e) => {
    settings.glowEnabled = e.target.checked;
});

trailEnabledInput.addEventListener('change', (e) => {
    settings.trailEnabled = e.target.checked;
});

bgColorInput.addEventListener('input', (e) => {
    settings.bgColor = e.target.value;
});

audioEnabledInput.addEventListener('change', (e) => {
    settings.audioEnabled = e.target.checked;
    if (settings.audioEnabled) {
        initAudio();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
    updateAudio();
});

frequencyInput.addEventListener('input', (e) => {
    settings.frequency = parseFloat(e.target.value) || 220;
});

// Mouse movement shows settings
document.addEventListener('mousemove', showSettings);

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Initialize
resizeCanvas();
requestAnimationFrame(animate);
