'use strict'

const Pool = require('./lib/Pool')

let Accessory, Service, Characteristic, uuid
let TemperatureAccessory, CircuitAccessory, ThermostatAccessory

module.exports = function(homebridge) {
  Accessory = homebridge.hap.Accessory
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  uuid = homebridge.hap.uuid

  const exportedTypes = {
    Accessory: Accessory,
    Service: Service,
    Characteristic: Characteristic,
    uuid: uuid
  }

  TemperatureAccessory = require('./lib/TemperatureAccessory')(exportedTypes)
  CircuitAccessory = require('./lib/CircuitAccessory')(exportedTypes)
  ThermostatAccessory = require('./lib/ThermostatAccessory')(exportedTypes)

  homebridge.registerPlatform('homebridge-screenlogic', 'ScreenLogic', ScreenLogicPlatform)
}

const POOL_TEMP_NAME = 'Pool'
const SPA_TEMP_NAME = 'Spa'
const AIR_TEMP_NAME = 'Air'
const POOL_THERMOSTAT_NAME = 'Pool Heater'
const SPA_THERMOSTAT_NAME = 'Spa Heater'
const DEFAULT_STATUS_POLLING_SECONDS = 60

class ScreenLogicPlatform {
  constructor(log, config) {
    this.log = log
    this.config = config
    this.pendingRefreshPromise = null
    this.poolController = new Pool.Controller(config)
  }

  /** Homebridge requirement that will fetch all the discovered accessories */
  accessories(callback) {
    this.log.info('Fetching ScreenLogic Info...')

    this._accessories()
      .then(foundAccessories => {
        this.log.info('found', foundAccessories.length, 'accessories')
        callback(foundAccessories)
      })
      .catch(err => {
        this.log.error('unable to get pool config:', err)
        callback([])
      })
  }

  async _accessories() {
    this.poolConfig = await this.poolController.getPoolConfig()

    // filter out hidden circuits
    const hiddenNames = this.config.hidden_circuits || ''
    const hiddenCircuits = new Set(hiddenNames.split(',').map(item => item.trim()))

    this.poolConfig.circuits = this.poolConfig.circuits.filter(circuit => {
      return !hiddenCircuits.has(circuit.name)
    })

    this.device_id = this.poolConfig.gatewayName.replace('Pentair: ', '')

    this.log.info(
      'connected:',
      this.poolConfig.gatewayName,
      this.poolConfig.softwareVersion,
      '(getPoolConfig)'
    )

    var accessories = []

    if (!this.config.hidePoolTemperatureSensor) {
      this.poolTempAccessory = new TemperatureAccessory(POOL_TEMP_NAME, this)
      accessories.push(this.poolTempAccessory)
    } else {
      this.poolTempAccessory = null
    }

    if (!this.config.hideSpaTemperatureSensor) {
      this.spaTempAccessory = new TemperatureAccessory(SPA_TEMP_NAME, this)
      accessories.push(this.spaTempAccessory)
    } else {
      this.spaTempAccessory = null
    }

    this.airTempAccessory = new TemperatureAccessory(AIR_TEMP_NAME, this)
    accessories.push(this.airTempAccessory)

    if (!this.config.hidePoolThermostat) {
      this.poolThermostatAccessory = new ThermostatAccessory(
        POOL_THERMOSTAT_NAME,
        this,
        0,
        this.normalizeTemperature(this.poolConfig.poolMinSetPoint),
        this.normalizeTemperature(this.poolConfig.poolMaxSetPoint)
      )
      accessories.push(this.poolThermostatAccessory)
    } else {
      this.poolThermostatAccessory = null
    }

    if (!this.config.hideSpaThermostat) {
      this.spaThermostatAccessory = new ThermostatAccessory(
        SPA_THERMOSTAT_NAME,
        this,
        1,
        this.normalizeTemperature(this.poolConfig.spaMinSetPoint),
        this.normalizeTemperature(this.poolConfig.spaMaxSetPoint)
      )
      accessories.push(this.spaThermostatAccessory)
    } else {
      this.spaThermostatAccessory = null
    }

    this.circuitAccessories = []

    for (const circuit of this.poolConfig.circuits) {
      const switchAccessory = new CircuitAccessory(circuit.name, circuit.id, this)
      this.circuitAccessories.push(switchAccessory)
      accessories.push(switchAccessory)
    }

    // start polling for status
    this._pollForStatus(0)

    return accessories
  }

