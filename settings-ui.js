// Settings UI Generator - loads config from JSON
// Edit settings-config.json to modify settings (press Shift+R to reload without page refresh)

let settingsConfig = null;
let musicTracks = null;

function getToggleStateText(buttonId, isEnabled) {
    if (buttonId === 'audioEnabled') {
        return isEnabled ? 'Active' : 'Disabled';
    }
    if (buttonId === 'reverbEnabled') {
        return isEnabled ? 'Enabled' : 'Disabled';
    }
    return isEnabled ? 'On' : 'Off';
}

function generateSettingsHTML() {
    if (!settingsConfig || !musicTracks) return '<h2>Loading...</h2>';

    let html = '<h2>Settings</h2>';
    let inSection = false;

    for (const setting of settingsConfig) {
        const className = setting.className || '';

        // Close previous section and start new one when we hit a header
        if (setting.type === 'header') {
            if (inSection) {
                html += '</div>'; // Close previous section
            }
            html += '<div class="setting-section">'; // Start new section
            inSection = true;
        }

        switch (setting.type) {
            case 'number':
                const numStep = setting.step ? `step="${setting.step}"` : '';
                // Parse label to style units in parentheses
                let labelHtml = setting.label;
                const unitMatch = setting.label.match(/^(.+?)(\s*\([^)]+\))$/);
                if (unitMatch) {
                    labelHtml = `${unitMatch[1]}<span class="label-unit">${unitMatch[2]}</span>`;
                }
                html += `
                    <div class="setting-group ${className}">
                        <label for="${setting.id}">${labelHtml}</label>
                        <input type="number" id="${setting.id}" min="${setting.min}" max="${setting.max}" ${numStep} value="${setting.value}">
                    </div>`;
                break;

            case 'range':
                const step = setting.step ? `step="${setting.step}"` : '';
                const suffix = setting.suffix || '';
                const displayValue = setting.step && setting.step < 1 ? setting.value.toFixed(String(setting.step).split('.')[1]?.length || 1) : setting.value;
                if (setting.hideLabel) {
                    html += `
                        <div class="setting-group ${className}">
                            <input type="range" id="${setting.id}" min="${setting.min}" max="${setting.max}" ${step} value="${setting.value}">
                        </div>`;
                } else {
                    html += `
                        <div class="setting-group ${className}">
                            <label for="${setting.id}">${setting.label}: <span id="${setting.id}Value">${displayValue}</span>${suffix}</label>
                            <input type="range" id="${setting.id}" min="${setting.min}" max="${setting.max}" ${step} value="${setting.value}">
                        </div>`;
                }
                break;

            case 'select':
                let optionsHtml = setting.options.map(opt =>
                    `<option value="${opt.value}"${opt.selected ? ' selected' : ''}>${opt.label}</option>`
                ).join('');
                html += `
                    <div class="setting-group ${className}">
                        <label for="${setting.id}">${setting.label}</label>
                        <select id="${setting.id}">${optionsHtml}</select>
                    </div>`;
                break;

            case 'checkbox':
                html += `
                    <div class="setting-group ${className}">
                        <label for="${setting.id}">
                            <input type="checkbox" id="${setting.id}"${setting.checked ? ' checked' : ''}>
                            ${setting.label}
                        </label>
                    </div>`;
                break;

            case 'toggle':
                const toggleState = getToggleStateText(setting.id, setting.checked);
                const labelText = setting.label ? `${setting.label}: ` : '';
                html += `
                    <div class="setting-group ${className}">
                        <button type="button" class="toggle-btn" id="${setting.id}" data-checked="${setting.checked ? 'true' : 'false'}">
                            ${labelText}<span class="toggle-state">${toggleState}</span>
                        </button>
                    </div>`;
                break;

            case 'header':
                html += `
                    <div class="setting-header ${className}">
                        <h3>${setting.label}</h3>
                    </div>`;
                break;

            case 'color':
                html += `
                    <div class="setting-group ${className}">
                        <label>${setting.label}</label>
                        <div class="color-row">
                            <button type="button" class="color-swatch-btn" id="${setting.id}Btn" style="background: ${setting.value}"></button>
                            <input type="text" id="${setting.id}Hex" value="${setting.value}" class="hex-input">
                            <button type="button" class="copy-btn" data-target="${setting.id}Hex">Copy</button>
                        </div>
                        <div class="color-popup hidden" id="${setting.id}Popup">
                            <canvas id="${setting.id}Wheel" class="color-wheel" width="150" height="150"></canvas>
                            <div class="color-lightness">
                                <input type="range" id="${setting.id}Lightness" min="0" max="100" value="50">
                            </div>
                        </div>
                    </div>`;
                break;

            case 'music':
                let musicHtml = '<option value="">None</option>';
                for (const [group, tracks] of Object.entries(musicTracks)) {
                    musicHtml += `<optgroup label="${group}">`;
                    for (const track of tracks) {
                        musicHtml += `<option value="${track.value}">${track.label}</option>`;
                    }
                    musicHtml += '</optgroup>';
                }
                const musicLabel = setting.label ? `<label for="${setting.id}">${setting.label}</label>` : '';
                html += `
                    <div class="setting-group ${className}">
                        ${musicLabel}
                        <select id="${setting.id}">${musicHtml}</select>
                    </div>`;
                break;
        }
    }

    // Close the final section
    if (inSection) {
        html += '</div>';
    }

    // Add reset button at the bottom
    html += '<button type="button" class="reset-settings-btn" id="resetSettings">Reset All Settings</button>';

    return html;
}

