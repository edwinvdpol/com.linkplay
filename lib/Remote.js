'use strict';

const Client = require('./upnp');
const {code: errorCode} = require('./upnp/error');
const {SimpleClass} = require('homey');

class Remote extends SimpleClass {

  constructor(device) {
    super();
    this.reset();

    this.device = device;
    this.client = new Client(device);
  }

  // Connect
  async connect() {
    this.device.log('[Remote] Connect');

    await this.client.connect();
  }

  // Cleanup
  cleanup() {
    this.device.log('[Remote] Cleanup');

    this.client.cleanup();
    this.reset();
  }

  // Health check
  async healthCheck() {
    if (!this.client) {
      throw new Error('[Remote] Client not found.');
    }

    if (!this.client.hasEventsServer()) {
      throw new Error('[Remote] Client has no events server.');
    }

    if (!this.client.hasSubscriptions()) {
      throw new Error('[Remote] Client has no subscriptions.');
    }
  }

  // Reset
  reset() {
    this.instanceId = 0;
    this.device = null;
    this.client = null;
  }

  async getMediaInfo() {
    return this.client.call('AVTransport', 'GetMediaInfo', {
      InstanceID: this.instanceId
    });
  }

  async syncMediaInfo() {
    const info = await this.getMediaInfo();

    this.client.handleStateUpdate({
      name: 'CurrentTrackMetaData',
      value: info.CurrentURIMetaData
    });
  }

}

module.exports = Remote;
