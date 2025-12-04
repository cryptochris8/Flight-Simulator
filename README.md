# Hytopia Flight Variants Add-on

This add-on gives you **two alternate flight models** you can plug into your
existing airplane game:

- `src/aircraft/ArcadeFlightPhysics.ts`
  - Very forgiving, arcade-style controls:
    - Auto-levels roll
    - Simple speed model
    - Mild gravity
    - Great for casual players and tight ring circuits

- `src/aircraft/HybridFlightPhysics.ts`
  - A slightly more realistic, hybrid model:
    - Mass, thrust, drag, lift, gravity
    - Simple stall behavior at low speed
    - Still arcade-friendly but with more "airplane" feel

## How Claude can use these

Right now your project likely uses a `FlightPhysics` class in `src/aircraft/FlightPhysics.ts`.

Claude can:

1. Swap imports in your `AirplaneEntityAdapter`:
   - From:
     ```ts
     import { FlightPhysics } from "./FlightPhysics";
     ```
   - To one of:
     ```ts
     import { ArcadeFlightPhysics } from "./ArcadeFlightPhysics";
     // or
     import { HybridFlightPhysics } from "./HybridFlightPhysics";
     ```

2. Update the adapter field accordingly:
   ```ts
   // For arcade:
   physics = new ArcadeFlightPhysics();

   // For hybrid:
   physics = new HybridFlightPhysics();
   ```

3. Optionally expose a "difficulty" or "flightMode" toggle in your settings UI that
   chooses which class to instantiate for each player.

This add-on is intentionally standalone: it doesn't change your existing files,
it just provides **drop-in alternatives** so you and Claude can pick the feel
that best fits your Hytopia airplane time-trial game.
