export type TrackIdentifier = string;

export interface TrackDefinition {
  identifier: TrackIdentifier;
  displayName: string;
  description: string;
  previewColor: string;
  controlPoints: [number, number][];
  trackWidth: number;
  samplePointCount: number;
}

export interface MountainData {
  position: [number, number, number];
  height: number;
  radius: number;
  color: string;
}

export interface OceanLayerData {
  position: [number, number, number];
  dimensions: [number, number];
  color: string;
  opacity?: number;
  metalness?: number;
  roughness?: number;
}

export interface TrackEnvironment {
  grassIsland: {
    position: [number, number, number];
    dimensions: [number, number];
    color: string;
  };
  oceanLayers: OceanLayerData[];
  mountains: MountainData[];
  sky: {
    sunPosition: [number, number, number];
    inclination: number;
    azimuth: number;
    rayleigh: number;
    turbidity: number;
  };
  lighting: {
    ambientIntensity: number;
    ambientColor: string;
    directionalPosition: [number, number, number];
    directionalIntensity: number;
    directionalColor: string;
    hemisphereColors: [string, string, number];
  };
}

export interface LandmarkData {
  type:
    | "hotel"
    | "cathedral"
    | "castle"
    | "equestrian-statue"
    | "yacht-cluster";
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  properties?: Record<string, unknown>;
}

export interface GrandstandConfiguration {
  position: [number, number, number];
  rotationY: number;
  rows: number;
  seatsPerRow: number;
}

export interface StandingClusterSeed {
  trackIndex: number;
  side: 1 | -1;
  count: number;
}

export interface TrackObjectPositions {
  cameramenPositions: [number, number, number, number][];
  startGrandstand: {
    startX: number;
    startZ: number;
    rows: number;
    seatsPerRow: number;
    facingRotation: number;
  };
  adBoardPosition: [number, number, number];
  grandstandConfigurations: GrandstandConfiguration[];
  standingClusterSeeds: StandingClusterSeed[];
  landmarks: LandmarkData[];
  billboardStep: number;
  awsBillboardTrackFractions: number[];
}

export interface TrackConfiguration {
  definition: TrackDefinition;
  environment: TrackEnvironment;
  objectPositions: TrackObjectPositions;
}
