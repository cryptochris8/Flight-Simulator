export type Vec3Like = { x: number; y: number; z: number };

export type RunwayConfig = {
  start: Vec3Like;   // one end of the runway centerline
  end: Vec3Like;     // other end of the runway centerline
  width: number;     // total runway width in world units
};

export type HangarSlot = {
  id: string;                // logical hangar id (can map to NFT id/server data)
  position: Vec3Like;        // world-space center/front of hangar door
  yawDegrees: number;        // facing direction
};

export type AirportConfig = {
  name: string;
  elevation: number;         // approximate Y level of airport base
  runway: RunwayConfig;
  spawn: {
    position: Vec3Like;      // where to spawn the plane when entering the airport
    yawDegrees: number;      // initial facing of plane nose
  };
  hangarDistrict: {
    slots: HangarSlot[];     // physical hangar locations in the sky airport
  };
};
