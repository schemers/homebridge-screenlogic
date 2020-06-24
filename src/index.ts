import { API } from 'homebridge'

import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import { ScreenLogicPlatform } from './platform'

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, ScreenLogicPlatform)
}