async function loadSettingsConfig() {
    try {
        const response = await fetch('settings-config.json?t=' + Date.now()); // Cache bust
        const config = await response.json();
        musicTracks = config.musicTracks;
        settingsConfig = config.settings;
        return true;
    } catch (err) {
        console.error('Failed to load settings config:', err);
        return false;
    }
}

async function initSettingsUI() {
    const settingsPanel = document.getElementById('settings');
    if (!settingsPanel) return;

    const loaded = await loadSettingsConfig();
    if (loaded) {
        settingsPanel.innerHTML = generateSettingsHTML();
        // Attach event listeners from app.js
        if (window.attachSettingsEventListeners) {
            window.attachSettingsEventListeners();
        }
    }
}

async function reloadSettingsUI() {
    console.log('Reloading settings config...');
    const loaded = await loadSettingsConfig();
    if (loaded) {
        const settingsPanel = document.getElementById('settings');
        if (settingsPanel) {
            // Preserve current control values before regenerating
            const currentValues = {};
            settingsPanel.querySelectorAll('input, select').forEach(el => {
                if (el.type === 'checkbox') {
                    currentValues[el.id] = el.checked;
                } else {
                    currentValues[el.id] = el.value;
                }
            });

            // Regenerate UI
            settingsPanel.innerHTML = generateSettingsHTML();

            // Restore current values
            for (const [id, value] of Object.entries(currentValues)) {
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = value;
                    } else {
                        el.value = value;
                    }
                }
            }

            // Re-attach event listeners from app.js
            if (window.attachSettingsEventListeners) {
                window.attachSettingsEventListeners();
            }

            console.log('Settings UI reloaded (Shift+R)');
        }
    }
}

// Keyboard shortcut: Shift+R to reload settings config, Shift+W to toggle watch mode
document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'R') {
        e.preventDefault();
        reloadSettingsUI();
    }
    if (e.shiftKey && e.key === 'W') {
        e.preventDefault();
        toggleWatchMode();
    }
});

// Watch mode - polls for JSON changes
let watchInterval = null;
let lastConfigHash = null;

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

async function checkForChanges() {
    try {
        const response = await fetch('settings-config.json?t=' + Date.now());
        const text = await response.text();
        const hash = hashString(text);

        if (lastConfigHash !== null && hash !== lastConfigHash) {
            console.log('Settings config changed, reloading UI...');
            const config = JSON.parse(text);
            musicTracks = config.musicTracks;
            settingsConfig = config.settings;

            const settingsPanel = document.getElementById('settings');
            if (settingsPanel) {
                // Preserve current values
                const currentValues = {};
                settingsPanel.querySelectorAll('input, select').forEach(el => {
                    if (el.type === 'checkbox') {
                        currentValues[el.id] = el.checked;
                    } else {
                        currentValues[el.id] = el.value;
                    }
                });

                settingsPanel.innerHTML = generateSettingsHTML();

                // Restore values
                for (const [id, value] of Object.entries(currentValues)) {
                    const el = document.getElementById(id);
                    if (el) {
                        if (el.type === 'checkbox') {
                            el.checked = value;
                        } else {
                            el.value = value;
                        }
                    }
                }

                // Re-attach event listeners from app.js
                if (window.attachSettingsEventListeners) {
                    window.attachSettingsEventListeners();
                }
            }
        }
        lastConfigHash = hash;
    } catch (err) {
        // Ignore fetch errors during watch
    }
}

function toggleWatchMode() {
    if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
        console.log('Watch mode OFF');
    } else {
        lastConfigHash = null;
        checkForChanges(); // Get initial hash
        watchInterval = setInterval(checkForChanges, 1000);
        console.log('Watch mode ON (polling every 1s) - press Shift+W to disable');
    }
}

// Initialize on load and start watching
initSettingsUI().then(() => {
    // Auto-start watch mode
    lastConfigHash = null;
    checkForChanges();
    watchInterval = setInterval(checkForChanges, 1000);
    console.log('Settings watch mode active (polls every 1s)');
});
