import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface ApkUpdaterPlugin {
  downloadAndInstall(options: { url: string; version?: string }): Promise<void>;
  addListener(eventName: 'onProgress', listenerFunc: (info: { progress: number }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export default ApkUpdater;
