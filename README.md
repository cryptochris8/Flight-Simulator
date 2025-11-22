# Hytopia Airplane Starter (vibe‑jet inspired)

Portable flight math + wiring to build an arcade‑style airplane game in **Hytopia**.

## Quick start

```bash
npm install
npm run build
npm run dev
```

In your **Hytopia project**, copy the `src/aircraft`, `src/gameplay`, and `src/engine` folders (plus `src/util`) and wire `AirplaneEntityAdapter` to your actual Hytopia SDK calls:

- Spawn the GLTF/voxel model for the plane.
- Update its transform each tick based on physics state.
- Apply the camera position/target each frame.
- Route input events into `AirplaneController`.

This repo is meant as a **starter kit** for Claude Code / HYTOPIA integration, not a full game by itself.