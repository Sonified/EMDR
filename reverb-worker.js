// Reverb Impulse Response Generator - Web Worker
// Offloads CPU-intensive impulse generation from main thread

const PRESETS = {
    room: { durationMult: 0.7, earlyDelay: 0.01, diffusion: 0.7, damping: 0.3 },
    hall: { durationMult: 1.2, earlyDelay: 0.03, diffusion: 0.85, damping: 0.15 },
    plate: { durationMult: 0.9, earlyDelay: 0.005, diffusion: 0.95, damping: 0.1 },
    cathedral: { durationMult: 1.5, earlyDelay: 0.05, diffusion: 0.9, damping: 0.08 }
};

function generateImpulse(sampleRate, type, decay) {
    const preset = PRESETS[type] || PRESETS.room;
    const duration = Math.min(preset.durationMult * decay, 6);
    const length = Math.floor(sampleRate * duration);

    // Create raw Float32Arrays for both channels
    const channels = [new Float32Array(length), new Float32Array(length)];

    for (let channel = 0; channel < 2; channel++) {
        const data = channels[channel];
        const stereoOffset = channel === 0 ? 1 : 0.97;
        const earlyThreshold = preset.earlyDelay * 3;
        const diffusionMult = preset.diffusion * 0.3;
        const oneMinusDiffusion = 1 - diffusionMult;
        const invDecayHalf = 1 / (decay * 0.5);
        const invLength = 1 / length;

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const progress = i * invLength;

            // Exponential decay envelope
            const envelope = Math.exp(-t * invDecayHalf);

            // High frequency damping over time
            const dampingFactor = 1 - (progress * preset.damping);

            // Generate noise
            let sample = Math.random() * 2 - 1;

            // Add early reflections
            if (t < earlyThreshold) {
                const earlyAmp = Math.exp(-t / preset.earlyDelay) * 0.5;
                sample += (Math.random() * 2 - 1) * earlyAmp;
            }

            // Apply diffusion (smoothing)
            if (preset.diffusion > 0.5 && i > 0) {
                sample = sample * oneMinusDiffusion + data[i - 1] * diffusionMult;
            }

            data[i] = sample * envelope * dampingFactor * stereoOffset;
        }
    }

    return { channels, length, sampleRate };
}

self.onmessage = function(e) {
    const { sampleRate, type, decay, id } = e.data;

    const result = generateImpulse(sampleRate, type, decay);

    // Transfer the ArrayBuffers for zero-copy performance
    self.postMessage(
        {
            id,
            channels: result.channels,
            length: result.length,
            sampleRate: result.sampleRate
        },
        [result.channels[0].buffer, result.channels[1].buffer]
    );
};
