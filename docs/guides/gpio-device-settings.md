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

### PIR Motion Sensor

Many PIR modules provide a digital output that goes high when motion is detected, but modules vary. Confirm the output voltage is 3.3V-safe before connecting to the Pi.

| Field         | Suggested value    |
| ------------- | ------------------ |
| Device type   | GPIO Input         |
| Pull resistor | `off`              |
| Edge          | `rising` or `both` |
| Debounce      | `100-500 ms`       |
| Active state  | `high`             |

Use `rising` if you only care when motion starts. Use `both` if you need motion start and end events.

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
