import { TrackConfiguration } from "./types";

export const TOKYO_CITY_CIRCUIT: TrackConfiguration = {
  definition: {
    identifier: "tokyo-city-circuit",
    displayName: "Tokyo City Circuit",
    description: "Neon-lit streets through the heart of Tokyo",
    previewColor: "#e74c8b",
    barrierStyle: {
      color: "#888888",
      height: 1.0,
    },
    controlPoints: [
      // === STRAIGHT 1: Start/finish (bottom center, heading right) ===
      [300, -100],
      [345, -100],
      [390, -97],
      [432, -90],

      // === TURNS 1-2: Bottom-right corner (tight, going up) ===
      [462, -75],
      [482, -52],
      [490, -24],

      // === TURN 3: Right side kink ===
      [493, 10],
      [490, 42],
      [480, 70],

      // === TURN 4: Top-right corner heading left ===
      [462, 94],
      [436, 110],
      [405, 120],

      // === STRAIGHT 2: Top section heading left ===
      [365, 125],
      [320, 127],
      [270, 127],
      [225, 124],

      // === TURNS 5-6: Rising to top-left peak ===
      [185, 128],
      [148, 142],
      [120, 162],
      [108, 186],

      // === TURN 7: Top-left apex, curving down ===
      [88, 184],
      [74, 168],

      // === TURNS 8-9: Left S-curves going down ===
      [66, 145],
      [70, 120],
      [82, 98],
      [76, 74],
      [68, 50],
      [76, 26],

      // === STRAIGHT 3 + TURNS 10: Bottom-left returning right ===
      [90, 2],
      [112, -22],
      [142, -45],
      [180, -64],
      [225, -80],
      [268, -94],
    ],
    trackWidth: 20,
    samplePointCount: 800,
  },

  environment: {
    grassIsland: {
      position: [280, -0.05, 40],
      dimensions: [600, 450],
      color: "#2a3040",
    },
    oceanLayers: [
      {
        position: [280, -0.35, 0],
        dimensions: [4000, 4000],
        color: "#1a2030",
        metalness: 0.3,
        roughness: 0.7,
      },
      {
        position: [280, -0.3, 0],
        dimensions: [2000, 2000],
        color: "#202838",
        metalness: 0.25,
        roughness: 0.75,
      },
      {
        position: [280, -0.25, 0],
        dimensions: [1200, 1200],
        color: "#283040",
        opacity: 0.6,
        metalness: 0.2,
        roughness: 0.8,
      },
    ],
    mountains: [
      { position: [-150, 0, -300], height: 45, radius: 100, color: "#283048" },
      { position: [100, 0, -400], height: 160, radius: 200, color: "#242c42" },
      { position: [450, 0, -320], height: 50, radius: 110, color: "#283048" },
      { position: [650, 0, -250], height: 40, radius: 90, color: "#242c42" },
      { position: [-100, 0, 350], height: 35, radius: 80, color: "#283048" },
      { position: [250, 0, 380], height: 45, radius: 100, color: "#242c42" },
      { position: [550, 0, 300], height: 40, radius: 95, color: "#283048" },
    ],
    sky: {
      sunPosition: [300, 3, -200],
      inclination: 0.06,
      azimuth: 0.25,
      rayleigh: 0.3,
      turbidity: 15,
    },
    lighting: {
      ambientIntensity: 0.45,
      ambientColor: "#8090b8",
      directionalPosition: [300, 20, -180],
      directionalIntensity: 0.7,
      directionalColor: "#aabbdd",
      hemisphereColors: ["#6878a0", "#2a2a40", 0.5],
    },
  },

  objectPositions: {
    cameramenPositions: [
      [365, -98, -0.3, 1],
      [440, -85, 0.5, 2],
      [490, -10, 1.2, 3],
      [488, 50, 1.5, 4],
      [450, 100, Math.PI / 3, 5],
      [380, 124, Math.PI / 2, 6],
      [280, 150, Math.PI / 2, 7],
      [170, 138, Math.PI * 0.6, 8],
      [112, 178, Math.PI * 0.8, 9],
      [72, 155, -Math.PI * 0.8, 10],
      [74, 85, -Math.PI * 0.6, 11],
      [70, 38, -Math.PI * 0.4, 12],
      [105, -15, -0.3, 13],
      [155, -58, -0.2, 14],
      [250, -110, -0.1, 15],
    ],
    startGrandstand: {
      startX: 290,
      startZ: -130,
      rows: 5,
      seatsPerRow: 18,
      grandstandRotation: Math.PI / 2,
      facingRotation: -Math.PI / 2,
    },
    adBoardPosition: [310, 0.4, -120],
    grandstandConfigurations: [
      {
        position: [340, 0, 150],
        rotationY: Math.PI,
        rows: 4,
        seatsPerRow: 16,
      },
      {
        position: [515, 0, 10],
        rotationY: -Math.PI / 2,
        rows: 4,
        seatsPerRow: 14,
      },
      {
        position: [200, 0, -120],
        rotationY: Math.PI * 0.3,
        rows: 3,
        seatsPerRow: 12,
      },
      {
        position: [40, 0, 100],
        rotationY: Math.PI * 0.7,
        rows: 3,
        seatsPerRow: 10,
      },
    ],
    standingClusterSeeds: [
      { trackIndex: 50, side: 1, count: 6 },
      { trackIndex: 120, side: -1, count: 5 },
      { trackIndex: 190, side: 1, count: 7 },
      { trackIndex: 260, side: -1, count: 6 },
      { trackIndex: 330, side: 1, count: 5 },
      { trackIndex: 400, side: -1, count: 7 },
      { trackIndex: 470, side: 1, count: 5 },
      { trackIndex: 540, side: -1, count: 6 },
      { trackIndex: 610, side: 1, count: 5 },
      { trackIndex: 680, side: -1, count: 7 },
      { trackIndex: 740, side: 1, count: 5 },
      { trackIndex: 790, side: -1, count: 4 },
    ],
    landmarks: [
      {
        type: "tokyo-tower",
        position: [280, 0, 55],
        rotation: 0,
      },
      {
        type: "pagoda",
        position: [160, 0, 210],
        rotation: -0.4,
        properties: {
          name: "渋谷神宮",
          tiers: 3,
          color: "#2a1a0a",
          accent: "#c8a050",
        },
      },
      {
        type: "pagoda",
        position: [520, 0, -80],
        rotation: 0.6,
        properties: {
          name: "秋葉原殿",
          tiers: 4,
          color: "#1a2a3a",
          accent: "#d4a860",
        },
      },
    ],
    billboardStep: 45,
    awsBillboardTrackFractions: [0.12, 0.42, 0.72],
  },
};
