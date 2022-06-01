'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const Api = require('./Api');
const Remote = require('./Remote');
const Serial = require('./Serial');

class Device extends Homey.Device {

  // Cleanup
  cleanup(type = 'normal') {
    this.log('Cleanup device');

    this.removeAllEventListeners();

    // Cleanup health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Cleanup API
    if (this.api) {
      this.api.cleanup();
    }

    // Cleanup remote
    if (this.remote) {
      this.remote.cleanup();
    }

    // Cleanup serial
    if (this.serial) {
      this.serial.cleanup();
    }

    if (type !== 'delete') {
      this.reset();
    }
  }

  async onInit() {
    this.log('onInit');

    this.registerCapabilityListeners();
  }

  async onDeleted() {
    this.log('onDeleted');

    this.cleanup('delete');
  }

  onDiscoveryResult(discoveryResult) {
    this.log('onDiscoveryResult', discoveryResult.id);

    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult) {
    if (this.device) {
      return;
    }

    this.log('onDiscoveryAvailable', `${discoveryResult.address}:${discoveryResult.port}`);

    this.storeDiscoveryResultData(discoveryResult).catch(this.error);
  }

  onDiscoveryAddressChanged(discoveryResult) {
    this.log('onDiscoveryAddressChanged', `${discoveryResult.address}:${discoveryResult.port}`);

    this.storeDiscoveryResultData(discoveryResult).catch(this.error);
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    this.log('onDiscoveryLastSeenChanged', `${discoveryResult.address}:${discoveryResult.port}`);

    this.storeDiscoveryResultData(discoveryResult).catch(this.error);
  }

  async storeDiscoveryResultData(discoveryResult) {
    this.setStoreValue('address', discoveryResult.address).catch(this.error);
    this.setStoreValue('port', discoveryResult.port).catch(this.error);

    this.cleanup();

    this.device = this;

    await this.setup();
  }

  // Spreaker next capability changed
  async onCapabilitySpeakerNext() {
    this.log('onCapabilitySpeakerNext');

    await this.setPlayer('next');
  }

  // Spreaker playing capability changed
  async onCapabilitySpeakerPlaying(playing) {
    this.log('onCapabilitySpeakerPlaying', playing);

    if (playing) {
      await this.setPlayer('resume');
    } else {
      await this.setPlayer('pause');
    }
  }

  // Spreaker previous capability changed
  async onCapabilitySpeakerPrev() {
    this.log('onCapabilitySpeakerPrev');

    await this.setPlayer('prev');
  }

  // Spreaker shuffle capability changed
  async onCapabilitySpeakerShuffle(shuffle) {
    this.log('onCapabilitySpeakerShuffle', shuffle);

    const repeat = this.getCapabilityValue('speaker_repeat');

    await this.setPlayer('loopmode', this.getPlayMode(shuffle, repeat));
  }

  // Spreaker repeat capability changed
  async onCapabilitySpeakerRepeat(repeat) {
    this.log('onCapabilitySpeakerRepeat', repeat);

    const shuffle = this.getCapabilityValue('speaker_shuffle');

    await this.setPlayer('loopmode', this.getPlayMode(shuffle, repeat));
  }

  // Volume down capability changed
  async onCapabilityVolumeDown() {
    this.log('onCapabilityVolumeMute');

    const current = this.getCapabilityValue('volume_set');
    let prev = current - 0.01;

    if (prev < 0) {
      prev = 0.00;
    }

    const value = Math.round(prev * 100);

    this.log(`Volume down (${value}/100)`);

    await this.setPlayer('vol', value);

    this.setCapabilityValue('volume_set', prev).catch(this.error);
  }

  // Volume mute capability changed
  async onCapabilityVolumeMute(mute) {
    this.log('onCapabilityVolumeMute', mute);

    await this.setPlayer('mute', mute ? '1' : '0');
  }

  // Set volume capability changed
  async onCapabilityVolumeSet(volume) {
    this.log('onCapabilityVolumeSet', volume);

    const actual = Math.round(volume * 100);

    await this.setPlayer('vol', actual);
  }

