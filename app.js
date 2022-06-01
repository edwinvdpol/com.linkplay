'use strict';

const Homey = require('homey');

class LinkplayApp extends Homey.App {

  async onInit() {
    this.log('Linkplay has been initialized');
  }

}

module.exports = LinkplayApp;
