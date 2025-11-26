export type OwnedPlaneClass = "rookie" | "pro" | "legendary";

export type OwnedPlaneStats = {
  maxSpeed?: number;
  handling?: number;
  acceleration?: number;
};

export type OwnedPlane = {
  id: string;                // NFT or internal id
  name: string;              // Display name, e.g. "SkyRacer Mk1"
  class: OwnedPlaneClass;    // Tier for UI / matchmaking
  skinId?: string;           // Which material/skin to apply
  stats?: OwnedPlaneStats;   // Optional stats for HUD/comparison
};
