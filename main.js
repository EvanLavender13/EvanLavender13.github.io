import { initWebGPU } from './webgpu.js';
import { showError } from './utils.js';

/**
 * Main application entry point
 */
initWebGPU().catch(err => {
    console.error(err);
    showError('An error occurred while initializing WebGPU: ' + err.message);
});
