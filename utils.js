/**
 * Convert HSV color to RGB
 * @param {number} h - Hue (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value (0-1)
 * @returns {Array<number>} RGB values [r, g, b] (0-1)
 */
export function hsv2rgb(h, s, v) {
    const k = (n) => (n + h * 6) % 6;
    const f = (n) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
    return [f(5), f(3), f(1)];
}

/**
 * Display an error message on the page
 * @param {string} message - Error message to display
 */
export function showError(message) {
    document.body.innerHTML += `
        <div class="error">
            <h2>WebGPU Not Available</h2>
            <p>${message}</p>
            <p style="margin-top: 1rem;">WebGPU requires a modern browser with GPU support enabled.</p>
        </div>
    `;
}
