import { TrackConfiguration } from "./types";

export const MONACO_CITY_CIRCUIT: TrackConfiguration = {
  definition: {
    identifier: "monaco-city-circuit",
    displayName: "Amalfi Coast",
    description: "Tight coastal street circuit",
    previewColor: "#1e6beb",
    controlPoints: [
      // Start: bottom center straight
      [350, 0],
      [280, -10],
      // Gentle sweeping curve on the bottom section
      [250, -40],
      [228, -60],
      [205, -48],
      [175, -70],
      [120, -80],
      [75, -68],
      [52, -58],
      [36, -40],
      [30, -15],
      [32, 15],
      [36, 45],
      [40, 80],
      [55, 140],
      [90, 185],
      [140, 210],
      // Chicane (gentle S-curve)
      [175, 222],
      [200, 208],
      [225, 218],
      // Long back straight heading east
      [280, 215],
      [350, 210],
      [420, 205],
      [490, 200],
      // Turn into the right side
      [535, 178],
      [555, 145],
      [558, 105],
      [545, 68],
      [520, 40],
      [490, 22],
      // Long bottom straight heading west
      [420, 10],
    ],
    trackWidth: 18,
    samplePointCount: 600,
  },

  environment: {
    grassIsland: {
      position: [290, -0.05, 70],
      dimensions: [750, 550],
      color: "#3a6b34",
    },
    oceanLayers: [
      {
        position: [290, -0.35, 70],
        dimensions: [4000, 4000],
        color: "#0a3d6b",
        metalness: 0.25,
        roughness: 0.25,
      },
      {
        position: [290, -0.3, 70],
        dimensions: [2000, 2000],
        color: "#1565a8",
        metalness: 0.35,
        roughness: 0.2,
      },
      {
        position: [290, -0.25, 70],
        dimensions: [1200, 1200],
        color: "#4da8da",
        opacity: 0.7,
        metalness: 0.45,
        roughness: 0.12,
      },
    ],
    mountains: [
      // South side — snow-capped rocky mountains (z < -200)
      { position: [-150, 0, -350], height: 100, radius: 90, color: "#8a8a8a" },
      { position: [100, 0, -380], height: 150, radius: 120, color: "#f0f0f0" },
      { position: [300, 0, -350], height: 120, radius: 100, color: "#9a9a9a" },
      { position: [520, 0, -320], height: 140, radius: 110, color: "#e8e8e8" },
      // West side — rocky peaks (x < -100)
      { position: [-200, 0, 50], height: 90, radius: 80, color: "#7a7a7a" },
      { position: [-180, 0, 250], height: 110, radius: 95, color: "#dcdcdc" },
      // North side — snowy summits (z > 350)
      { position: [100, 0, 420], height: 80, radius: 75, color: "#eaeaea" },
      { position: [350, 0, 400], height: 100, radius: 85, color: "#8e8e8e" },
      // East side — snow and rock (x > 700)
      { position: [720, 0, 100], height: 130, radius: 100, color: "#f5f5f5" },
      { position: [700, 0, -150], height: 95, radius: 80, color: "#929292" },
    ],
    sky: {
      sunPosition: [200, 70, -50],
      inclination: 0.48,
      azimuth: 0.25,
      rayleigh: 0.8,
      turbidity: 3,
    },
    lighting: {
      ambientIntensity: 0.7,
      ambientColor: "#ffffff",
      directionalPosition: [200, 70, -50],
      directionalIntensity: 2.5,
      directionalColor: "#fff8e7",
      hemisphereColors: ["#e0f0ff", "#3a7a30", 0.6],
    },
  },

  objectPositions: {
    cameramenPositions: [
      // Left straight (x≈40, outside left side)
      [22, 0, -0.3, 1],
      [22, 55, -0.3, 2],
      // Top-left climb
      [72, 195, Math.PI / 5, 3],
      // Top straight (outside north, z≈230+)
      [280, 232, Math.PI, 4],
      [420, 225, Math.PI, 5],
      // Right hairpin (outside east, x≈575+)
      [575, 160, Math.PI / 2, 6],
      [565, 70, Math.PI / 2, 7],
      // Bottom straight (outside south, z≈-15)
      [420, -10, 0, 8],
      [320, -25, 0, 9],
      // Bottom curves
      [230, -75, -2.5, 10],
      [130, -95, -2.0, 11],
      [30, -65, -1.2, 12],
    ],
    startGrandstand: {
      startX: 350,
      startZ: -55,
      rows: 5,
      seatsPerRow: 18,
      facingRotation: 0,
    },
    adBoardPosition: [330, 0.4, 18],
    grandstandConfigurations: [
      // Outside the top straight (north side, z≈240)
      {
        position: [350, 0, 245],
        rotationY: Math.PI,
        rows: 3,
        seatsPerRow: 16,
      },
      // Outside right hairpin (east side, x≈590)
      {
        position: [590, 0, 120],
        rotationY: -Math.PI / 2,
        rows: 3,
        seatsPerRow: 12,
      },
      // Outside bottom straight (south side, z≈-55)
      {
        position: [450, 0, -55],
        rotationY: 0,
        rows: 3,
        seatsPerRow: 14,
      },
    ],
    standingClusterSeeds: [
      { trackIndex: 30, side: 1, count: 4 },
      { trackIndex: 80, side: -1, count: 5 },
      { trackIndex: 140, side: 1, count: 4 },
      { trackIndex: 200, side: -1, count: 5 },
      { trackIndex: 270, side: 1, count: 4 },
      { trackIndex: 340, side: -1, count: 5 },
      { trackIndex: 400, side: 1, count: 5 },
      { trackIndex: 460, side: -1, count: 4 },
      { trackIndex: 520, side: 1, count: 4 },
      { trackIndex: 570, side: -1, count: 4 },
    ],
    landmarks: [
      {
        // HOTEL DE PARIS — north side, outside top-left curve (z≈260)
        type: "hotel",
        position: [130, 0, 265],
        rotation: 0.2,
        properties: {
          name: "HOTEL DE PARIS",
          color: "#f0e6d2",
          accent: "#9b7b3a",
        },
      },
      {
        // FAIRMONT — east side, outside right hairpin (x≈620)
        type: "hotel",
        position: [620, 0, 60],
        rotation: -Math.PI / 2,
        properties: {
          name: "FAIRMONT",
          color: "#e8dcc8",
          accent: "#6b4a2a",
        },
      },
      {
        // CASINO DE MONTE-CARLO — north-east, near top straight
        type: "hotel",
        position: [500, 0, 275],
        rotation: Math.PI,
        properties: {
          name: "CASINO MONTE-CARLO",
          color: "#f5eed5",
          accent: "#c4a035",
        },
      },
      {
        // Cathedral — west side, outside left edge (x≈-20)
        type: "cathedral",
        position: [-20, 0, 120],
        rotation: 0.6,
      },
      {
        // Prince's Palace — south-west, on the rock
        type: "castle",
        position: [-80, 0, -180],
        rotation: 0.4,
      },
      {
        // Equestrian statue — near casino square
        type: "equestrian-statue",
        position: [420, 0, 270],
        rotation: -0.3,
      },
      {
        // Port Hercule — luxury yachts in harbor
        type: "yacht-cluster",
        position: [0, 0, 0],
        properties: {
          yachts: [
            // West harbor (Port Hercule)
            { position: [-120, -0.15, 300], rotation: 0.3, scale: 2.5 },
            { position: [-80, -0.15, 380], rotation: 0.8, scale: 2.0 },
            { position: [-150, -0.15, 420], rotation: 0.1, scale: 3.0 },
            { position: [-60, -0.15, 460], rotation: 0.5, scale: 1.8 },
            { position: [-130, -0.15, 500], rotation: -0.2, scale: 2.2 },
            // South coast
            { position: [-100, -0.15, -200], rotation: 1.2, scale: 2.0 },
            { position: [-60, -0.15, -280], rotation: 0.5, scale: 2.5 },
            { position: [100, -0.15, -250], rotation: 0.9, scale: 1.8 },
            { position: [250, -0.15, -220], rotation: 1.4, scale: 3.0 },
            // East harbor
            { position: [700, -0.15, 280], rotation: -0.5, scale: 2.8 },
            { position: [740, -0.15, 350], rotation: -0.8, scale: 2.0 },
            { position: [720, -0.15, 420], rotation: -0.3, scale: 2.5 },
            { position: [700, -0.15, -120], rotation: 1.5, scale: 3.0 },
            { position: [680, -0.15, -200], rotation: 1.0, scale: 2.2 },
            { position: [750, -0.15, -50], rotation: 0.7, scale: 1.8 },
          ],
        },
      },
    ],
    billboardStep: 40,
    awsBillboardTrackFractions: [0.15, 0.45, 0.75],
  },
};
