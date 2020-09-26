import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
} from 'homebridge'

import ScreenLogic from 'node-screenlogic'

import { ScreenLogicPlatform, AccessoryAdaptor } from './platform'

const setColorConfig = [
  { name: 'Pool Mode Party', cmd: ScreenLogic.LIGHT_CMD_COLOR_MODE_PARTY },
  { name: 'Pool Mode Romance', cmd: ScreenLogic.LIGHT_CMD_COLOR_MODE_ROMANCE },
  { name: 'Pool Mode Caribbean', cmd: ScreenLogic.LIGHT_CMD_COLOR_MODE_CARIBBEAN },
  { name: 'Pool Mode American', cmd: ScreenLogic.LIGHT_CMD_COLOR_MODE_AMERICAN },
  { name: 'Pool Mode Sunset', cmd: ScreenLogic.LIGHT_CMD_COLOR_MODE_SUNSET },
  { name: 'Pool Mode Royal', cmd: ScreenLogic.LIGHT_CMD_COLOR_MODE_ROYAL },
  { name: 'Pool Color Blue', cmd: ScreenLogic.LIGHT_CMD_COLOR_BLUE },
  { name: 'Pool Color Green', cmd: ScreenLogic.LIGHT_CMD_COLOR_GREEN },
  { name: 'Pool Color Red', cmd: ScreenLogic.LIGHT_CMD_COLOR_RED },
  { name: 'Pool Color White', cmd: ScreenLogic.LIGHT_CMD_COLOR_WHITE },
  { name: 'Pool Color Purple', cmd: ScreenLogic.LIGHT_CMD_COLOR_PURPLE },
]

export interface SetColorAccessoryContext {
  displayName: string
  id: number
}

export class SetColorAccessory {
  static makeAdaptor(): AccessoryAdaptor<SetColorAccessory> {
    return {
      generateUUID: SetColorAccessory.generateUUID,
      sameContext: SetColorAccessory.sameContext,
      factory: function(platform: ScreenLogicPlatform, accessory: PlatformAccessory) {
        return new SetColorAccessory(platform, accessory)
      },
    }
  }

  static generateUUID(platform: ScreenLogicPlatform, context: SetColorAccessoryContext): string {
    return platform.generateUUID('setcolor:' + context.displayName)
  }

  public static sameContext(a: SetColorAccessoryContext, b: SetColorAccessoryContext): boolean {
    return a.displayName === b.displayName && a.id === b.id
  }

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

    for (const colorConfig of setColorConfig) {
      if (!platform.config.disabledLightColors.includes(colorConfig.name)) {
        this.platform.log.info('adding enabled light color:', colorConfig.name)

        // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
        // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
        // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');
        const service =
          this.accessory.getService(colorConfig.name) ??
          this.accessory.addService(
            this.platform.Service.Switch,
            colorConfig.name,
            colorConfig.name,
          )

        // set the service name, this is what is displayed as the default name on the Home app
        service.setCharacteristic(this.platform.Characteristic.Name, colorConfig.name)

        // register handlers for the On Characteristic
        service
          .getCharacteristic(this.platform.Characteristic.On)
          .on('set', (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
            this.setOn(service, value, callback, colorConfig)
          })
      }
    }

    const servicesToRemove = this.accessory.services.filter(service => {
      if (service.UUID === this.platform.Service.Switch.UUID) {
        return platform.config.disabledLightColors.includes(service.displayName)
      } else {
        return false
      }
    })
    for (const service of servicesToRemove) {
      this.platform.log.info('removing disabled light color:', service.displayName)
      this.accessory.removeService(service)
    }
  }

  public get UUID(): string {
    return this.accessory.UUID
  }

  public get context(): SetColorAccessoryContext {
    return this.accessory.context as SetColorAccessoryContext
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(
    service: Service,
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
    colorConfig: { name: string; cmd: number },
  ) {
    this.platform.log.debug('setOn:', value, colorConfig)
    this.platform.sendLightCommand(this.context, colorConfig.cmd as number)
    callback(null, value)
    setTimeout(() => {
      service.updateCharacteristic(this.platform.Characteristic.On, false)
    }, 1000)
  }
}
