# homebridge-screenlogic

[![NPM version](https://img.shields.io/npm/v/homebridge-screenlogic)](https://npmjs.org/package/homebridge-screenlogic)
![License](https://img.shields.io/npm/l/homebridge-screenlogic)
[![Downloads](https://img.shields.io/npm/dm/homebridge-screenlogic.svg)](https://npmjs.org/package/homebridge-screenlogic)

## Screen Logic plug-in for [Homebridge](https://github.com/nfarina/homebridge) using the [node-screenlogic](https://github.com/parnic/node-screenlogic) library.

<img src="https://i.imgur.com/jFh0EDD.png" width="300"> <img src="https://i.imgur.com/p1RKGVV.png" width="300">


## Installation

<!-- 2. Clone (or pull) this repository from github into the same path Homebridge lives (usually `/usr/local/lib/node_modules`). Note: the code currently on GitHub is in beta, and is newer than the latest published version of this package on `npm` -->

1. Install homebridge using: `npm install -g homebridge`
2. Install this plug-in using: `npm install -g homebridge-screenlogic`
3. Update your configuration file. See example `config.json` snippet below.

## Configuration

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

- `"hidePoolTemperatureSensor"` hides the pool temperature sensor, which is redundant if you are showing pool thermostat. Default is `false`.

- `"hideSpaTemperatureSensor"` hides the spa temperature sensor, which is redundant if you are showing spa thermostat. Default is `false`.

- `"hidePoolThermostat"` hides the pool thermostat (aka, pool heater) if you don't want to allow changes via HomeKit. Default is `false`.

- `"hideSpaThermostat"` hides the spa thermostat (aka, spa heater) if you don't want to allow changes via HomeKit. Default is `false`.

- `"statusPollingSeconds"` time in seconds to poll for pool statu. Default is 60 seconds.

# Implemented HomeKit Accessory Types

## Air Temperature

- _TemperatureSensor_ accessory (Air) indicating the ambient temperature where thee screenlogic hardware is located

## Pool

- _TemperatureSensor_ accessory (Pool) indicating the ambient temperature of the pool (last known temperature if pool isn't running)

## Spa

- _TemperatureSensor_ accessory (Spa) indicating the ambient temperature of the Spa (last known temperature if pool isn't running)

## Circuits

- creates a _Switch_ accessory for each discovered circuit (i.e., Pool, Spa, Jets, Pool Light, Spa Light, etc)

## Pool Heater

- _Thermostat_ accessory with ambient temperature, mode control (heat/cool/auto/off), and target temperature control

## Spa Heater

- _Thermostat_ accessory with ambient temperature, mode control (heat/cool/auto/off), and target temperature control

# Note on Pool/Spa Heater

The Pool and Spa Heater accessories are exposed as Thermostats in HomeKit. Since the semantics are slightly different between Pentair heat mode and a thermostat target heating state, a mapping is required.

## Mapping

I picked the following mapping, which seemed like the most logical mapping:

| Pentair Heat Mode | Thermostat State |
| ----------------- | ---------------- |
| Off               | Off              |
| Heater            | Heat             |
| Solar Preferred   | Auto             |
| Solar             | Cool             |

The only strange one is mapping `Solar` to `Cool`. I decided to go that route given the first three were fairly obvious (to me at least).

An alternative would be to expose three distinct on/off switches that represent each mode, and then ignore state changes (and maybe just allowing Off/Heat).

## "On" State

The other compromise is that the pool and spa heaters do _not_ turn the pool and/or spa on or off, they just change the heat mode.

i.e., if you want to heat the spa, you need to do two things:

1. turn on the Spa (via the Spa Switch)
2. make sure the Spa Heater is set to something other than off (most likely Heat)

This should work well in practice though, as you will generally have a set target temperature and mode, and then just turn the spa on/off without mucking with the thermostat.

This also means that even if the Pool/Spa is turned off and you open the Pool/Spa Heater it mght say "HEATING TO". It will not actually being heating unless the corresponding Pool/Spa switch is turned on.
