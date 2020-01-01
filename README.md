# homebridge-screenlogic

Screen Logic plug-in for [Homebridge](https://github.com/nfarina/homebridge) using the [node-screenlogic](https://github.com/parnic/node-screenlogic) library.

**Note:** this plugin is in very early developement and not ready for prime time yet.

# Installation

<!-- 2. Clone (or pull) this repository from github into the same path Homebridge lives (usually `/usr/local/lib/node_modules`). Note: the code currently on GitHub is in beta, and is newer than the latest published version of this package on `npm` -->

1. Install homebridge using: `npm install -g homebridge`
2. Install this plug-in using: `npm install -g homebridge-screenlogic`
3. Update your configuration file. See example `config.json` snippet below.

# Configuration

Configuration samples (edit `~/.homebridge/config.json`):

### UDP Broadcast

This performs a UDP broadcast on 255.255.255.255, port 1444, so ensure your network supports UDP broadcasts and the device is on the same subnet.

```
"platforms": [
        {
            "platform": "ScreenLogic"
        }
    ],
```

### Direct connection via IP Address

Use this when you know the local static IP address.

```
"platforms": [
        {
            "platform": "ScreenLogic",
            "ip_address": "192.168.0.100"
        }
    ],
```

- `"port"` is optional and defaults to 80
- `"username"` is optional, but is recommended as it is used to keep accessory UUIDs consistent. Should be in the format `"Pentair: XX-XX-XX"`.

### Remote connection via gateway

Use this to go through Pentair servers.

```
"platforms": [
        {
            "platform": "ScreenLogic",
            "username": "Pentair: XX-XX-XX",
            "password": "..."
        }
    ],
```

## Optional fields:

- `"hidden_circuits"` comma-separated list of circuit names to hide. Set this for circuits you don't want showing up as switches. (ie.., `"Aux 6,Floor Cleaner"`).

# Implemented HomeKit Accessory Types

## Air Temperature

- _TemperatureSensor_ accessory (Air) indicating the ambient temperature where thee screenlogic hardware is located

## Pool

- _TemperatureSensor_ accessory (Pool) indicating the ambient temperature of the pool (last known temperature if pool isn't running)

## Spa

- _TemperatureSensor_ accessory (Spa) indicating the ambient temperature of the Spa (last known temperature if pool isn't running)

## Circuits

- creates a _Switch_ accessory for each discovered circuit (i.e., Pool, Spa, Jets, Pool Light, Spa Light, etc)

# Planned HomeKit Accessory Types

## Pool

- _Thermostat_ accessory with ambient temperature, mode control (heat/cool/auto/off), and target temperature control

## Spa

- _Thermostat_ accessory with ambient temperature, mode control (heat/cool/auto/off), and target temperature control