  // Volume up capability changed
  async onCapabilityVolumeUp() {
    this.log('onCapabilityVolumeUp');

    const current = this.getCapabilityValue('volume_set');
    let next = current + 0.01;

    if (next > 1) {
      next = 1;
    }

    const value = Math.round(next * 100);

    this.log(`Volume up (${value}/100)`);

    await this.setPlayer('vol', value);

    this.setCapabilityValue('volume_set', next).catch(this.error);
  }

  // API status event
  onStatus(data) {
    this.log('onStatus', JSON.stringify(data));

    if (data.hasOwnProperty('uart_pass_port')) {
      this.setStoreValue('uart_port', data.uart_pass_port).catch(this.error);
    }

    let settings = {};

    if (data.hasOwnProperty('firmware')) {
      settings.firmware = data.firmware;
    }

    this.setSettings(settings).catch(this.error);
  }

  // Return play mode / loop
  getPlayMode(shuffle, repeat) {
    if (shuffle) {
      if (repeat === 'playlist') {
        return '2';
      }

      if (repeat === 'none') {
        return '3';
      }

      if (repeat === 'track') {
        return '5';
      }
    }

    if (repeat === 'playlist') {
      return '0';
    }

    if (repeat === 'none') {
      return '4';
    }

    if (repeat === 'track') {
      return '1';
    }

    return '0';
  }

  // Health check
  async healthCheck() {
    await this.healthCheckAPI();
    await this.healthCheckRemote();
    await this.healthCheckSerial();
  }

  // API health check
  async healthCheckAPI() {
    try {
      if (this.api) {
        await this.api.healthCheck();
      } else {
        await this.setupApi();
      }
    } catch (err) {
      this.error(err.message);

      if (this.api) {
        this.api.cleanup();
      }

      this.api = null;
    }
  }

  // Remote health check
  async healthCheckRemote() {
    try {
      if (this.remote) {
        await this.remote.healthCheck();
      } else {
        await this.setupRemote();
      }
    } catch (err) {
      this.error(err.message);

      if (this.remote) {
        this.remote.cleanup();
      }

      this.remote = null;
    }
  }

  // Serial health check
  async healthCheckSerial() {
    try {
      if (this.serial) {
        await this.serial.healthCheck();
      } else {
        await this.setupSerial();
      }
    } catch (err) {
      this.error(err.message);

      if (this.serial) {
        this.serial.cleanup();
      }

      this.serial = null;
    }
  }

  // Parse play mode / loop
  parsePlayMode(number) {
    let repeat = 'none';

    if (['3', '4'].includes(number)) {
      repeat = 'none';
    } else if (['1', '5'].includes(number)) {
      repeat = 'track';
    } else if (['0', '2'].includes(number)) {
      repeat = 'playlist';
    }

    const shuffle = ['2', '3', '5'].includes(number);

    return {shuffle, repeat};
  }

  // Register API event listeners
  registerApiEventListeners() {
    this.log('registerApiEventListeners');

    this.api.on('Status', this.onStatus.bind(this));
    this.api.on('UpdateReceived', this.setCapabilities.bind(this));
  }

