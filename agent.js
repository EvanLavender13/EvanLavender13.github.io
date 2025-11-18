import { AGENT_COUNT } from './config.js';
import { hsv2rgb } from './utils.js';

/**
 * Initialize agent data with positions, angles, and colors
 * @param {number} width - Simulation width
 * @param {number} height - Simulation height
 * @returns {Float32Array} Agent data array
 */
export function initAgents(width, height) {
    const agentData = new Float32Array(AGENT_COUNT * 6);

    // Initialize agents in center with random colors
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.2;

    for (let i = 0; i < AGENT_COUNT; i++) {
        const idx = i * 6;

        // Position - radial distribution from center
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        agentData[idx + 0] = centerX + Math.cos(angle) * r; // x
        agentData[idx + 1] = centerY + Math.sin(angle) * r; // y

        // Angle
        agentData[idx + 2] = Math.random() * Math.PI * 2;

        // Color - 4 different colors for variety
        const colorGroup = Math.floor(Math.random() * 4);
        const hue = colorGroup * 0.25; // 0, 0.25, 0.5, 0.75
        const rgb = hsv2rgb(hue, 1.0, 1.0);
        agentData[idx + 3] = rgb[0]; // r
        agentData[idx + 4] = rgb[1]; // g
        agentData[idx + 5] = rgb[2]; // b
    }

    return agentData;
}
