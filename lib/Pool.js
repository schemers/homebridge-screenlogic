'use strict'

const ScreenLogic = require('node-screenlogic')

/**
 * config options:
 * 1. UDP broadcast to find unit:
 *   config = {}
 * 2. find unit by static IP address.
 *   config = {
 *     ip_address: "n.n.n.n",
 *     username: "Pentair: XX-XX-XX" // optional
 *   }
 * 3. login via Pentrair remote gateway
 *   config = {
 *     username: "Pentair: XX-XX-XX",
 *     password: "..."
 *   }
 */
class Controller {
  constructor(config) {
    this.config = config
  }

  async getPoolConfig() {
    const connection = await this._getConnection()
    try {
      await this._login(connection)
      return await this._getPoolConfig(connection)
    } finally {
      connection.close()
    }
  }

  async getPoolStatus() {
    const connection = await this._getConnection()
    try {
      await this._login(connection)
      return await this._getPoolStatus(connection)
    } finally {
      connection.close()
    }
  }

  async setCircuitState(circuitId, circuitState) {
    const connection = await this._getConnection()
    try {
      await this._login(connection)
      return await this._setCircuitState(connection, circuitId, circuitState)
    } finally {
      connection.close()
    }
  }

  async _getPoolConfig(connection) {
    var softwareVersion = ''
    return new Promise(function(resolve, _reject) {
      connection
        .once('version', function(version) {
          softwareVersion = version.version
          this.getControllerConfig()
        })
        .once('controllerConfig', function(poolConfig) {
          resolve(new Config(connection.gatewayName, softwareVersion, poolConfig))
        })
      connection.getVersion()
    })
  }

  async _setCircuitState(connection, circuitId, circuitState) {
    return new Promise(function(resolve, reject) {
      connection
        .once('circuitStateChanged', function() {
          resolve(true)
        })
        .once('badParameter', function() {
          reject(new ControllerError('bad parameter passed to set command'))
        })
      connection.setCircuitState(0, circuitId, circuitState)
    })
  }

  async _getPoolStatus(connection) {
    return new Promise(function(resolve, _reject) {
      connection.once('poolStatus', function(status) {
        resolve(new Status(status))
      })
      connection.getPoolStatus()
    })
  }

  async _login(connection) {
    return new Promise(function(resolve, reject) {
      connection
        .once('loggedIn', function() {
          resolve()
        })
        .once('loginFailed', function() {
          reject(new ControllerError('unable to login'))
        })
      connection.connect()
    })
  }

  async _getConnection() {
    if (this.config.ip_address) {
      return this._getConnectionByIPAddress()
    } else if (this.config.username && this.config.password) {
      return this._getConnectionByRemoteLogin()
    } else {
      return this._getConnectionByBroadcast()
    }
  }

  /** get a connection by udp broadcast */
  async _getConnectionByBroadcast() {
    return new Promise(function(resolve, _reject) {
      let finder = new ScreenLogic.FindUnits()
      finder.on('serverFound', server => {
        finder.close()
        const connection = new ScreenLogic.UnitConnection(server)
        connection.gatewayName = server.gatewayName
        resolve(connection)
      })
      finder.search()
    })
  }

  /** get a connection by IP address */
  async _getConnectionByIPAddress() {
    const that = this
    return new Promise(function(resolve, _reject) {
      const connection = new ScreenLogic.UnitConnection(
        that.config.port || 80,
        that.config.ip_address,
        that.config['password']
      )
      connection.gatewayName = that.config['username'] || 'Pentair: XX-XX-XX'
      resolve(connection)
    })
  }

  /** find a unit by remote login */
  async _getConnectionByRemoteLogin() {
    const that = this
    return new Promise(function(resolve, reject) {
      var remote = new ScreenLogic.RemoteLogin(that.config.username)
      remote.on('gatewayFound', function(unit) {
        remote.close()
        if (unit && unit.gatewayFound) {
          const connection = new ScreenLogic.UnitConnection(
            unit.port,
            unit.ipAddr,
            that.config.password
          )
          connection.gatewayName = that.config.username
          resolve(connection)
        } else {
          reject(new ControllerError('no remote unit found'))
        }
      })
      remote.connect()
    })
  }
}

class ControllerError extends Error {}

class Config {
  constructor(gatewayName, softwareVersion, config) {
    this.gatewayName = gatewayName
    this.softwareVersion = softwareVersion
    this.isCelsius = config.degC
    this.circuits = []
    for (const circuit of config.bodyArray) {
      this.circuits.push({
        id: circuit.circuitId,
        name: circuit.name,
        state: 0 // this gets updated via pool status
      })
    }
  }
}

class Status {
  constructor(status) {
    this.poolTemperature = status.currentTemp[0]
    this.spaTemperature = status.currentTemp[1]
    this.airTemperature = status.airTemp
    this.isPoolActive = status.isPoolActive()
    this.isSpaActive = status.isSpaActive()
    // save circuit state
    this.circuitState = new Map()
    for (const circuit of status.circuitArray) {
      this.circuitState.set(circuit.id, circuit.state)
    }
  }
}

module.exports = {
  Controller,
  Config,
  Status,
  ControllerError
}
