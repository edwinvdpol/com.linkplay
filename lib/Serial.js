'use strict';

const net = require('net');
const {SimpleClass} = require('homey');

class Serial extends SimpleClass {

  constructor(device) {
    super();
    this.reset();

    this.device = device;
  }

  // Cleanup
  cleanup() {
    if (this.device) {
      this.device.log('[Serial] Cleanup');
    }

    this.disconnect();
    this.removeAllListeners();
    this.reset();
  }

  // Connect
  connect() {
    if (this.socket || !this.device) {
      return;
    }

    this.device.log('[Serial] Connect');

    const address = this.device.getStoreValue('address');
    const port = this.device.getStoreValue('uart_port') ?? 8899;

    let socket = new net.Socket();
    socket.connect(port, address);

    this.socket = socket;

    this.registerEventListeners();
  }

  // Disconnect
  disconnect() {
    if (!this.socket) {
      return;
    }

    if (this.device) {
      this.device.log('[Serial] Disconnect');
    }

    this.socket.destroy();
    this.socket = null;
  }

  // Health check
  async healthCheck() {
    if (!this.socket) {
      throw new Error('[Serial] Socket not found.');
    }

    if (this.socket.readyState !== 'open' && this.socket.readyState !== 'readOnly') {
      throw new Error(`[Serial] Invalid socket state: '${this.socket.readyState}'.`);
    }
  }

  // Connection closed
  onClosed() {
    if (this.device) {
      this.device.log('[Serial] Connection closed.');
    }

    this.socket = null;
  }

  // Data received
  onData(data) {
    if (!this.device) {
      return;
    }

    const message = data.toString().replace(/[^\x20-\x7E]/g, '').trim();
    const last = message.substring(message.length - 1);

    this.device.log('[Serial] Received:', message);

    // Play mode
    if (message.includes('AXX+PLP+00')) {
      this.emit('UpdateReceived', this.device.parsePlayMode(last));
    }

    // Player status
    if (message.includes('AXX+PLY+INF')) {
      this.emit('UpdateReceived', this.parseJson(message));
    }

    // Playing
    if (message.includes('AXX+PLY+00')) {
      this.emit('UpdateReceived', {playing: last === '1'});
    }
  }

  // Player status command
  playerStatus() {
    this.send('MCU+PINFGET');
  }

  // Parse JSON message
  parseJson(message) {
    const data = message.substring(
      message.indexOf('{') + 1,
      message.lastIndexOf('}')
    ).trim();

    return JSON.parse(`{${data}}`);
  }

  // Register event listeners
  registerEventListeners() {
    this.socket.on('close', this.onClosed.bind(this));
    this.socket.on('data', this.onData.bind(this));
  }

  // Reset
  reset() {
    this.device = null;
    this.socket = null;
  }

  // Send command
  send(command) {
    if (!this.socket) {
      return;
    }

    // let command = 'MCU+PAS+RAKOIT:LED:1&';
    const cmdBuf = Buffer.from(command);
    const lencBuf = Buffer.alloc(4);

    lencBuf.writeUInt16LE(command.length, 0);

    let header = Buffer.from([0x18, 0x96, 0x18, 0x20]);
    let checksum = Buffer.from([0xc1, 0x02, 0x00, 0x00]);
    let reserved = Buffer.alloc(8);

    const totalLength = header.length + lencBuf.length + checksum.length + reserved.length + cmdBuf.length;
    let newBuffer = Buffer.concat([header, lencBuf, checksum, reserved, cmdBuf], totalLength);

    return this.socket.write(newBuffer);
  }

}

module.exports = Serial;
