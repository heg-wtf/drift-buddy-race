import { TrackConfiguration, TrackIdentifier } from "./types";
import { ISTANBUL_PARK } from "./istanbul-park";
import { MONACO_CITY_CIRCUIT } from "./monaco-city-circuit";
import { TOKYO_CITY_CIRCUIT } from "./silverstone-countryside-circuit";

const TRACK_MAP = new Map<TrackIdentifier, TrackConfiguration>([
  [ISTANBUL_PARK.definition.identifier, ISTANBUL_PARK],
  [MONACO_CITY_CIRCUIT.definition.identifier, MONACO_CITY_CIRCUIT],
  [TOKYO_CITY_CIRCUIT.definition.identifier, TOKYO_CITY_CIRCUIT],
]);

export const getTrackConfiguration = (
  identifier: TrackIdentifier,
): TrackConfiguration => {
  const track = TRACK_MAP.get(identifier);
  if (!track) {
    throw new Error(`Track "${identifier}" not found in registry`);
  }
  return track;
};

export const listTrackConfigurations = (): TrackConfiguration[] => {
  return Array.from(TRACK_MAP.values());
};

export const DEFAULT_TRACK_IDENTIFIER: TrackIdentifier =
  ISTANBUL_PARK.definition.identifier;
