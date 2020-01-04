'use strict'

let Accessory, Service, Characteristic, uuid

module.exports = function(exportedTypes) {
  if (exportedTypes && !Accessory) {
    Accessory = exportedTypes.Accessory
    Service = exportedTypes.Service
    Characteristic = exportedTypes.Characteristic
    uuid = exportedTypes.uuid
  }

  return CircuitAccessory
}

class CircuitAccessory {
  constructor(name, circuitId, platform) {
    // name and uuid_base required by homebridge
    this.name = name
    this.circuitId = circuitId
    this.uuid_base = uuid.generate(platform.device_id + ':switch:' + name)
    this.platform = platform
    this.log = platform.log

    // initialize temperature sensor
    this.switchService = new Service.Switch(this.name)

    // ask platform to refresh accessories when someone gets our value.
    platform.bindCharacteristicGet(this.switchService, Characteristic.On)

    let accessory = this

    // ask platform to set circuit state
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('set', accessory._setCircuit.bind(accessory))

    this.informationService = platform.getAccessoryInformationService()
  }

  _setCircuit(newValue, callback, context) {
    const platform = this.platform
    platform.log.debug(this.name, 'set circuit', this.circuitId, ':', newValue)
    if (context !== this) {
      platform.log.debug('from click')
      platform
        .setCircuitState(this.circuitId, newValue ? 1 : 0)
        .then(_unused => {
          platform.log.info(this.name, 'updated state:', newValue)
          callback(null, newValue)
        })
        .catch(err => {
          platform.log.error('setCircuitState failed:', err)
          callback(err, null)
        })
    } else {
      callback(null, newValue)
    }
  }

  /** Respond to identify request */
  identify(callback) {
    this.log(this.name, 'Identify')
    callback()
  }

  /** Get suppported services for this accessory */
  getServices() {
    return [this.informationService, this.switchService]
  }

  set on(value) {
    this.switchService.getCharacteristic(Characteristic.On).setValue(value, null, this)
  }

  get on() {
    return this.temperatureService.getCharacteristic(Characteristic.On).value
  }

  set statusFault(value) {
    this.temperatureService.getCharacteristic(Characteristic.StatusFault).setValue(value)
  }

  get statusFault() {
    return this.temperatureService.getCharacteristic(Characteristic.StatusFault).value
  }
}
