# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## Fixed

- updated to `node-screenlogic` v1.4.0 which emits errors to the caller

- add `.on('error')` handlers to propagate errors back to promises via reject

## v1.4.0 - 2020-4-18

- since we are using a shared Promise, make sure to have a `.catch` handler when also setting up the `.finally`, otherwise we'll get an unhandled promise rejection error

## v1.3.5 - 2020-3-20

- fixes #3 by clamping set point so it is just above/below the min/max set point

## v1.3.4 - 2020-3-20

### Added

- dump out pool config and status when debug is turned on

- add a default case for `mapHeatModeToTargetHeatingCoolingState`

## v1.3.3 - 2020-3-19

### Fixed

- attempt to fix issue #3

was incorrectly using `Characteristic.CurrentHeaterCoolerState.{OFF,HEAT}` instead of `Characteristic.CurrentHeatingCoolingState.{HEAT,OFF}`

before fixing I was seeing:

```
[3/19/2020, 2:46:56 PM][screenlogic] Pool Heater set heatingCoolingState undefined
[3/19/2020, 2:46:56 PM][screenlogic] Pool Heater set heatingCoolingState 0
```

afer fixing:

```
[3/19/2020, 2:49:29 PM][screenlogic] Pool Heater set heatingCoolingState 0
[3/19/2020, 2:49:29 PM][screenlogic] Pool Heater set heatingCoolingState 0
```

## v1.3.2 - 2020-3-14

### Added

- updated images in README.md

## v1.3.1 - 2020-3-14

### Added

- updated images in README.md

## v1.3.0 - 2020-3-14

### Added

- add "Pool Heater" and "Spa Heater" accessories which are exposed as HomeKit Thermostats. Fixes #1. See README.md for details

- add `hidePoolTemperatureSensor` config that hides the pool temperature sensor, which is redundant if you are showing pool thermostat

- add `hideSpaTemperatureSensor` config that hides the spa temperature sensor, which is redundant if you are showing spa thermostat

- add `hidePoolThermostat` config that hides the pool thermostat (aka, pool heater) if you don't want to allow changes via HomeKit

- add `hideSpaThermostat` config that hides the spa thermostat (aka, spa heater) if you don't want to allow changes via HomeKit

### Fixed

- fixes #2, typo in description

## v1.2.1 - 2020-1-4

### Fixed

- actually set default polling to 60 seconds

## v1.2.0 - 2020-1-4

### Added

- add background polling for status updates to enable automations to work

- add `statusPollingSeconds` option to config, defaults to 60 seconds

- expontential backoff on error

## v1.1.3 - 2020-1-3

### Fixed

- promise.then(f1,f2) -> promise.then(f1).catch(f2) cleanup

- remove bluebird dependency since not using it

## v1.1.2 - 2020-1-3

### Fixed

- log connected/errors in \_refreshStatus

- replace pending callback queue with pending promise

## v1.1.1 - 2020-1-2

### Fixed

- refresh status before returning accesscories to homebridge

## v1.1.0 - 2020-1-2

### Fixed

- rewrite to use promises/async/await

- move all ScreenLogic-related code to Pool module to keep platform simpler

- simplify logging with top-level exception handlers

## v1.0.0 - 2020-1-2

- bump verison to 1.0.0 for easier updates in homebridge

## v0.2.0 - 2020-1-2

### Added

- add `bindCharacteristicGet` convenience method on platform to easily bind a characteristics `on('get')` function to a function that refreshes values and handles callback properly.

### Fixed

- properly handle when controller is conifgured for celsius temperatures

- refactor characteristic handlers

## v0.1.1 - 2020-1-1

### Fixed

- fixed number of found accessories in log

## v0.1.0 - 2020-1-1

- expose discovered circuit names as switches

- add a config option to hide circuits by name

## v0.0.6 - 2019-12-31

### Added

- remove cache logic and instead queue pending callbacks if there is an outstanding refresh connection and call them when connection returns

## v0.0.5 - 2019-12-30

### Added

- added `config.schema.json` for easier configuration in Homebridge UIs

## v0.0.4 - 2019-12-30

### Added

- Apple only allows `n.n.n` for HardwareVersion/FirmwareVersion, so store Screen Logic software version in `Model` characterstic, which allows a free-form string.

### Fixed

- update callbacks to use error-first conventions

- define Error objects on ScreenLogicPlatform

- log errors

- update `getConnectionByIPAddress` to honor callback contract be using `setImmediate` so it calls callback async

- set Characteristic.StatusFault to true on errors

## v0.0.3 - 2019-12-29

### Added

- cache values for 5s to prevent making a bunch of simultaneous calls

## v0.0.2 - 2019-12-29

### Fixed

- cleanup

## v0.0.1 - 2019-12-29

### Fixed

- initial check in (no release)
