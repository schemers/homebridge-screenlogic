'use strict'

const ScreenLogic = require('node-screenlogic')

let Accessory, Service, Characteristic, uuid
let TemperatureAccessory, CircuitAccessory

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

  homebridge.registerPlatform('homebridge-screenlogic', 'ScreenLogic', ScreenLogicPlatform)
}

const POOL_TEMP_NAME = 'Pool'
const SPA_TEMP_NAME = 'Spa'
const AIR_TEMP_NAME = 'Air'

class ScreenLogicPlatform {
  constructor(log, config) {
    this.log = log
    this.config = config

    const hiddenCircuits = config.hidden_circuits || ''
    this.hiddenCircuitNames = hiddenCircuits.split(',').map(item => item.trim())

    this.system = {
      airTemperature: 0,
      spaTemperature: 0,
      poolTemperature: 0,
      softwareVersion: 'unknown',
      isPoolActive: false,
      isSpaActive: false,
      controllerId: undefined,
      circuits: {
        // "501": { circuitId: 501, name: 'name', state: 0/1 }
      }
    }

    this.gatewayName = undefined
    this.pendingRefreshCallbacks = []
  }

  /** Homebridge requirement that will fetch all the accessories */
  accessories(callback) {
    this.log.info('Fetching ScreenLogic Info...')

    this.refreshStatus(true, err => {
      var foundAccessories = []
      if (!err) {
        foundAccessories = this.initializeAccessories()
        this.updateAccessories(null)
      } else {
        this.log.error('error getting accessories:', err.message)
      }
      // this is a homebridge-style callback
      callback(foundAccessories)
    })
  }

  initializeAccessories() {
    var accessories = []
    this.poolTempAccessory = new TemperatureAccessory(POOL_TEMP_NAME, this)
    accessories.push(this.poolTempAccessory)

    this.spaTempAccessory = new TemperatureAccessory(SPA_TEMP_NAME, this)
    accessories.push(this.spaTempAccessory)

    this.airTempAccessory = new TemperatureAccessory(AIR_TEMP_NAME, this)
    accessories.push(this.airTempAccessory)

    this.circuitAccessories = []

    for (const circuitId in this.system.circuits) {
      const circuit = this.system.circuits[circuitId]
      const switchAccessory = new CircuitAccessory(circuit.name, circuitId, this)
      this.circuitAccessories[circuit.circuitId] = switchAccessory
      accessories.push(switchAccessory)
    }

    this.log.info('found', this.accessories.length, 'accessories')
    return accessories
  }

  /** refresh all our accessory */
  refreshAccessoryValues(callback) {
    this.refreshStatus(false, err => {
      this.updateAccessories(err)
      callback(err)
    })
  }

  /** updates all accessory data with latest values after a refresh */
  updateAccessories(err) {
    const fault = err ? true : false
    this.airTempAccessory.statusFault = fault
    this.poolTempAccessory.statusFault = fault
    this.spaTempAccessory.statusFault = fault

    for (const circuitId in this.system.circuits) {
      this.circuitAccessories[circuitId].stateFault = fault
    }

    if (!err) {
      this.airTempAccessory.temperature = this.system.airTemperature
      this.airTempAccessory.statusActive = true

      this.poolTempAccessory.temperature = this.system.poolTemperature
      this.poolTempAccessory.statusActive = this.system.isPoolActive

      this.spaTempAccessory.temperature = this.system.spaTemperature
      this.spaTempAccessory.statusActive = this.system.isSpaActive

      for (const circuitId in this.system.circuits) {
        this.circuitAccessories[circuitId].on = this.system.circuits[circuitId].state ? true : false
      }
    }
  }

  refreshStatus(fullConfig, callback) {
    this.getConnection((err, connection) => {
      if (err) {
        callback(err)
        return
      }

      this.device_id = this.gatewayName.replace('Pentair: ', '')
      this.pendingRefreshCallbacks.push(callback)

      // if queue length is great than 1, we just return
      if (this.pendingRefreshCallbacks.length > 1) {
        this.log.debug('queing pending callback. length:', this.pendingRefreshCallbacks.length)
        return
      }

      this.connectRefreshStatus(fullConfig, connection, err => {
        for (const pendingCallback of this.pendingRefreshCallbacks) {
          this.log.debug('running pendingCallback')
          pendingCallback(err)
        }
        this.pendingRefreshCallbacks = []
      })
    })
  }

