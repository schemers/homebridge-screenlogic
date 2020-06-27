import { Service, PlatformAccessory } from 'homebridge'

import { ScreenLogicPlatform, AccessoryAdaptor } from './platform'

export type TemperatureAccessoryContext = Record<'displayName' | 'type', string>

export class TemperatureAccessory {
  static makeAdaptor(): AccessoryAdaptor<TemperatureAccessory> {
    return {
      generateUUID: TemperatureAccessory.generateUUID,
      sameContext: TemperatureAccessory.sameContext,
      factory: function(platform: ScreenLogicPlatform, accessory: PlatformAccessory) {
        return new TemperatureAccessory(platform, accessory)
      },
    }
  }

  static generateUUID(platform: ScreenLogicPlatform, context: TemperatureAccessoryContext): string {
    return platform.generateUUID('temp:' + context.type)
  }

  public static sameContext(
    a: TemperatureAccessoryContext,
    b: TemperatureAccessoryContext,
  ): boolean {
    return a.displayName === b.displayName && a.type === b.type
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

    // get the TemperatureSensor service if it exists, otherwise create a new TemperatureSensor service
    this.service =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor)

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.context.displayName)

    // trigger refresh if needed when HomeKit asks for this value
    this.platform.triggersRefreshIfNeded(
      this.service,
      this.platform.Characteristic.CurrentTemperature,
    )
  }

  public get UUID(): string {
    return this.accessory.UUID
  }

  private get context(): TemperatureAccessoryContext {
    return this.accessory.context
  }

  public updateCurrentTemperature(temperature: number) {
    this.platform.log.debug('updateCurrentTemperature:', temperature, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature)
  }

  public updateStatusActive(active: boolean) {
    this.platform.log.debug('updateStatusActive:', active, this.context)
    this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, active)
  }
}
