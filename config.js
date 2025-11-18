// Simulation constants
export const AGENT_COUNT = 1024 * 256; // 262,144 agents
export const WORKGROUP_SIZE = 128;

// Simulation resolution
export const SIM_WIDTH = 1920;
export const SIM_HEIGHT = 1080;

// Default simulation parameters
// Note: angles are stored in radians internally but displayed as degrees in UI
export const params = {
    sensingDistance: 10.0,
    sensingAngle: 0.7853981633974483,  // 45 degrees
    turningAngle: 0.7853981633974483,   // 45 degrees
    depositAmount: 0.10,
    decayAmount: 0.10,
    stepSize: 1.0
};
