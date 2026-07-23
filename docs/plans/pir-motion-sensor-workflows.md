# PIR Motion Sensor Workflow Plan

**Status:** In progress  
**Created:** 2026-07-23  
**Goal:** Support a tested HC-SR501 PIR motion sensor as a beginner-friendly GPIO input device and workflow trigger.

## Summary

The HC-SR501 PIR motion sensor should fit into the existing Devices and Automation model as a GPIO input source. The app already supports generic GPIO input events, so the implementation should stay small: add PIR-specific guidance, presets, labels, and workflow templates around the current GPIO input and block executor behavior.

The initial physical test used a Raspberry Pi with the PIR `OUT` pin connected to `GPIO23` / physical pin `16`. The sensor successfully produced `Motion detected` and `No motion` events through `gpiozero.MotionSensor(23)`.

## Verified Hardware Notes

Tested module: HC-SR501-style PIR motion sensor.

Observed 3-pin header pinout for this module, with components facing up and the 3-pin header at the top/front as in the referenced pinout diagram:

```txt
left   = OUT
middle = GND
right  = VCC
```

Verified wiring:

```txt
PIR OUT -> Raspberry Pi GPIO23 / physical pin 16
PIR GND -> Raspberry Pi GND / physical pin 6
PIR VCC -> Raspberry Pi 5V / physical pin 2 or 4
```

Safety notes to document for operators:

- Power off the Pi before moving wires.
- HC-SR501 modules commonly accept `5V` on `VCC`, but Pi GPIO inputs are `3.3V` only.
- Verify `OUT` is not above `3.3V` before connecting to GPIO when using an unknown clone.
- Some modules have different pin orders; do not rely on unlabeled pins without checking the board, a known pinout diagram, or a multimeter.
- Let the PIR warm up for `60-90` seconds after power-on before judging readings.
- The sensor delay potentiometer can hold `OUT` high for seconds or minutes after motion.

## Target User Experience

The Devices page should offer PIR as a recognizable input option without exposing the user to low-level GPIO concepts first.

```txt
Add input source

[HTTP JSON API] [Webhook] [MQTT] [GPIO Input] [PIR Motion Sensor]
```

Selecting `PIR Motion Sensor` should create a GPIO input source with a PIR-specific profile and safe defaults.

Suggested form fields:

```txt
Name: Front door motion
GPIO pin: 23
Active state: High
Edge: Both / Rising
Debounce: 500 ms
Warmup note: Sensor may take 60-90 seconds after power-on before stable readings.
```

The configured-device table should still treat the device as an input source:

```txt
Name | Direction | Type | Pin | Health | Last event | Actions
Front door motion | Input source | PIR Motion Sensor | GPIO23 | Watching | Motion detected 12s ago | Test / Edit
```

## Device Model

Prefer extending the existing `gpio-input` type with a profile field instead of creating a separate runtime system.

Suggested config shape:

```ts
type GpioInputProfile = "generic" | "pir-motion";

type PirMotionConfig = {
  profile: "pir-motion";
  pin: number;
  activeState: "high";
  edge: "rising" | "both";
  pull: "none" | "down";
  debounceMs: number;
};
```

Initial defaults:

```txt
profile: pir-motion
activeState: high
edge: both
pull: none
debounceMs: 500
```

Use `edge: both` if the UI should expose both `motion_detected` and `motion_cleared` events. Use `edge: rising` if the first implementation only needs to trigger workflows when motion starts.

## Workflow Behavior

PIR events should use the existing GPIO event path:

```txt
GPIO watcher receives edge event
  -> builds trigger context
  -> finds enabled workflows whose first block is gpio_event_start for this source
  -> executes matching workflows
```

Suggested trigger payload:

```json
{
  "source": "gpio",
  "profile": "pir-motion",
  "pin": 23,
  "edge": "rising",
  "state": "high",
  "active": true,
  "event": "motion_detected"
}
```

For falling edges:

```json
{
  "source": "gpio",
  "profile": "pir-motion",
  "pin": 23,
  "edge": "falling",
  "state": "low",
  "active": false,
  "event": "motion_cleared"
}
```

Recommended first workflow templates:

```txt
Motion detected -> Record trigger event
Motion detected -> Capture Pi Camera -> Stamp with Integritas
Motion detected -> Fetch HTTP source -> Stamp with Integritas
Motion detected -> Pulse GPIO output
```

