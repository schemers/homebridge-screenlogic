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
    this.switchService.getCharacteristic(Characteristic.On).on('get', function(callback) {
      platform.refreshAccessoryValues(err => {
        if (!err) {
          platform.log.debug(name, 'current state', this.value)
        } else {
          platform.log.error('refreshAccessories failed:', err.message)
        }
        callback(null, this.value)
      })
    })

    let accessory = this

    // ask platform to set circuit state
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('set', function(newValue, callback, context) {
        platform.log.debug('set circuit', circuitId, name, newValue, this.value)
        const internalSet = context === accessory
        if (!internalSet) {
          platform.log.debug('from click')
          platform.setCircuitState(accessory.circuitId, newValue ? 1 : 0, err => {
            if (!err) {
              platform.log.info(name, 'updated state:', newValue)
            } else {
              platform.log.error('setCircuitState failed:', err.message)
            }
            callback(null, newValue)
          })
        } else {
          callback(null, newValue)
        }
      })

    this.informationService = platform.getAccessoryInformationService()
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
