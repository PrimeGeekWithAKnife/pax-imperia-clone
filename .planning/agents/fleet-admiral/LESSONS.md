# Fleet Admiral — Lessons Learnt

## Fleet Rendering

- Both GalaxyMapScene AND SystemViewScene must render ONE icon per fleet, not individual ships
- Use `HULL_CLASS_RANK` to pick the largest hull class as representative icon
- Show fleet name + ship count, not individual ship names
- Offset multiple fleets in the same system vertically to prevent overlap

## Ship Thumbnails in Phaser

- `renderShipThumbnail()` returns PNG data URL
- For Phaser usage: load via `Image()` then `addImage()` to texture manager
- Cache textures to avoid reloading every frame

## Fleet Movement Event Chain

- FleetPanel emits `fleet:move_mode` → GalaxyMapScene stores `moveModeFleetId`
- On system click, emits `fleet:destination_selected` → FleetPanel shows confirmation
- From SystemView: stash fleet ID on `window.__EX_NIHILO_PENDING_MOVE_MODE__` before scene transition
- Travel time: hops × ticksPerHop (slow_ftl=20, wormhole=10, advanced_wormhole=5)

## Event Cleanup

- Use named arrow-function class properties, not anonymous lambdas
- Every `.on()` needs a matching `.off()` in SHUTDOWN handler
- This applies to ALL Phaser scenes, not just GalaxyMapScene
