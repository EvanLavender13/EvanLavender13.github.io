import { params } from './config.js';

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

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
            const value = parseFloat(e.target.value);

            // Convert degrees to radians for angle parameters
            if (name === 'sensingAngle' || name === 'turningAngle') {
                params[name] = degreesToRadians(value);
                valueDisplay.textContent = value.toFixed(1);
            } else {
                params[name] = value;
                valueDisplay.textContent = value.toFixed(2);
            }
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
