'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

  async onPairListDevices() {
    const discoveryStrategy = this.getDiscoveryStrategy();
    const discoveryResults = discoveryStrategy.getDiscoveryResults();

    return Object.values(discoveryResults).map(discoveryResult => {
      return {
        name: discoveryResult.name,
        data: {
          id: discoveryResult.id
        },
        store: {
          address: discoveryResult.address,
          port: discoveryResult.port
        }
      };
    });
  }

}

module.exports = Driver;
