# GPIO Device Settings

This guide lists Raspberry Pi GPIO device settings for Integritas Pi Devices. It uses BCM pin numbering, matching the app UI and `gpiomon`/`gpioset` commands.

GPIO is 3.3V only. Do not connect GPIO pins directly to 5V, motors, relays, mains voltage, or unknown modules. For output LEDs, always use a resistor in series.

## Tested

These setups have been tested on the Raspberry Pi prototype.

### Input Button On GPIO17

Use this for a simple push button wired between GPIO17 and GND.

Wiring:

```txt
GPIO17 physical pin 11 -> button -> GND physical pin 9
```

Device settings:

| Field         | Value       |
| ------------- | ----------- |
| Device type   | GPIO Input  |
| Chip          | `gpiochip0` |
| BCM pin       | `17`        |
| Pull resistor | `up`        |
| Edge          | `falling`   |
| Debounce      | `100 ms`    |
| Active state  | `low`       |

Expected behavior:

```txt
Button released: GPIO17 is high because the internal pull-up is active.
Button pressed: GPIO17 connects to GND and becomes low.
```

Useful test command inside the backend container:

```bash
gpiomon --falling-edge --num-events=0 --bias=pull-up gpiochip0 17
```

If you want to see both press and release events while debugging, use `Edge: both` in the app or run separate `gpiomon` edge tests depending on the installed libgpiod version.

Visual wiring reference: [`gpio-button-wiring.svg`](./gpio-button-wiring.svg).

### Output LED On GPIO18

Use this for a simple LED pulse output wired from GPIO18 through a resistor to the LED.

Wiring:

```txt
GPIO18 physical pin 12 -> 220-330 ohm resistor -> LED anode
LED cathode -> GND
```

Device settings:

| Field         | Value       |
| ------------- | ----------- |
| Device type   | GPIO Output |
| Chip          | `gpiochip0` |
| BCM pin       | `18`        |
| Profile       | `LED`       |
| Active state  | `high`      |
| Initial state | `inactive`  |

Workflow block settings:

| Field      | Value             |
| ---------- | ----------------- |
| Block type | Control output    |
| Action     | `pulse`           |
| Duration   | `500 ms` to start |

Expected behavior:

```txt
Pulse starts: GPIO18 goes high and LED turns on.
Pulse ends: GPIO18 returns inactive and LED turns off.
```

Use the Devices page `Test pulse` action before adding the LED to an automation workflow.

If the LED turns on after a pulse and stays on, check the output target's active-state setting. The wiring above must use `Active state: high`. `Active state: low` is only for wiring where the LED/resistor is tied to 3.3V and the GPIO pin turns the LED on by sinking current.

### HC-SR501 PIR Motion Sensor On GPIO23

Use this for the tested HC-SR501-style PIR motion sensor module. The tested module's 3-pin header was unlabeled, so the pinout was confirmed from a matching pinout diagram and by running a GPIO test.

With the module components facing up and the 3-pin header in front/top as in the matching pinout diagram:

```txt
left   = OUT
middle = GND
right  = VCC
```

Wiring:

```txt
PIR OUT -> GPIO23 physical pin 16
PIR GND -> GND physical pin 6
PIR VCC -> 5V physical pin 2 or 4
```

Device settings:

| Field         | Value               |
| ------------- | ------------------- |
| Device type   | PIR Motion Sensor   |
| Chip          | `gpiochip0`         |
| BCM pin       | `23`                |
| Pull resistor | `off`               |
| Edge          | `both`              |
| Debounce      | `500 ms`            |
| Active state  | `high`              |

Expected behavior:

```txt
No motion: GPIO23 is low.
Motion detected: GPIO23 goes high.
Motion cleared: GPIO23 returns low after the sensor delay expires.
```

Standalone Python test used before app integration:

```python
from gpiozero import MotionSensor
from signal import pause

pir = MotionSensor(23)

print("PIR test started on GPIO23.")
print("Waiting for motion...")

pir.when_motion = lambda: print("Motion detected")
pir.when_no_motion = lambda: print("No motion")

pause()
```

Troubleshooting:

- Power off the Pi before changing wires.
- GPIO23 means BCM `23`, physical pin `16`; it is not physical pin `23`.
- Let the PIR warm up for `60-90` seconds after power-on.
- If readings are always `HIGH`, check whether `OUT` and `VCC` are swapped or whether the sensor delay knob is holding the output high.
- If readings are always `LOW`, check power, ground, breadboard rows, and the sensor pin order.
- Pi GPIO inputs are `3.3V` only. Verify an unknown PIR clone's `OUT` voltage before connecting it to GPIO.

## Untested

These settings are suggested starting points only. Verify the module's voltage, output type, and wiring before connecting it to the Pi.

### Button Wired To 3.3V

Use this only when the button connects GPIO to 3.3V when pressed.

| Field         | Suggested value |
| ------------- | --------------- |
| Device type   | GPIO Input      |
| Pull resistor | `down`          |
| Edge          | `rising`        |
| Debounce      | `100 ms`        |
| Active state  | `high`          |

Expected behavior:

```txt
Button released: GPIO is low because the internal pull-down is active.
Button pressed: GPIO connects to 3.3V and becomes high.
```

### Reed Switch Or Dry Contact To GND

Use this for a magnetic reed switch or other dry contact that closes to GND.

| Field         | Suggested value     |
| ------------- | ------------------- |
| Device type   | GPIO Input          |
| Pull resistor | `up`                |
| Edge          | `falling` or `both` |
| Debounce      | `100-250 ms`        |
| Active state  | `low`               |

Use `falling` if you only care about the contact closing. Use `both` if you need open and close events.

### Open-Collector Or Open-Drain Sensor

Some industrial-style or sensor outputs pull the signal low but do not drive it high. Confirm the output is isolated and 3.3V-safe.

| Field         | Suggested value     |
| ------------- | ------------------- |
| Device type   | GPIO Input          |
| Pull resistor | `up`                |
| Edge          | `falling` or `both` |
| Debounce      | Device-specific     |
| Active state  | Usually `low`       |

### Relay, Motor, Solenoid, Or High-Current Buzzer

Do not connect these directly to a GPIO pin.

Current V1 GPIO Output support is only intended for a low-current LED profile with a pulse action. Use a proper transistor/MOSFET/driver board, flyback protection where needed, and external power before considering these devices. They are not supported as direct GPIO Output targets in this prototype.

### Active-Low LED Module

Some LED modules turn on when the GPIO is driven low. Confirm the module is 3.3V-safe.

| Field         | Suggested value |
| ------------- | --------------- |
| Device type   | GPIO Output     |
| Profile       | `LED`           |
| Active state  | `low`           |
| Initial state | `inactive`      |
| Action        | `pulse`         |

Prefer the tested direct LED wiring first. Use active-low only when the module documentation clearly says the input is active-low and safe for Raspberry Pi GPIO.
