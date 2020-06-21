import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge'

import { HunterDouglasPlatform } from './platform'

export type ShadeAccessoryContext = Record<
  'displayName' | 'shadeId' | 'roomId' | 'shadeFeatureId',
  string
>

/**
 * Shade Accessory
 */
export class ShadeAccessory {
  private service: Service

  static generateUUID(platform: HunterDouglasPlatform, context: ShadeAccessoryContext): string {
    return platform.generateUUID(context.roomId + ':' + context.shadeId)
  }

  public static sameContext(a: ShadeAccessoryContext, b: ShadeAccessoryContext): boolean {
    return (
      a.displayName === b.displayName &&
      a.shadeId === b.shadeId &&
      a.roomId === b.roomId &&
      a.shadeFeatureId === b.shadeFeatureId
    )
  }

  constructor(
    private readonly platform: HunterDouglasPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    const accessoryInfo = platform.accessoryInfo()
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, accessoryInfo.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, accessoryInfo.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessoryInfo.serialNumber)

    // get the WindowCovering service if it exists, otherwise create a new WindowCovering service
    this.service =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering)

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.context.displayName)

    // register handlers for the CurrentPosition Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .on('get', this.getCurrentPosition.bind(this))

    // register handlers for the TargetPosition Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on('set', this.setTargetPosition.bind(this))

    // update position state to stopped (and leave it there)
    this.service.updateCharacteristic(
      this.platform.Characteristic.PositionState,
      this.platform.Characteristic.PositionState.STOPPED,
    )
  }

  public get UUID(): string {
    return this.accessory.UUID
  }

  private get context(): ShadeAccessoryContext {
    return this.accessory.context
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setTargetPosition:', value, this.context)
    this.platform.setTargetPosition(this.context, value as number)
    callback(null, value)
  }

  /**
     * Handle the "GET" requests from HomeKit
     * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
     * 
     * GET requests should return as fast as possbile. A long delay here will result in
     * HomeKit being unresponsive and a bad user experience in general.
     * 
     * If your device takes time to respond you should update the status of your device
     * asynchronously instead using the `updateCharacteristic` method instead.
  
     * @example
     * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
     */
  getCurrentPosition(callback: CharacteristicGetCallback) {
    const value = this.platform.getShadeCurrentHomeKitPosition(this.context.shadeId)

    this.platform.log.debug('getCurrentPosition:', value, this.context)

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return

    if (value !== undefined) {
      callback(null, value)
    } else {
      callback(Error('unable to get CurrentPosition for ' + this.context.shadeId), undefined)
    }
  }

  public updateCurrentPosition(position: number) {
    this.platform.log.debug('updateCurrentPosition:', position, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, position)
  }

  public updateTargetPosition(position: number) {
    this.platform.log.debug('updateTargetPosition:', position, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, position)
  }
}