## Backend Plan

1. Inspect the current `gpio-input` config parser, watcher, and workflow trigger payload.
2. Add a `pir-motion` GPIO input profile if the current schema supports profile-specific config cleanly.
3. Add profile-aware labels/serialization so the UI can show `PIR Motion Sensor` instead of only `GPIO Input`.
4. Ensure pin validation and pin-conflict checks already used by generic GPIO input apply to PIR devices.
5. Ensure watcher behavior supports the chosen edge mode and emits enough payload detail for `motion_detected` and optionally `motion_cleared`.
6. Add or adjust backend tests for PIR config validation and GPIO trigger payload mapping.

Keep the runtime implementation on the existing GPIO watcher path unless code inspection shows a real need for a separate PIR reader.

## Frontend Plan

1. Add a `PIR Motion Sensor` card under `Add input source`.
2. Reuse the GPIO input creation/edit form where possible, but prefill PIR defaults.
3. Add PIR-specific help text for wiring, warmup, active-high behavior, and delay knob behavior.
4. Show configured PIR devices with a motion-specific type label and last-event text.
5. Add workflow template entry points for common motion workflows after the basic PIR device creation path works.

## Documentation Plan

Add operator documentation for:

- HC-SR501 wiring through a breadboard.
- Pin numbering: BCM `GPIO23` is physical pin `16`.
- Known tested pinout for this module and warning that clones vary.
- Standalone test script using `gpiozero.MotionSensor(23)`.
- Troubleshooting `always HIGH`, `always LOW`, warmup, and swapped `OUT`/`VCC` wires.
- PIR workflow examples.

Likely docs to update during implementation:

- `README.md` for device/workflow usage if PIR becomes a first-class option.
- `docs/guides/gpio-device-settings.md` for tested PIR wiring and defaults.
- `docs/README.md` if a new hardware guide is added.
- `SECURITY.md` or `docs/security/data-sources-and-automation.md` only if the implementation changes GPIO exposure or camera-trigger privacy guidance.
- `CHANGELOG.md` under `[Unreleased]` for the user-facing PIR device option.

## Verification Plan

Standalone hardware verification:

```bash
python3 pir_test.py
```

Expected output after warmup and motion:

```txt
PIR test started on GPIO23.
Waiting for motion...
Motion detected
No motion
```

Implementation verification:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Manual Pi checks:

- Add PIR Motion Sensor on `GPIO23`.
- Confirm the device starts watching only when an enabled workflow depends on it, unless the existing app intentionally watches during test mode.
- Test the device from the UI and confirm motion changes are visible.
- Create `Motion detected -> Record trigger event` and verify a read/run is recorded.
- Create `Motion detected -> Capture Pi Camera -> Stamp with Integritas` if camera hardware is available.
- Disable the workflow and confirm the GPIO watcher is released.
- Reboot the Pi and confirm the workflow resumes after sensor warmup.

## Open Decisions

- Should the first implementation trigger only on `motion_detected`, or should it also expose `motion_cleared`?
- Should PIR be stored as `gpio-input` with `profile: "pir-motion"`, or should the existing schema use another profile mechanism already present in the code?
- Should the UI default to `GPIO23` because it was tested, or leave the pin empty to force an explicit operator choice?
- Should workflow templates be part of the first implementation, or follow after the device profile is merged?

## Implementation Milestones

### Milestone 1: Documentation And Hardware Guide

- [x] Add HC-SR501 wiring and troubleshooting guide.
- [x] Record tested `GPIO23` / physical pin `16` setup.
- [x] Add recommended PIR GPIO defaults.

### Milestone 2: PIR Device Profile

- [x] Add PIR input-source card and defaults.
- [x] Add backend profile validation if needed.
- [ ] Preserve generic GPIO input behavior.
- [x] Add profile-aware labels and status text.

### Milestone 3: Workflow Integration

- [ ] Verify PIR events through existing `gpio_event_start` workflows.
- [x] Add event payload labels for `motion_detected` and optionally `motion_cleared`.
- [ ] Add beginner workflow templates for motion-triggered recording, camera capture, and stamping.

### Milestone 4: Pi Hardware Verification

- [ ] Add PIR device on the Pi through the UI.
- [ ] Verify motion-triggered workflow run.
- [ ] Verify motion-triggered camera capture and Integritas stamp if camera/API are configured.
- [ ] Document any changed defaults discovered during real hardware testing.
