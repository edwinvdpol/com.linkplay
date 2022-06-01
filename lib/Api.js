'use strict';

const Request = require('./Request');
const {SimpleClass} = require('homey');

class Api extends SimpleClass {

  constructor(device) {
    super();
    this.reset();

    this.address = device.getStoreValue('address');
    this.device = device;
  }

  // Cleanup
  cleanup() {
    this.log('[API] Cleanup');
    this.reset();
  }

  // Health check
  async healthCheck() {
    try {
      const status = await this.call(`getPlayerStatus`);

      this.emit('UpdateReceived', status, false);
    } catch (err) {
      throw new Error(`[API] Health check failed: ${err.message}`);
    }
  }

  // Reset
  reset() {
    this.address = null;
    this.device = null;
  }

  // Sync status
  async syncStatus() {
    this.emit('Status', await this.call(`getStatusEx`));
  }

  // Make an API call
  async call(command) {
    const type = command.substring(0, 3) === 'set' ? 'text' : 'json';

    const url = `http://${this.address}/httpapi.asp?command=${command}`;

    const request = new Request();
    const result = await request.fetch({url, type});

    // Check for error in response
    await this.checkError(result);

    return result;
  }

  // Check for error in response
  checkError = result => {
    if (result === 'unknown command') {
      throw new Error(this.device.homey.__('api.unknownCommand'));
    }
  };

}

module.exports = Api;
