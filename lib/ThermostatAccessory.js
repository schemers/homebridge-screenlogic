'use strict'

let Accessory, Service, Characteristic, uuid

module.exports = function(exportedTypes) {
  if (exportedTypes && !Accessory) {
    Accessory = exportedTypes.Accessory
    Service = exportedTypes.Service
    Characteristic = exportedTypes.Characteristic
    uuid = exportedTypes.uuid
  }

  return ThermostatAccessory
}

class ThermostatAccessory {
  constructor(name, platform, bodyType, minSetPoint, maxSetPoint) {
    // name and uuid_base required by homebridge
    this.name = name
    this.uuid_base = uuid.generate(platform.device_id + ':thermostat:' + name)
    this.platform = platform
    this.log = platform.log
    this.bodyType = bodyType
    this.minSetPoint = minSetPoint
    this.maxSetPoint = maxSetPoint

    // initialize temperature sensor
    this.thermostatService = new Service.Thermostat(this.name)

    // ask platform to refresh accessories when someone gets our value.
    platform.bindCharacteristicGet(this.thermostatService, Characteristic.CurrentTemperature)
    this.informationService = platform.getAccessoryInformationService()

    this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).setProps({
      format: Characteristic.Formats.FLOAT,
      minValue: minSetPoint,
      maxValue: maxSetPoint
    })

    this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).setProps({
      format: Characteristic.Formats.FLOAT,
      minValue: -18,
      maxValue: 60
    })

    this.thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits).setValue(1)

    let accessory = this

    // ask platform to set target heat point
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('set', accessory._setTargetTemperature.bind(accessory))

    // ask platform to set target heat mode
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('set', accessory._setTargetHeatingCoolingState.bind(accessory))
  }

  _setTargetTemperature(newValue, callback, context) {
    const platform = this.platform
    platform.log.debug(this.name, 'set target temperature:', newValue)
    if (context !== this) {
      platform.log.debug('from click')
      platform
        .setTargetTemperature(this.bodyType, newValue)
        .then(_unused => {
          platform.log.info(this.name, 'updated state:', newValue)
          callback(null, newValue)
        })
        .catch(err => {
          platform.log.error('setTargetTemperature failed:', err)
          callback(err, null)
        })
    } else {
      callback(null, newValue)
    }
  }

  _setTargetHeatingCoolingState(newValue, callback, context) {
    const platform = this.platform
    platform.log.debug(this.name, 'set target heating cooling state:', newValue)
    if (context !== this) {
      platform.log.debug('from click')
      platform
        .setTargetHeatingCoolState(this.bodyType, newValue)
        .then(_unused => {
          platform.log.info(this.name, 'updated state:', newValue)
          callback(null, newValue)
        })
        .catch(err => {
          platform.log.error('setTargetHeatingCoolState failed:', err)
          callback(err, null)
        })
    } else {
      callback(null, newValue)
    }
  }

  /** homebridge: Respond to identify request */
  identify(callback) {
    this.log(this.name, 'Identify')
    callback()
  }

  /** homebridge: Get suppported services for this accessory */
  getServices() {
    return [this.informationService, this.thermostatService]
  }

  set temperature(value) {
    this.log.debug(this.name, 'set temperature', value)
    this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).setValue(value)
  }

  get temperature() {
    return this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).value
  }

  set targetTemperature(value) {
    this.log.debug(this.name, 'set targetTemperature', value)
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .setValue(value, null, this)
  }

  get targetTemperature() {
    return this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).value
  }

  set heatingCoolingState(value) {
    this.log.debug(this.name, 'set heatingCoolingState', value)
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .setValue(value)
  }

  get heatingCoolingState() {
    return this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).value
  }

  set targetHeatingCoolingState(value) {
    this.log.debug(this.name, 'set heatingCoolingState', value)
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .setValue(value, null, this)
  }

  get targetHeatingCoolingState() {
    return this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).value
  }
}
