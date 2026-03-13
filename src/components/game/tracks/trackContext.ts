import { createContext, useContext } from "react";
import * as THREE from "three";
import { TrackConfiguration } from "./types";

export interface TrackContextValue {
  configuration: TrackConfiguration;
  trackPath: THREE.CatmullRomCurve3;
  trackBounds: {
    innerPoints: THREE.Vector3[];
    outerPoints: THREE.Vector3[];
    centerPoints: THREE.Vector3[];
  };
}

export const TrackContext = createContext<TrackContextValue | null>(null);

export const useTrackContext = (): TrackContextValue => {
  const context = useContext(TrackContext);
  if (!context) {
    throw new Error("useTrackContext must be used within a TrackProvider");
  }
  return context;
};
