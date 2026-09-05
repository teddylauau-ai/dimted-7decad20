# Skyward: Remove Laser Hazards

## What we're doing
Skyward's late-game zones (Laser Vault and Storm Crown) spawn blinking laser beams inside gate gaps, which makes runs feel unfairly hard. The user asked to remove the laser entirely.

## Changes
- In `src/components/dimted/CrewFlight.tsx`:
  - Remove the `laser` field from the `Gate` type.
  - Remove `lasers: boolean` from the `Zone` type and set both zones that used it to `false`.
  - Remove the random laser assignment in `makeGate()`.
  - Remove the laser drawing block and the `gate.laser ? 26 : 0` orb-offset adjustments (drawing and pickup).
  - Remove the laser collision check in the hit loop.
  - Update the idle instructions text so it no longer advertises lasers.

## Result
- Zones keep their other identities: Laser Vault still has drifting gates, Storm Crown still has drifting gates + rocks + gusts.
- Difficulty still scales through speed, gap size, gate spacing, rocks, and gusts — just without the blinking laser beams.
