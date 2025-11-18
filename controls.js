import { params } from './config.js';

/**
 * Setup UI controls for simulation parameters
 * @param {Function} resetCallback - Callback function for reset button
 */
export function setupControls(resetCallback) {
    const controls = ['sensingDistance', 'sensingAngle', 'turningAngle',
                    'depositAmount', 'decayAmount', 'stepSize'];

    controls.forEach(name => {
        const slider = document.getElementById(name);
        const valueDisplay = document.getElementById(name + 'Value');
        slider.addEventListener('input', (e) => {
            params[name] = parseFloat(e.target.value);
            valueDisplay.textContent = params[name].toFixed(2);
        });
    });

    document.getElementById('resetButton').addEventListener('click', resetCallback);
}

/**
 * Update FPS display
 * @param {number} fps - Current FPS value
 */
export function updateFPS(fps) {
    const fpsElement = document.getElementById('fps');
    if (fpsElement) {
        fpsElement.textContent = fps;
    }
}
