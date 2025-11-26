/**
 * Network message types for hangar and plane interactions
 */

import type { OwnedPlane } from '../gameplay/OwnedPlaneTypes';

// Message type constants
export const MessageType = {
  // Client -> Server
  HANGAR_OPEN_REQUESTED: 'HANGAR_OPEN_REQUESTED',
  PLANE_SELECTION_CONFIRMED: 'PLANE_SELECTION_CONFIRMED',

  // Server -> Client
  HANGAR_CONTENTS: 'HANGAR_CONTENTS',
  PLANE_SPAWNED: 'PLANE_SPAWNED',
  HANGAR_ERROR: 'HANGAR_ERROR',
} as const;

// Client -> Server: Request to open a hangar
export interface HangarOpenRequestedMessage {
  type: typeof MessageType.HANGAR_OPEN_REQUESTED;
  hangarId: string;
}

// Client -> Server: Confirm plane selection for spawn
export interface PlaneSelectionConfirmedMessage {
  type: typeof MessageType.PLANE_SELECTION_CONFIRMED;
  hangarId: string;
  planeId: string;
}

// Server -> Client: Send hangar contents (list of owned planes)
export interface HangarContentsMessage {
  type: typeof MessageType.HANGAR_CONTENTS;
  hangarId: string;
  planes: OwnedPlane[];
}

// Server -> Client: Confirm plane has been spawned
export interface PlaneSpawnedMessage {
  type: typeof MessageType.PLANE_SPAWNED;
  planeId: string;
  hangarId: string;
}

// Server -> Client: Error response
export interface HangarErrorMessage {
  type: typeof MessageType.HANGAR_ERROR;
  error: string;
}

// Union type of all messages
export type HangarNetworkMessage =
  | HangarOpenRequestedMessage
  | PlaneSelectionConfirmedMessage
  | HangarContentsMessage
  | PlaneSpawnedMessage
  | HangarErrorMessage;