  /** start polling process with truncated exponential backoff: https://cloud.google.com/storage/docs/exponential-backoff */
  _pollForStatus(retryAttempt) {
    let backoff = function(retryAttempt, maxTime) {
      retryAttempt = Math.max(retryAttempt, 1)
      return Math.min(Math.pow(retryAttempt - 1, 2) + Math.random(), maxTime)
    }

    const pollingInterval = this.config.statusPollingSeconds || DEFAULT_STATUS_POLLING_SECONDS

    this._refreshAccessoryValues()
      .then(() => {
        // on success, start another timeout at normal pollingInterval
        this.log.debug('_pollForStatus success, retryAttempt:', retryAttempt)
        setTimeout(() => this._pollForStatus(0), pollingInterval * 1000)
      })
      .catch(err => {
        // on error, start another timeout with backoff
        const timeout = pollingInterval + backoff(retryAttempt, pollingInterval * 20)
        this.log.error('_pollForStatus retryAttempt:', retryAttempt, 'timeout:', timeout, err)
        setTimeout(() => this._pollForStatus(retryAttempt + 1), timeout * 1000)
      })
  }

  // refresh all accessories
  async _refreshAccessoryValues() {
    // if there already is a pending promise, just return it
    if (this.pendingRefreshPromise) {
      this.log.debug('re-using existing pendingRefreshPromise')
    } else {
      this.log.debug('creating new pendingRefreshPromise')
      this.pendingRefreshPromise = this._refreshStatus()
      this.pendingRefreshPromise.finally(() => {
        this.log.debug('clearing pendingRefreshPromise')
        this.pendingRefreshPromise = null
      })
    }
    return this.pendingRefreshPromise
  }

  /** gets pool status,  updates accessories, and resolves */
  async _refreshStatus() {
    try {
      const poolStatus = await this.poolController.getPoolStatus()
      this.log.debug('connected:', this.poolConfig.gatewayName, '(getPoolStatus)')
      this._updateAccessories(poolStatus, null)
      return null
    } catch (err) {
      this.log.error('error getting pool status', err)
      this._updateAccessories(null, err)
      throw err
    }
  }

  /** updates all accessory data with latest values after a refresh */
  _updateAccessories(status, err) {
    const fault = err ? true : false
    this.airTempAccessory.statusFault = fault
    if (this.poolTempAccessory) {
      this.poolTempAccessory.statusFault = fault
    }
    if (this.spaTempAccessory) {
      this.spaTempAccessory.statusFault = fault
    }

    for (const circuitAccessory of this.circuitAccessories) {
      circuitAccessory.stateFault = fault
    }

    if (!err && status) {
      this.airTempAccessory.temperature = this.normalizeTemperature(status.airTemperature)
      this.airTempAccessory.statusActive = true

      if (this.poolTempAccessory) {
        this.poolTempAccessory.temperature = this.normalizeTemperature(status.poolTemperature)
        this.poolTempAccessory.statusActive = status.isPoolActive
      }

      if (this.spaTempAccessory) {
        this.spaTempAccessory.temperature = this.normalizeTemperature(status.spaTemperature)
        this.spaTempAccessory.statusActive = status.isSpaActive
      }

      if (this.poolThermostatAccessory) {
        this.poolThermostatAccessory.temperature = this.normalizeTemperature(status.poolTemperature)
        this.poolThermostatAccessory.targetTemperature = this.normalizeTemperature(
          status.poolSetPoint
        )
        this.poolThermostatAccessory.heatingCoolingState = status.poolIsHeating
          ? Characteristic.CurrentHeaterCoolerState.HEAT
          : Characteristic.CurrentHeaterCoolerState.OFF
        this.poolThermostatAccessory.targetHeatingCoolingState = this.mapHeatModeToTargetHeatingCoolingState(
          status.poolHeatMode
        )
      }

      if (this.spaThermostatAccessory) {
        this.spaThermostatAccessory.temperature = this.normalizeTemperature(status.spaTemperature)
        this.spaThermostatAccessory.targetTemperature = this.normalizeTemperature(
          status.spaSetPoint
        )
        this.spaThermostatAccessory.heatingCoolingState = status.spaIsHeating
          ? Characteristic.CurrentHeaterCoolerState.HEAT
          : Characteristic.CurrentHeaterCoolerState.OFF
        this.spaThermostatAccessory.targetHeatingCoolingState = this.mapHeatModeToTargetHeatingCoolingState(
          status.spaHeatMode
        )
      }

      for (const circuitAccessory of this.circuitAccessories) {
        circuitAccessory.on = status.circuitState.get(circuitAccessory.circuitId) ? true : false
      }
    }
  }

