import {
  Service,
  Formats,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
} from 'homebridge'

import { ScreenLogicPlatform, AccessoryAdaptor } from './platform'

export interface ThermostatAccessoryContext {
  displayName: string
  bodyType: number
  minSetPoint: number
  maxSetPoint: number
}

export class ThermostatAccessory {
  static makeAdaptor(): AccessoryAdaptor<ThermostatAccessory> {
    return {
      generateUUID: ThermostatAccessory.generateUUID,
      sameContext: ThermostatAccessory.sameContext,
      factory: function(platform: ScreenLogicPlatform, accessory: PlatformAccessory) {
        return new ThermostatAccessory(platform, accessory)
      },
    }
  }

  static generateUUID(platform: ScreenLogicPlatform, context: ThermostatAccessoryContext): string {
    return platform.generateUUID('switch:' + context.displayName)
  }

  public static sameContext(a: ThermostatAccessoryContext, b: ThermostatAccessoryContext): boolean {
    return (
      a.displayName === b.displayName &&
      a.bodyType === b.bodyType &&
      a.minSetPoint === b.minSetPoint &&
      a.maxSetPoint === b.maxSetPoint
    )
  }

  private service: Service

  constructor(
    private readonly platform: ScreenLogicPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    const accessoryInfo = platform.accessoryInfo()
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, accessoryInfo.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, accessoryInfo.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessoryInfo.serialNumber)

    // get the Thermostat service if it exists, otherwise create a new Thermostat service
    this.service =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat)

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.context.displayName)

    // register handlers for the TargetTemperature Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on('set', this.setTargetTemperature.bind(this))

    // register handlers for the TargetTemperature Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on('set', this.setTargetHeatingCoolingState.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature).setProps({
      format: Formats.FLOAT,
      minValue: this.context.minSetPoint,
      maxValue: this.context.maxSetPoint,
    })

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature).setProps({
      format: Formats.FLOAT,
      minValue: -18,
      maxValue: 60,
    })

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits).setValue(1)

    // trigger refresh if needed when HomeKit asks for this value
    this.platform.triggersRefreshIfNeded(
      this.service,
      this.platform.Characteristic.CurrentTemperature,
    )

    // trigger refresh if needed when HomeKit asks for this value
    this.platform.triggersRefreshIfNeded(
      this.service,
      this.platform.Characteristic.TargetTemperature,
    )
  }

  public get UUID(): string {
    return this.accessory.UUID
  }

  private get context(): ThermostatAccessoryContext {
    return this.accessory.context as ThermostatAccessoryContext
  }

  setTargetTemperature(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setTargetTemperature:', value, this.context)
    this.platform.setTargetTemperature(this.context, value as number)
    callback(null, value)
  }

  setTargetHeatingCoolingState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setTargetHeatingCoolingState:', value, this.context)
    this.platform.setTargetHeatingCoolingState(this.context, value as number)
    callback(null, value)
  }

  public updateCurrentTemperature(temperature: number) {
    this.platform.log.debug('updateCurrentTemperature:', temperature, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature)
  }

  public updateTargetTemperature(temperature: number) {
    // clamp the value
    temperature = Math.min(
      Math.max(this.context.minSetPoint + 0.1, temperature),
      this.context.maxSetPoint - 0.1,
    )
    this.platform.log.debug('updateTargetTemperature:', temperature, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, temperature)
  }

  public updateCurrentHeatingCoolingState(state: number) {
    this.platform.log.debug('updateCurrentHeatingCoolingState:', state, this.context)
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHeatingCoolingState,
      state,
    )
  }

  public updateTargetHeatingCoolingState(state: number) {
    this.platform.log.debug('updateTargetHeatingCoolingState:', state, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, state)
  }
}