  // Register capability listeners
  registerCapabilityListeners() {
    // When speaker next ...
    if (this.hasCapability('speaker_next')) {
      this.registerCapabilityListener('speaker_next', this.onCapabilitySpeakerNext.bind(this));
    }

    // When speaker starts / stops playing ...
    if (this.hasCapability('speaker_playing')) {
      this.registerCapabilityListener('speaker_playing', this.onCapabilitySpeakerPlaying.bind(this));
    }

    // When speaker previous ...
    if (this.hasCapability('speaker_prev')) {
      this.registerCapabilityListener('speaker_prev', this.onCapabilitySpeakerPrev.bind(this));
    }

    // When speaker repeat ...
    if (this.hasCapability('speaker_repeat')) {
      this.registerCapabilityListener('speaker_repeat', this.onCapabilitySpeakerRepeat.bind(this));
    }

    // When speaker shuffle ...
    if (this.hasCapability('speaker_shuffle')) {
      this.registerCapabilityListener('speaker_shuffle', this.onCapabilitySpeakerShuffle.bind(this));
    }

    // When volume down ...
    if (this.hasCapability('volume_down')) {
      this.registerCapabilityListener('volume_down', this.onCapabilityVolumeDown.bind(this));
    }

    // When volume mute is set to ...
    if (this.hasCapability('volume_mute')) {
      this.registerCapabilityListener('volume_mute', this.onCapabilityVolumeMute.bind(this));
    }

    // When volume set to ...
    if (this.hasCapability('volume_set')) {
      this.registerCapabilityListener('volume_set', this.onCapabilityVolumeSet.bind(this));
    }

    // When volume up ...
    if (this.hasCapability('volume_up')) {
      this.registerCapabilityListener('volume_up', this.onCapabilityVolumeUp.bind(this));
    }
  }

  // Register remote event listeners
  registerRemoteEventListeners() {
    this.log('registerRemoteEventListeners');

    this.remote.client.on('UpdateReceived', this.setCapabilities.bind(this));
  }

  // Register serial event listeners
  registerSerialEventListeners() {
    this.log('registerSerialEventListeners');

    this.serial.on('UpdateReceived', this.setCapabilities.bind(this));
  }

  // Remove all event listeners
  removeAllEventListeners() {
    this.log('removeAllEventListeners');

    // API listeners
    if (this.api) {
      this.api.removeAllListeners('Status');
      this.api.removeAllListeners('UpdateReceived');
    }

    // Remote client listeners
    if (this.remote) {
      this.remote.client.removeAllListeners('UpdateReceived');
    }

    // Serial listeners
    if (this.serial) {
      this.serial.removeAllListeners('UpdateReceived');
    }
  }

  // Reset
  reset() {
    this.resetCapabilityValues();

    this.api = null;
    this.remote = null;
    this.serial = null;
    this.device = null;
    this.healthCheckTimer = null;
  }

  // Reset all capability values
  resetCapabilityValues() {
    this.setCapabilityValue('speaker_album', null).catch(this.error);
    this.setCapabilityValue('speaker_artist', null).catch(this.error);
    this.setCapabilityValue('speaker_duration', 0).catch(this.error);
    this.setCapabilityValue('speaker_playing', false).catch(this.error);
    this.setCapabilityValue('speaker_position', 0).catch(this.error);
    this.setCapabilityValue('speaker_shuffle', false).catch(this.error);
    this.setCapabilityValue('speaker_repeat', 'none').catch(this.error);
    this.setCapabilityValue('speaker_track', null).catch(this.error);
  }

  setAlbumArt(url) {
    // No URL
    if (!url || url === 'un_known') {
      return;
    }

    // Secure URL
    if (url.includes('https://')) {
      this.albumArt.setUrl(url);
    }

    // Not secure URL
    if (url.includes('http://')) {
      this.albumArt.setStream(async (stream) => {
        const res = await fetch(url);
        if (res.ok) {
          return res.body.pipe(stream);
        }
      });
    }

    this.albumArt.update().catch(this.error);
  }

