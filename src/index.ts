import { API } from 'homebridge'

import { PLATFORM_NAME } from './settings'
import { ScreenLogicPlatform } from './platform'

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform("homebridge-screenlogic", PLATFORM_NAME, ScreenLogicPlatform)
}
