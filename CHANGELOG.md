# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

...

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
