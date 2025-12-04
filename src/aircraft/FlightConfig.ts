/**
 * Flight Physics Configuration
 *
 * FLIGHT_MODE controls which physics model is used:
 * - "arcade"  : Simple, responsive controls. No ground physics. Best for casual play.
 * - "hybrid"  : Semi-realistic with lift/drag/thrust but simplified controls.
 * - "realistic": Full ground taxi + takeoff, lift physics, stall mechanics.
 */

export type FlightMode = "arcade" | "hybrid" | "realistic";

/**
 * Current flight mode - change this to switch physics models
 */
export const FLIGHT_MODE: FlightMode = "arcade";