  /** connect on the specified connection and refresh various `system` properties */
  connectRefreshStatus(fullConfig, connection, callback) {
    const platform = this
    connection
      .on('loggedIn', function() {
        this.getVersion()
      })
      .on('version', function(version) {
        platform.system.softwareVersion = version.version
        platform.log.info(`connected ${platform.device_id} (${version.version})`)
        if (fullConfig) {
          this.getControllerConfig()
        } else {
          this.getPoolStatus()
        }
      })
      .on('controllerConfig', function(config) {
        platform.system.controllerId = config.controllerId
        for (const circuit of config.bodyArray) {
          if (platform.hiddenCircuitNames.indexOf(circuit.name) == -1) {
            platform.system.circuits[circuit.circuitId] = {
              circuitId: circuit.circuitId,
              name: circuit.name,
              state: 0 // this gets updated via pool status
            }
          } else {
            platform.log.debug('hiding circuit', circuit.name)
          }
        }
        this.getPoolStatus()
      })
      .on('poolStatus', function(status) {
        connection.close()
        platform.system.poolTemperature = ScreenLogicPlatform.fahrenheitToCelsius(
          status.currentTemp[0]
        )
        platform.system.spaTemperature = ScreenLogicPlatform.fahrenheitToCelsius(
          status.currentTemp[1]
        )
        platform.system.airTemperature = ScreenLogicPlatform.fahrenheitToCelsius(status.airTemp)
        platform.system.isPoolActive = status.isPoolActive()
        platform.system.isSpaActive = status.isSpaActive()
        // go through and update state
        for (const circuit of status.circuitArray) {
          if (typeof platform.system.circuits[circuit.id] !== 'undefined') {
            platform.system.circuits[circuit.id].state = circuit.state
          }
        }
        callback(null)
      })
      .on('loginFailed', function() {
        connection.close()
        callback(ScreenLogicPlatform.loginError)
      })
    connection.connect()
  }

  setCircuitState(circuitId, circuitState, callback) {
    this.getConnection((err, connection) => {
      if (err) {
        callback(err)
        return
      }
      const platform = this
      connection
        .on('loggedIn', function() {
          this.setCircuitState(platform.controllerId, circuitId, circuitState)
        })
        .on('circuitStateChanged', function() {
          connection.close()
          callback(null)
          // schedule a refresh after updating...
          setTimeout(() => {
            platform.refreshAccessoryValues(() => {})
          }, 10)
        })
        .on('loginFailed', function() {
          connection.close()
          callback(ScreenLogicPlatform.loginError)
        })
      connection.connect()
    })
  }

  getConnection(callback) {
    var connectionGetter, connectionVia

    if (this.config.ip_address) {
      connectionGetter = this.getConnectionByIPAddress
      connectionVia = 'ip_address'
    } else if (this.config.username && this.config.password) {
      connectionGetter = this.getConnectionByRemoteLogin
      connectionVia = 'remote'
    } else {
      connectionGetter = this.getConnectionByBroadcast
      connectionVia = 'broadcast'
    }

    connectionGetter.call(this, (err, connection) => {
      if (!err) {
        this.log.debug(
          this.gatewayName,
          connection.serverAddress,
          connection.serverPort,
          'via',
          connectionVia
        )
        callback(null, connection)
      } else {
        this.log.error('connectionGetter failed:', err.message)
        callback(err)
      }
    })
  }

  /** get a connection by udp broadcast */
  getConnectionByBroadcast(callback) {
    const platform = this
    let finder = new ScreenLogic.FindUnits()
    finder.on('serverFound', server => {
      finder.close()
      platform.gatewayName = server.gatewayName
      callback(null, new ScreenLogic.UnitConnection(server))
    })
    finder.search()
  }

  /** get a connection by IP address */
  getConnectionByIPAddress(callback) {
    const platform = this
    platform.gatewayName = platform.config['username'] || 'Pentair: XX-XX-XX'
    // force it to be async to keep callback contract
    setImmediate(() => {
      callback(
        null,
        new ScreenLogic.UnitConnection(
          platform.config.port || 80,
          platform.config.ip_address,
          platform.config['password']
        )
      )
    })
  }

  /** find a unit by remote login */
  getConnectionByRemoteLogin(callback) {
    const platform = this
    var remote = new ScreenLogic.RemoteLogin(platform.config.username)
    remote.on('gatewayFound', function(unit) {
      remote.close()
      if (unit && unit.gatewayFound) {
        platform.gatewayName = platform.config.username // unit.gatewayName
        callback(
          null,
          new ScreenLogic.UnitConnection(unit.port, unit.ipAddr, platform.config.password)
        )
      } else {
        callback(ScreenLogicPlatform.noRemoteUnitFoundError)
      }
    })
    remote.connect()
  }

  /** convenience method for accessories */
  getAccessoryInformationService() {
    var informationService = new Service.AccessoryInformation()
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Pentair')
      .setCharacteristic(Characteristic.FirmwareRevision, '')
      // store software version in model, since it doesn't follow
      // proper n.n.n format Apple requires and model is a string
      .setCharacteristic(Characteristic.Model, this.system.softwareVersion)
      .setCharacteristic(Characteristic.SerialNumber, this.device_id)
    return informationService
  }

  static fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8
  }

  static celsiusToFahrenheit(temperature) {
    return temperature * 1.8 + 32
  }
}

// these are declared outside the class due to eslint
ScreenLogicPlatform.loginError = new Error('unable to login')
ScreenLogicPlatform.noRemoteUnitFoundError = new Error('no remote unit found')
ScreenLogicPlatform.noBroadcastUnitFoundError = new Error('no unit found via broadcast')
