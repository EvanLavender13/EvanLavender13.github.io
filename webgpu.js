import { AGENT_COUNT, WORKGROUP_SIZE, SIM_WIDTH, SIM_HEIGHT, params } from './config.js';
import { computeShaderStage0, computeShaderStage1, displayShader } from './shaders.js';
import { initAgents } from './agent.js';
import { setupControls, updateFPS } from './controls.js';
import { showError } from './utils.js';

/**
 * Initialize and run WebGPU simulation
 */
export async function initWebGPU() {
    const canvas = document.getElementById('canvas');

    if (!navigator.gpu) {
        showError('WebGPU is not supported in your browser. Try Chrome 113+, Edge 113+, or Safari 18+.');
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        showError('Failed to get GPU adapter.');
        return;
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    // Create resources
    let agentData = initAgents(SIM_WIDTH, SIM_HEIGHT);

    const agentBuffer = device.createBuffer({
        size: agentData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(agentBuffer, 0, agentData);

    const paramsBuffer = device.createBuffer({
        size: 32, // 8 floats
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    function updateParams() {
        const paramsData = new Float32Array([
            SIM_WIDTH,
            SIM_HEIGHT,
            params.sensingDistance,
            params.sensingAngle,
            params.turningAngle,
            params.depositAmount,
            params.decayAmount,
            params.stepSize,
        ]);
        device.queue.writeBuffer(paramsBuffer, 0, paramsData);
    }
    updateParams();

    // Create textures
    const createTexture = () => device.createTexture({
        size: [SIM_WIDTH, SIM_HEIGHT],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    let agentMap = createTexture();
    let agentMapOut = createTexture();
    let trailMap = createTexture();
    let trailMapOut = createTexture();

    // Compile shaders
    const computeModule0 = device.createShaderModule({ code: computeShaderStage0 });
    const computeModule1 = device.createShaderModule({ code: computeShaderStage1 });
    const displayModule = device.createShaderModule({ code: displayShader });

    const computePipeline0 = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: computeModule0,
            entryPoint: 'main',
        },
    });

    const computePipeline1 = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: computeModule1,
            entryPoint: 'main',
        },
    });

    // Display pipeline
    const displayPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: displayModule,
            entryPoint: 'vertexMain',
        },
        fragment: {
            module: displayModule,
            entryPoint: 'fragmentMain',
            targets: [{ format }],
        },
    });

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    function reset() {
        agentData = initAgents(SIM_WIDTH, SIM_HEIGHT);
        device.queue.writeBuffer(agentBuffer, 0, agentData);

        // Clear textures
        agentMap = createTexture();
        agentMapOut = createTexture();
        trailMap = createTexture();
        trailMapOut = createTexture();
    }

    setupControls(reset);

    // Animation loop
    let frameCount = 0;
    let lastTime = performance.now();

    function render() {
        updateParams();

        const encoder = device.createCommandEncoder();

        // Stage 0: Agent update
        const bindGroup0 = device.createBindGroup({
            layout: computePipeline0.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: agentMap.createView() },
                { binding: 1, resource: agentMapOut.createView() },
                { binding: 2, resource: trailMap.createView() },
                { binding: 3, resource: trailMapOut.createView() },
                { binding: 4, resource: { buffer: paramsBuffer } },
                { binding: 5, resource: { buffer: agentBuffer } },
            ],
        });

        const computePass0 = encoder.beginComputePass();
        computePass0.setPipeline(computePipeline0);
        computePass0.setBindGroup(0, bindGroup0);
        computePass0.dispatchWorkgroups(Math.ceil(AGENT_COUNT / WORKGROUP_SIZE));
        computePass0.end();

        // Swap agent maps
        [agentMap, agentMapOut] = [agentMapOut, agentMap];

        // Swap trail maps (so Stage 1 can read the deposits from Stage 0)
        [trailMap, trailMapOut] = [trailMapOut, trailMap];

        // Stage 1: Diffusion
        const bindGroup1 = device.createBindGroup({
            layout: computePipeline1.getBindGroupLayout(0),
            entries: [
                { binding: 1, resource: agentMapOut.createView() },
                { binding: 2, resource: trailMap.createView() },
                { binding: 3, resource: trailMapOut.createView() },
                { binding: 4, resource: { buffer: paramsBuffer } },
            ],
        });

        const computePass1 = encoder.beginComputePass();
        computePass1.setPipeline(computePipeline1);
        computePass1.setBindGroup(0, bindGroup1);
        computePass1.dispatchWorkgroups(Math.ceil((SIM_WIDTH * SIM_HEIGHT) / WORKGROUP_SIZE));
        computePass1.end();

        // Swap trail maps (so Display can read the blurred result from Stage 1)
        [trailMap, trailMapOut] = [trailMapOut, trailMap];

        // Display pass
        const displayBindGroup = device.createBindGroup({
            layout: displayPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: trailMap.createView() },
                { binding: 1, resource: sampler },
            ],
        });

        const textureView = context.getCurrentTexture().createView();
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        renderPass.setPipeline(displayPipeline);
        renderPass.setBindGroup(0, displayBindGroup);
        renderPass.draw(6);
        renderPass.end();

        device.queue.submit([encoder.finish()]);

        // FPS counter
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
            updateFPS(frameCount);
            frameCount = 0;
            lastTime = now;
        }

        requestAnimationFrame(render);
    }

    render();
}
