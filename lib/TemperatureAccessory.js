'use strict'

let Accessory, Service, Characteristic, uuid

module.exports = function(exportedTypes) {
  if (exportedTypes && !Accessory) {
    Accessory = exportedTypes.Accessory
    Service = exportedTypes.Service
    Characteristic = exportedTypes.Characteristic
    uuid = exportedTypes.uuid
  }

  return TemperatureAccessory
}

class TemperatureAccessory {
  constructor(name, platform) {
    // name and uuid_base required by homebridge
    this.name = name
    this.uuid_base = uuid.generate(platform.device_id + ':temp:' + name)
    this.platform = platform
    this.log = platform.log

    // initialize temperature sensor
    this.temperatureService = new Service.TemperatureSensor(this.name)

    // ask platform to refresh accessories when someone gets our value.
    platform.bindCharacteristicGet(this.temperatureService, Characteristic.CurrentTemperature, name)
    this.informationService = platform.getAccessoryInformationService()
  }

  /** homebridge: Respond to identify request */
  identify(callback) {
    this.log(this.name, 'Identify')
    callback()
  }

  /** homebridge: Get suppported services for this accessory */
  getServices() {
    return [this.informationService, this.temperatureService]
  }

  set temperature(value) {
    this.log.debug(this.name, 'set temperature', value)
    this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).setValue(value)
  }

  get temperature() {
    return this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).value
  }

  set statusActive(value) {
    this.log.debug(this.name, 'set status', value)
    this.temperatureService.getCharacteristic(Characteristic.StatusActive).setValue(value)
  }

  get statusActive() {
    return this.temperatureService.getCharacteristic(Characteristic.StatusActive).value
  }

  set statusFault(value) {
    this.temperatureService.getCharacteristic(Characteristic.StatusFault).setValue(value)
  }

  get statusFault() {
    return this.temperatureService.getCharacteristic(Characteristic.StatusFault).value
  }
}
