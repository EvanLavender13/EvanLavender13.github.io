import { AGENT_COUNT, WORKGROUP_SIZE } from './config.js';

// Shared shader code (structs and utility functions only)
const shaderCommon = `
struct Parameters {
    frameBufferWidth: f32,
    frameBufferHeight: f32,
    sensingDistance: f32,
    sensingAngle: f32,
    turningAngle: f32,
    depositAmount: f32,
    decayAmount: f32,
    stepSize: f32,
}

struct Agent {
    x: f32,
    y: f32,
    angle: f32,
    r: f32,
    g: f32,
    b: f32,
}

fn hash(state: u32) -> f32 {
    var s = state;
    s ^= 2747636419u;
    s *= 2654435769u;
    s ^= s >> 16;
    s *= 2654435769u;
    s ^= s >> 16;
    s *= 2654435769u;
    return f32(s) / 4294967295.0;
}

fn rgb2hsv(c: vec3f) -> vec3f {
    let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    let p = mix(vec4f(c.bg, K.wz), vec4f(c.gb, K.xy), select(0.0, 1.0, c.b < c.g));
    let q = mix(vec4f(p.xyw, c.r), vec4f(c.r, p.yzx), select(0.0, 1.0, p.x < c.r));
    let d = q.x - min(q.w, q.y);
    let e = 1.0e-10;
    return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

fn hsv2rgb(c: vec3f) -> vec3f {
    let K = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
}
`;

/**
 * Stage 0: Agent update shader
 * Moves agents based on their sensing behavior
 */
export const computeShaderStage0 = shaderCommon + `
@group(0) @binding(0) var agentMap: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(1) var agentMapOut: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var trailMap: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(3) var trailMapOut: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> params: Parameters;
@group(0) @binding(5) var<storage, read_write> agents: array<Agent>;

@compute @workgroup_size(${WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let gid = global_id.x;
    if (gid >= ${AGENT_COUNT}u) {
        return;
    }

    let width = u32(params.frameBufferWidth);
    let height = u32(params.frameBufferHeight);
    let angle = agents[gid].angle;
    let position = vec2f(agents[gid].x, agents[gid].y);
    let pixel = vec2i(i32(position.x), i32(position.y));

    let sensingDistance = params.sensingDistance;
    let sensingAngle = params.sensingAngle;
    let sensor_front = vec2f(
        (position.x + sensingDistance * cos(angle)) % f32(width),
        (position.y + sensingDistance * sin(angle)) % f32(height)
    );
    let sensor_left = vec2f(
        (position.x + sensingDistance * cos(angle + sensingAngle)) % f32(width),
        (position.y + sensingDistance * sin(angle + sensingAngle)) % f32(height)
    );
    let sensor_right = vec2f(
        (position.x + sensingDistance * cos(angle - sensingAngle)) % f32(width),
        (position.y + sensingDistance * sin(angle - sensingAngle)) % f32(height)
    );

    let sensor_front_pos = vec2i(i32(sensor_front.x), i32(sensor_front.y));
    let sensor_left_pos = vec2i(i32(sensor_left.x), i32(sensor_left.y));
    let sensor_right_pos = vec2i(i32(sensor_right.x), i32(sensor_right.y));

    let sensor_front_color = textureLoad(trailMap, sensor_front_pos);
    let sensor_left_color = textureLoad(trailMap, sensor_left_pos);
    let sensor_right_color = textureLoad(trailMap, sensor_right_pos);

    let sensor_front_hsv = rgb2hsv(sensor_front_color.rgb);
    let sensor_left_hsv = rgb2hsv(sensor_left_color.rgb);
    let sensor_right_hsv = rgb2hsv(sensor_right_color.rgb);

    let color = vec4f(agents[gid].r, agents[gid].g, agents[gid].b, 0.0);
    let color_hsv = rgb2hsv(color.rgb);
    let sensor_front_v = abs(color_hsv.x - sensor_front_hsv.x);
    let sensor_left_v = abs(color_hsv.x - sensor_left_hsv.x);
    let sensor_right_v = abs(color_hsv.x - sensor_right_hsv.x);

    let rnd = hash(gid);
    let turningAngle = params.turningAngle;
    var new_angle = angle;

    if ((sensor_left_v < sensor_front_v) && (sensor_right_v < sensor_front_v)) {
        if (rnd < 0.5) {
            new_angle += turningAngle;
        } else {
            new_angle -= turningAngle;
        }
    } else if (sensor_right_v > sensor_left_v) {
        new_angle += turningAngle;
    } else if (sensor_left_v > sensor_right_v) {
        new_angle -= turningAngle;
    }

    let stepSize = params.stepSize;
    let new_position = vec2f(
        (agents[gid].x + stepSize * cos(new_angle)) % f32(width),
        (agents[gid].y + stepSize * sin(new_angle)) % f32(height)
    );
    let new_pixel = vec2i(i32(new_position.x), i32(new_position.y));

    let agentMapNewV = textureLoad(agentMap, new_pixel);
    let trailMapV = textureLoad(trailMap, pixel);  // Read from OLD position

    let depositAmount = params.depositAmount;
    let full_color = vec4f(color.rgb, 1.0);
    let new_color = full_color * depositAmount;
    let new_value = trailMapV + new_color;  // Use trail value from OLD position

    textureStore(agentMapOut, new_pixel, agentMapNewV + vec4f(1.0));
    textureStore(trailMapOut, new_pixel, new_value);

    agents[gid].x = new_position.x;
    agents[gid].y = new_position.y;
    agents[gid].angle = new_angle;
}
`;

/**
 * Stage 1: Diffusion and decay shader
 * Blurs and decays the trail map
 */
export const computeShaderStage1 = shaderCommon + `
@group(0) @binding(1) var agentMapOut: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var trailMap: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(3) var trailMapOut: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> params: Parameters;

@compute @workgroup_size(${WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let gid = global_id.x;
    let width = u32(params.frameBufferWidth);
    let height = u32(params.frameBufferHeight);

    if (gid >= width * height) {
        return;
    }

    let y = i32(gid / width);
    let x = i32(gid % width);
    let k = i32(3 / 2);
    let n = pow(3.0, 2.0);
    var sum = vec4f(0.0);

    for (var i = -k; i <= k; i++) {
        for (var j = -k; j <= k; j++) {
            let pos_k = vec2i(
                i32((f32(x + i) % f32(width) + f32(width)) % f32(width)),
                i32((f32(y + j) % f32(height) + f32(height)) % f32(height))
            );
            sum += textureLoad(trailMap, pos_k);
        }
    }

    let pixel = vec2i(x, y);
    let decayAmount = 1.0 - params.decayAmount;
    let v = sum / n;
    textureStore(trailMapOut, pixel, v * decayAmount);
    textureStore(agentMapOut, pixel, vec4f(0.0));
}
`;

/**
 * Display shader
 * Renders the trail map to the canvas
 */
export const displayShader = `
@group(0) @binding(0) var displayTexture: texture_2d<f32>;
@group(0) @binding(1) var displaySampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0)
    );

    var texCoord = array<vec2f, 6>(
        vec2f(0.0, 1.0),
        vec2f(1.0, 1.0),
        vec2f(0.0, 0.0),
        vec2f(0.0, 0.0),
        vec2f(1.0, 1.0),
        vec2f(1.0, 0.0)
    );

    var output: VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    output.texCoord = texCoord[vertexIndex];
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(displayTexture, displaySampler, input.texCoord);
}
`;