  async setCircuitState(circuitId, circuitState) {
    return this.poolController.setCircuitState(circuitId, circuitState)
  }

  async setTargetTemperature(bodyType, targetTemperature) {
    // need to convert from Celsius to what pool is conifigured for
    var heatPoint = this.poolConfig.isCelsius
      ? targetTemperature
      : Math.round(targetTemperature * 1.8 + 32)
    return this.poolController.setHeatPoint(bodyType, heatPoint)
  }

  /** set pool heat mode to target cooling state via mapping */
  async setTargetHeatingCoolState(bodyType, targetHeatingCoolingState) {
    return this.poolController.setHeatMode(
      bodyType,
      this.mapTargetHeatingCoolingStateToHeatMode(targetHeatingCoolingState)
    )
  }

  /** convenience method for accessories */
  getAccessoryInformationService() {
    var informationService = new Service.AccessoryInformation()
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Pentair')
      .setCharacteristic(Characteristic.FirmwareRevision, '')
      // store software version in model, since it doesn't follow
      // proper n.n.n format Apple requires and model is a string
      .setCharacteristic(Characteristic.Model, this.poolConfig.softwareVersion)
      .setCharacteristic(Characteristic.SerialNumber, this.device_id)
    return informationService
  }

  /** convenience function to add an `on('get')` handler which refreshes accessory values  */
  bindCharacteristicGet(service, characteristic) {
    const platform = this
    service.getCharacteristic(characteristic).on('get', function(callback) {
      platform
        ._refreshAccessoryValues()
        .then(() => callback(null, this.value))
        .catch(err => callback(err, null))
    })
  }

  /** normalize temperature to celsius for homekit */
  normalizeTemperature(temperature) {
    return this.poolConfig.isCelsius ? temperature : (temperature - 32) / 1.8
  }

  /** map pool heat mode to thermostat target heating/coooling state  */
  mapHeatModeToTargetHeatingCoolingState(poolHeatMode) {
    switch (poolHeatMode) {
      case Pool.HEAT_MODE_OFF:
        return Characteristic.TargetHeatingCoolingState.OFF
      case Pool.HEAT_MODE_HEAT_PUMP:
        return Characteristic.TargetHeatingCoolingState.HEAT
      case Pool.HEAT_MODE_SOLAR_PREFERRED:
        return Characteristic.TargetHeatingCoolingState.AUTO
      case Pool.HEAT_MODE_SOLAR:
        return Characteristic.TargetHeatingCoolingState.COOL
    }
  }

  /** map thermostat target heating/coooling state to pool heat mode */
  mapTargetHeatingCoolingStateToHeatMode(targetHeatingCoolingState) {
    switch (targetHeatingCoolingState) {
      case Characteristic.TargetHeatingCoolingState.OFF:
        return Pool.HEAT_MODE_OFF
      case Characteristic.TargetHeatingCoolingState.HEAT:
        return Pool.HEAT_MODE_HEAT_PUMP
      case Characteristic.TargetHeatingCoolingState.AUTO:
        return Pool.HEAT_MODE_SOLAR_PREFERRED
      case Characteristic.TargetHeatingCoolingState.COOL:
        return Pool.HEAT_MODE_SOLAR
      default:
        return Pool.HEAT_MODE_UNCHANGED
    }
  }
}
