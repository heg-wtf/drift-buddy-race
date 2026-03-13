import { TrackConfiguration, TrackIdentifier } from "./types";
import { ISTANBUL_PARK } from "./istanbul-park";

const TRACK_MAP = new Map<TrackIdentifier, TrackConfiguration>([
  [ISTANBUL_PARK.definition.identifier, ISTANBUL_PARK],
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
