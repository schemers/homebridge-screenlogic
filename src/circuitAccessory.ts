import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
} from 'homebridge'

import { ScreenLogicPlatform, AccessoryAdaptor } from './platform'

export interface CircuitAccessoryContext {
  displayName: string
  id: number
}

export class CircuitAccessory {
  static makeAdaptor(): AccessoryAdaptor<CircuitAccessory> {
    return {
      generateUUID: CircuitAccessory.generateUUID,
      sameContext: CircuitAccessory.sameContext,
      factory: function(platform: ScreenLogicPlatform, accessory: PlatformAccessory) {
        return new CircuitAccessory(platform, accessory)
      },
    }
  }

  static generateUUID(platform: ScreenLogicPlatform, context: CircuitAccessoryContext): string {
    return platform.generateUUID('switch:' + context.displayName)
  }

  public static sameContext(a: CircuitAccessoryContext, b: CircuitAccessoryContext): boolean {
    return a.displayName === b.displayName && a.id === b.id
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

    // get the Switch service if it exists, otherwise create a new Switch service
    this.service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch)

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.context.displayName)

    // register handlers for the On Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On).on('set', this.setOn.bind(this))

    // trigger refresh if needed when HomeKit asks for this value
    this.platform.triggersRefreshIfNeded(this.service, this.platform.Characteristic.On)
  }

  public get UUID(): string {
    return this.accessory.UUID
  }

  public get context(): CircuitAccessoryContext {
    return this.accessory.context as CircuitAccessoryContext
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setOn:', value, this.context)
    this.platform.setCircuitState(this.context, value as boolean)
    callback(null, value)
  }

  public updateOn(on: boolean) {
    this.platform.log.debug('updateOn:', on, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.On, on)
  }
}