  // Set capabilities
  setCapabilities(data, log = true) {
    if (log) {
      this.log('setCapabilities', JSON.stringify(data));
    }

    // Player mode
    if (data.hasOwnProperty('mode')) {
      const mode = parseInt(data.mode);

      // Idle
      if (mode === 0) {
        this.resetCapabilityValues();

        return;
      }
    }

    // Speaker shuffle and repeat (player status)
    if (data.hasOwnProperty('loop')) {
      const modes = this.parsePlayMode(data.loop);

      data.repeat = modes.repeat;
      data.shuffle = modes.shuffle;
    }

    // Player status
    if (data.hasOwnProperty('status')) {
      data.playing = data.status === 'play';
    }

    // Volume (short)
    if (data.hasOwnProperty('vol')) {
      data.volume = data.vol;
    }

    // Speaker album
    if (data.hasOwnProperty('album') && this.hasCapability('speaker_album')) {
      this.setCapabilityValue('speaker_album', data.album).catch(this.error);
    }

    // Album art
    if (data.hasOwnProperty('albumArtURI') && this.albumArt) {
      this.setAlbumArt(data.albumArtURI);
    }

    // Speaker artist
    if (data.hasOwnProperty('artist') && this.hasCapability('speaker_artist')) {
      this.setCapabilityValue('speaker_artist', data.artist).catch(this.error);
    }

    // Speaker duration
    if (data.hasOwnProperty('totlen') && this.hasCapability('speaker_duration')) {
      this.setCapabilityValue('speaker_duration', Math.ceil(Number(data.totlen / 1000))).catch(this.error);
    }

    // Speaker playing
    if (data.hasOwnProperty('playing') && this.hasCapability('speaker_playing')) {
      this.setCapabilityValue('speaker_playing', data.playing).catch(this.error);
    }

    // Speaker position
    if (data.hasOwnProperty('curpos') && this.hasCapability('speaker_position')) {
      this.setCapabilityValue('speaker_position', Math.ceil(Number(data.curpos / 1000))).catch(this.error);
    }

    // Speaker repeat
    if (data.hasOwnProperty('repeat') && this.hasCapability('speaker_repeat')) {
      this.setCapabilityValue('speaker_repeat', data.repeat).catch(this.error);
    }

    // Speaker shuffle
    if (data.hasOwnProperty('shuffle') && this.hasCapability('speaker_shuffle')) {
      this.setCapabilityValue('speaker_shuffle', data.shuffle).catch(this.error);
    }

    // Speaker track
    if (data.hasOwnProperty('title') && this.hasCapability('speaker_track')) {
      this.setCapabilityValue('speaker_track', data.title).catch(this.error);
    }

    // Volume mute
    if (data.hasOwnProperty('mute') && this.hasCapability('volume_mute')) {
      this.setCapabilityValue('volume_mute', !!+data.mute).catch(this.error);
    }

    // Volume set
    if (data.hasOwnProperty('volume') && this.hasCapability('volume_set')) {
      this.setCapabilityValue('volume_set', data.volume / 100).catch(this.error);
    }

    // Set available
    if (!this.getAvailable()) {
      this.setAvailable().catch(this.error);
    }
  }

  // Health check timer
  async setHealhCheckTimer(seconds = 0) {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);

      this.healthCheckTimer = null;

      this.log('Healh check timer stopped');
    }

    if (seconds === 0) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.healthCheck();
    }, (seconds * 1000));

    this.log(`Health check timer set to ${seconds} seconds`);
  }

  async setPlayer(action, value = null) {
    try {
      if (value) {
        action += `:${value}`;
      }

      return this.api.call(`setPlayerCmd:${action}`, value);
    } catch (err) {
      this.error(err);
      this.setUnavailable(err.message).catch(this.error);
    }
  }

  // Setup device
  async setup() {
    this.log('Setup services');

    // Setup album art image
    this.albumArt = await this.homey.images.createImage();
    this.setAlbumArtImage(this.albumArt).catch(this.error);

    // Setup services
    this.setupApi().catch(this.error);
    this.setupRemote().catch(this.error);
    this.setupSerial().catch(this.error);

    // Start health check
    await this.setHealhCheckTimer(5);
  }

  // Setup API
  async setupApi() {
    this.log('setupApi');

    this.api = new Api(this.device);

    this.registerApiEventListeners();

    await this.api.syncStatus();
  }

  // Setup remote
  async setupRemote() {
    this.log('setupRemote');

    this.remote = new Remote(this.device);

    this.registerRemoteEventListeners();

    await this.remote.connect();
    await this.remote.syncMediaInfo();
  }

  // Setup serial connection
  async setupSerial() {
    this.log('setupSerial');

    this.serial = new Serial(this.device);

    this.registerSerialEventListeners();

    this.serial.connect();
    this.serial.playerStatus();
  }
}

module.exports = Device;
