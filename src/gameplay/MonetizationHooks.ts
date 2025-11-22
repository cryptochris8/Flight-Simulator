export type Skin = { id: string; name: string; materialId?: string };
export type Contrail = { id: string; name: string; color?: string };

export class MonetizationHooks {
  applySkin(planeEntityId: string, skin: Skin) {
    // TODO: Swap material/mesh on HYTOPIA entity
  }
  applyContrail(planeEntityId: string, contrail: Contrail) {
    // TODO: Attach particle system to entity using sockets
  }
}
