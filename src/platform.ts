import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge'

import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import { TemperatureAccessory, TemperatureAccessoryContext } from './temperatureAccessory'
import { CircuitAccessory, CircuitAccessoryContext } from './circuitAccessory'
import { ThermostatAccessory, ThermostatAccessoryContext } from './thermostatAccessory'

import { Controller, PoolConfig, PoolStatus } from './controller'

export interface AccessoryAdaptor<T> {
  generateUUID(platform: ScreenLogicPlatform, context: Record<string, any>): string
  sameContext(a: Record<string, any>, b: Record<string, any>): boolean
  factory(platform: ScreenLogicPlatform, accessory: PlatformAccessory): T
}

const POOL_TEMP_NAME = 'Pool'
const SPA_TEMP_NAME = 'Spa'
const AIR_TEMP_NAME = 'Air'
const POOL_THERMOSTAT_NAME = 'Pool Heater'
const SPA_THERMOSTAT_NAME = 'Spa Heater'

/**npm
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ScreenLogicPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic

  // this is used to track restored cached accessories
  private restoredAccessories: PlatformAccessory[] = []

  // bridge controller to talk to shades
  private controller: Controller

  // fetched config
  private poolConfig?: PoolConfig

  // set if we have an outstanding refresh
  private pendingRefreshPromise?: Promise<null>

  private poolTempAccessory?: TemperatureAccessory
  private spaTempAccessory?: TemperatureAccessory
  private airTempAccessory?: TemperatureAccessory

  private poolThermostatAccessory?: ThermostatAccessory
  private spaThermostatAccessory?: ThermostatAccessory

  private circuitAccessories: CircuitAccessory[] = []

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform', PLATFORM_NAME)

    // do this first to make sure we have proper defaults moving forward
    this.applyConfigDefaults(config)

    this.controller = new Controller({
      ip_address: this.config.ip_address,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
    })

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback')
      // run the method to discover / register your devices as accessories
      this.discoverDevices(0)
    })
  }

  discoverDevices(retryAttempt: number) {
    // test
    this.log.info('discoverDevices')

    const pollingInterval = 60 // TODO: get from config

    this.controller
      .getPoolConfig()
      .then(config => {
        this.poolConfig = config
        this.log.debug('got pool config', this.poolConfig)
        this.log.info(
          `discoverDevices connected: ${this.poolConfig.deviceId} ${this.poolConfig.softwareVersion}`,
        )
        this.setupDiscoveredAccessories(this.poolConfig)
      })
      .catch(err => {
        // on error, start another timeout with backoff
        const timeout = this.backoff(retryAttempt, pollingInterval)
        this.log.error(
          `discoverDevices retryAttempt: ${retryAttempt} timeout: ${timeout} error: ${err}`,
        )
        setTimeout(() => this.discoverDevices(retryAttempt + 1), timeout * 1000)
      })
  }

  setupDiscoveredAccessories(poolConfig: PoolConfig) {
    // this is used to track active accessories uuids
    let activeAccessories = new Set<string>()

    // make pool temperature sensor if needed
    if (poolConfig.hasPool && !this.config.hidePoolTemperatureSensor) {
      this.poolTempAccessory = this.configureAccessoryType(TemperatureAccessory.makeAdaptor(), {
        displayName: POOL_TEMP_NAME,
        type: POOL_TEMP_NAME,
      } as TemperatureAccessoryContext)
      activeAccessories.add(this.poolTempAccessory.UUID)
    }

    // make spa temperature sensor if needed
    if (poolConfig.hasSpa && !this.config.hideSpaTemperatureSensor) {
      this.spaTempAccessory = this.configureAccessoryType(TemperatureAccessory.makeAdaptor(), {
        displayName: SPA_TEMP_NAME,
        type: SPA_TEMP_NAME,
      } as TemperatureAccessoryContext)
      activeAccessories.add(this.spaTempAccessory.UUID)
    }

    this.airTempAccessory = this.configureAccessoryType(TemperatureAccessory.makeAdaptor(), {
      displayName: AIR_TEMP_NAME,
      type: AIR_TEMP_NAME,
    } as TemperatureAccessoryContext)
    activeAccessories.add(this.airTempAccessory.UUID)

    // make pool thermostat if needed
    if (poolConfig.hasPool && !this.config.hidePoolThermostat) {
      this.poolThermostatAccessory = this.configureAccessoryType(
        ThermostatAccessory.makeAdaptor(),
        {
          displayName: POOL_THERMOSTAT_NAME,
          bodyType: 0,
          minSetPoint: this.normalizeTemperature(poolConfig.poolMinSetPoint),
          maxSetPoint: this.normalizeTemperature(poolConfig.poolMaxSetPoint),
        } as ThermostatAccessoryContext,
      )
      activeAccessories.add(this.poolThermostatAccessory.UUID)
    }

    // make spa thermostat if needed
    if (poolConfig.hasSpa && !this.config.hideSpaThermostat) {
      this.spaThermostatAccessory = this.configureAccessoryType(ThermostatAccessory.makeAdaptor(), {
        displayName: SPA_THERMOSTAT_NAME,
        bodyType: 1,
        minSetPoint: this.normalizeTemperature(poolConfig.spaMinSetPoint),
        maxSetPoint: this.normalizeTemperature(poolConfig.spaMaxSetPoint),
      } as ThermostatAccessoryContext)
      activeAccessories.add(this.spaThermostatAccessory.UUID)
    }

    // filter out hidden circuits
    const hiddenNames = this.config.hidden_circuits || ''
    const hiddenCircuits = new Set(hiddenNames.split(',').map(item => item.trim()))

    poolConfig.circuits = poolConfig.circuits.filter(circuit => {
      return !hiddenCircuits.has(circuit.name)
    })

    for (const circuit of poolConfig.circuits) {
      const accessory = this.configureAccessoryType(CircuitAccessory.makeAdaptor(), {
        displayName: circuit.name,
        id: circuit.id,
      } as CircuitAccessoryContext)
      this.circuitAccessories.push(accessory)
      activeAccessories.add(accessory.UUID)
    }

    // unregister orphaned accessories
    const staleAccessories = this.restoredAccessories.filter(
      accessory => !activeAccessories.has(accessory.UUID),
    )

    if (staleAccessories.length) {
      const staleNames = staleAccessories.map(accessory => accessory.displayName)
      this.log.info('unregistering accessories', staleNames)
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories)
    }

    // start polling for status
    this._pollForStatus(0)
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName)

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.restoredAccessories.push(accessory)
  }

  configureAccessoryType<T>(adaptor: AccessoryAdaptor<T>, context: Record<string, any>): T {
    // generate a unique id for this shade based on context
    const uuid = adaptor.generateUUID(this, context)

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.restoredAccessories.find(accessory => accessory.UUID === uuid)

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName)

      // update the context if it has changed
      if (!adaptor.sameContext(context, existingAccessory.context)) {
        existingAccessory.context = context
        this.log.info('Updating existing accessory:', context.displayName)
        this.api.updatePlatformAccessories([existingAccessory])
      }
      // create the accessory handler for the restored accessory
      // this is imported from `platformAccessory.ts`
      return adaptor.factory(this, existingAccessory)
    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', context.displayName)

      // create a new accessory
      const accessory = new this.api.platformAccessory(context.displayName, uuid)

      // store a copy of the device object in the `accessory.context`
      accessory.context = context

      // create the accessory handler for the newly create accessory
      const newAccessory = adaptor.factory(this, accessory)

      // link the accessory to platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])

      return newAccessory
    }
  }

  /** start polling process with truncated exponential backoff: https://cloud.google.com/storage/docs/exponential-backoff */
  _pollForStatus(retryAttempt: number) {
    const pollingInterval = this.config.statusPollingSeconds

    this._refreshAccessoryValues()
      .then(() => {
        // on success, start another timeout at normal pollingInterval
        this.log.debug('_pollForStatus success, retryAttempt:', retryAttempt)
        setTimeout(() => this._pollForStatus(0), pollingInterval * 1000)
      })
      .catch(err => {
        // on error, start another timeout with backoff
        const timeout = this.backoff(retryAttempt, pollingInterval)
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
      this.pendingRefreshPromise
        // this catch is needed since we have a finally,
        // without the catch we'd get an unhandled promise rejection error
        .catch(err => {
          // log at debug level since we are logging at error in another location
          this.log.debug('_refreshAccessoryValues', err)
        })
        .finally(() => {
          this.log.debug('clearing pendingRefreshPromise')
          this.pendingRefreshPromise = undefined
        })
    }
    return this.pendingRefreshPromise
  }

  /** gets status,  updates accessories, and resolves */
  async _refreshStatus() {
    try {
      const poolStatus = await this.controller.getPoolStatus()
      this.log.debug('connected:', this.poolConfig?.deviceId, '(getStatus)')
      // update all values
      this._updateAccessories(poolStatus, undefined)
      return null
    } catch (err) {
      this._updateAccessories(undefined, err)
      throw err
    }
  }

  _updateAccessories(status?: PoolStatus, err?: Error) {
    const fault = err ? true : false
    this.airTempAccessory?.updateStatusFault(fault)
    this.poolTempAccessory?.updateStatusFault(fault)
    this.spaTempAccessory?.updateStatusFault(fault)

    if (status) {
      this.airTempAccessory?.updateCurrentTemperature(
        this.normalizeTemperature(status.airTemperature),
      )
      this.airTempAccessory?.updateStatusActive(true)

      this.poolTempAccessory?.updateCurrentTemperature(
        this.normalizeTemperature(status.poolTemperature),
      )
      this.poolTempAccessory?.updateStatusActive(status.isPoolActive)

      this.spaTempAccessory?.updateCurrentTemperature(
        this.normalizeTemperature(status.spaTemperature),
      )
      this.spaTempAccessory?.updateStatusActive(status.isSpaActive)

      if (this.poolThermostatAccessory) {
        this.poolThermostatAccessory.updateCurrentTemperature(
          this.normalizeTemperature(status.poolTemperature),
        )
        this.poolThermostatAccessory.updateTargetTemperature(
          this.normalizeTemperature(status.poolSetPoint),
        )
        this.poolThermostatAccessory.updateCurrentHeatingCoolingState(
          status.isPoolHeating
            ? this.Characteristic.CurrentHeatingCoolingState.HEAT
            : this.Characteristic.CurrentHeatingCoolingState.OFF,
        )

        this.poolThermostatAccessory.updateTargetHeatingCoolingState(
          this.mapHeatModeToTargetHeatingCoolingState(status.poolHeatMode),
        )
      }

      if (this.spaThermostatAccessory) {
        this.spaThermostatAccessory.updateCurrentTemperature(
          this.normalizeTemperature(status.spaTemperature),
        )
        this.spaThermostatAccessory.updateTargetTemperature(
          this.normalizeTemperature(status.spaSetPoint),
        )
        this.spaThermostatAccessory.updateCurrentHeatingCoolingState(
          status.isSpaHeating
            ? this.Characteristic.CurrentHeatingCoolingState.HEAT
            : this.Characteristic.CurrentHeatingCoolingState.OFF,
        )

        this.spaThermostatAccessory.updateTargetHeatingCoolingState(
          this.mapHeatModeToTargetHeatingCoolingState(status.spaHeatMode),
        )
      }

      for (const circuitAccessory of this.circuitAccessories) {
        circuitAccessory.updateOn(
          status.circuitState.get(circuitAccessory.context.id) ? true : false,
        )
      }
    }
  }

  async setTargetTemperature(context: ThermostatAccessoryContext, temperature: number) {
    if (this.poolConfig === undefined) {
      this.log.warn('setTargetTemperature failed: poolConfig is undefined')
      return
    }
    // need to convert from Celsius to what pool is conifigured for
    var heatPoint = this.poolConfig.isCelsius ? temperature : Math.round(temperature * 1.8 + 32)
    return this.controller.setHeatPoint(context.bodyType, heatPoint)
  }

  async setTargetHeatingCoolingState(context: ThermostatAccessoryContext, state: number) {
    return this.controller.setHeatMode(
      context.bodyType,
      this.mapTargetHeatingCoolingStateToHeatMode(state),
    )
  }

  async setCircuitState(context: CircuitAccessoryContext, state: boolean) {
    return this.controller.setCircuitState(context.id, state)
  }

  generateUUID(accessorySalt: string) {
    if (this.poolConfig !== undefined) {
      return this.api.hap.uuid.generate(this.poolConfig.deviceId + ':' + accessorySalt)
    } else {
      this.log.error('poolConfig is undefined')
      return ''
    }
  }

  backoff(retryAttempt: number, maxTime: number): number {
    retryAttempt = Math.max(retryAttempt, 1)
    return Math.min(Math.pow(retryAttempt - 1, 2) + Math.random(), maxTime)
  }

  accessoryInfo(): {
    manufacturer: string
    model: string
    serialNumber: string
  } {
    if (this.poolConfig) {
      return {
        manufacturer: 'Pentair',
        // store software version in model, since it doesn't follow
        // proper n.n.n format Apple requires and model is a string
        model: this.poolConfig.softwareVersion,
        serialNumber: this.poolConfig.deviceId,
      }
    } else {
      this.log.error('poolConfig is null getting accessoryInfo')
      return {
        manufacturer: 'unknown',
        model: 'unknown',
        serialNumber: '',
      }
    }
  }

  applyConfigDefaults(config: PlatformConfig) {
    // config.ip_address
    config.port = config.port ?? 80
    // config.username
    // config.password
    // config.hidden_circuits
    config.hidePoolTemperatureSensor = config.hidePoolTemperatureSensor ?? false
    config.hideSpaTemperatureSensor = config.hideSpaTemperatureSensor ?? false
    config.hidePoolThermostat = config.hidePoolThermostat ?? false
    config.hideSpaThermostat = config.hideSpaThermostat ?? false
    config.statusPollingSeconds = config.statusPollingSeconds ?? 60
    this.log.debug('config', this.config)
  }

  /** normalize temperature to celsius for homekit */
  normalizeTemperature(temperature: number): number {
    return this.poolConfig?.isCelsius ? temperature : (temperature - 32) / 1.8
  }

  /** map pool heat mode to thermostat target heating/coooling state  */
  mapHeatModeToTargetHeatingCoolingState(poolHeatMode: number) {
    switch (poolHeatMode) {
      case Controller.HEAT_MODE_OFF:
        return this.Characteristic.TargetHeatingCoolingState.OFF
      case Controller.HEAT_MODE_HEAT_PUMP:
        return this.Characteristic.TargetHeatingCoolingState.HEAT
      case Controller.HEAT_MODE_SOLAR_PREFERRED:
        return this.Characteristic.TargetHeatingCoolingState.AUTO
      case Controller.HEAT_MODE_SOLAR:
        return this.Characteristic.TargetHeatingCoolingState.COOL
      default:
        return this.Characteristic.TargetHeatingCoolingState.OFF
    }
  }

  /** map thermostat target heating/coooling state to pool heat mode */
  mapTargetHeatingCoolingStateToHeatMode(targetHeatingCoolingState: number) {
    switch (targetHeatingCoolingState) {
      case this.Characteristic.TargetHeatingCoolingState.OFF:
        return Controller.HEAT_MODE_OFF
      case this.Characteristic.TargetHeatingCoolingState.HEAT:
        return Controller.HEAT_MODE_HEAT_PUMP
      case this.Characteristic.TargetHeatingCoolingState.AUTO:
        return Controller.HEAT_MODE_SOLAR_PREFERRED
      case this.Characteristic.TargetHeatingCoolingState.COOL:
        return Controller.HEAT_MODE_SOLAR
      default:
        return Controller.HEAT_MODE_UNCHANGED
    }
  }
}
