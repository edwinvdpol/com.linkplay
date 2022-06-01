'use strict';

const http = require('http');
const {URL} = require('url');
const {XMLParser} = require('fast-xml-parser');

const concat = require('concat-stream');
const address = require('network-address');

const SUBSCRIPTION_TIMEOUT = 300;
const SUBSCRIPTION_TIMEOUT_MIN = 30;

const {
  parseDeviceDescription,
  parseServiceDescription,
  parseSOAPResponse,
  parseEvents,
  parseTimeout
} = require('./response');

const {createSOAPAction} = require('./request');
const {SimpleClass} = require('homey');
const Request = require('../Request');

class UPnPClient extends SimpleClass {

  constructor(device) {
    super();
    this.reset();

    this.device = device;
    this.stateUpdateHandler = this.handleStateUpdate.bind(this);
  }

  async call(serviceId, actionName, data) {
    serviceId = this.resolveService(serviceId);

    const description = await this.getServiceDescription(serviceId);
    const action = description.actions[actionName];

    if (!action) {
      throw new Error(this.device.homey.__('error.action', {action: actionName}));
    }

    const service = this.deviceDescription.services[serviceId];
    const SOAPAction = createSOAPAction(service, actionName, data);
    const request = new Request();

    const res = await request.fetch({
      url: service.controlURL,
      type: 'text',
      options: {
        method: 'POST',
        body: SOAPAction,
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'Content-Length': SOAPAction.length,
          Connection: 'close',
          SOAPACTION: `"${service.serviceType}#${actionName}"`
        }
      }
    });

    // if (!res.ok) {
    //   throw error.UPnPError(res.status, body);
    // }

    return parseSOAPResponse(res, actionName, action.outputs);
  }

  // Cleanup
  cleanup() {
    this.log('[Client] Cleanup');

    this.unsubscribe('AVTransport', this.stateUpdateHandler).catch(this.error);
    this.unsubscribe('RenderingControl', this.stateUpdateHandler).catch(this.error);

    this.removeAllListeners();
    this.stopEventsServer();
    this.reset();
  }

  // Connect
  async connect() {
    this.device.log('[Client] Connect');

    this.subscribe('AVTransport', this.stateUpdateHandler).catch(this.error);
    this.subscribe('RenderingControl', this.stateUpdateHandler).catch(this.error);
  }

  createEventsServer() {
    if (this.eventsServer) {
      return this.eventsServer;
    }

    this.device.log('[Client] Create events server');

    return http.createServer((req, res) => {
      req.pipe(concat(buf => this.onEventsServerRequest(req, buf)));
      res.statusCode = 200;
      res.end('OK');
    });
  }

  async getDeviceDescription() {
    if (!this.deviceDescription) {
      const request = new Request();

      const address = this.device.getStoreValue('address');
      const port = this.device.getStoreValue('port');

      const url = `http://${address}:${port}/description.xml`;
      const res = await request.fetch({url, type: 'text'});

      this.deviceDescription = parseDeviceDescription(res, url);
    }

    return this.deviceDescription;
  }

  async getEventsServer() {
    if (!this.eventsServer) {
      this.eventsServer = this.createEventsServer();
    }

    if (!this.eventsServer.listening) {
      await new Promise(resolve => {
        this.eventsServer.listen(0, address.ipv4(), resolve);
      });
    }

    return this.eventsServer;
  }

  async getServiceDescription(serviceId) {
    if (!await this.hasService(serviceId)) {
      throw new Error(this.device.homey.__('error.service', {service: serviceId}));
    }

    const service = this.deviceDescription.services[serviceId];

    if (!this.serviceDescriptions[serviceId]) {
      const request = new Request();
      const res = await request.fetch({url: service.SCPDURL, type: 'text'});

      this.serviceDescriptions[serviceId] = parseServiceDescription(res);
    }

    return this.serviceDescriptions[serviceId];
  }

  handleStateUpdate(e) {
    let name = e.name.toLowerCase();
    let data = {};

    if (e.name === 'CurrentTrackMetaData' || e.name === 'CurrentURIMetaData') {
      data = this.parseMetaData(e.value);
    } else {
      data[`${name}`] = e.value;
    }

    this.emit('UpdateReceived', data);
  }

  hasEventsServer() {
    return this.eventsServer !== null;
  }

  async hasService(serviceId) {
    serviceId = this.resolveService(serviceId);

    const description = await this.getDeviceDescription();

    return Boolean(description.services[serviceId]);
  }

  hasSubscriptions() {
    return Object.keys(this.subscriptions).length !== 0;
  }

  onEventsServerRequest(req, buf) {
    const {sid} = req.headers;
    const events = parseEvents(buf);
    const keys = Object.keys(this.subscriptions);
    const serviceId = keys.find(key => this.subscriptions[key].sid === sid);

    if (!serviceId) {
      return;
    }

    const listeners = this.subscriptions[serviceId].listeners;

    listeners.forEach(listener => events.forEach(e => listener(e)));
  }

  parseMetaData(xml) {
    try {
      let parser = new XMLParser();
      const parsed = parser.parse(xml);
      const track = parsed['DIDL-Lite'].item;

      return {
        'album': track['upnp:album'] ?? null,
        'albumArtURI': track['upnp:albumArtURI'] ?? null,
        'artist': track['upnp:artist'] ?? null,
        'title': track['dc:title'] ?? null
      };
    } catch (err) {
      return {
        'album': null,
        'albumArtURI': null,
        'artist': null,
        'title': null
      };
    }
  }

  async renewSubscription({url, sid, serviceId}) {
    const request = new Request();
    const res = await request.fetch({
      url,
      options: {
        method: 'SUBSCRIBE',
        headers: {
          HOST: url.host,
          SID: sid,
          TIMEOUT: `Second-${SUBSCRIPTION_TIMEOUT}`
        }
      }
    });

    if (!res.ok) {
      this.stopEventsServer();

      throw new Error(this.device.homey.__('error.renewal', {
        service: serviceId,
        status: res.status
      }));
    }

    const timeout = parseTimeout(res.headers.get('timeout'));
    const renewTimeout = Math.max(
      timeout - SUBSCRIPTION_TIMEOUT_MIN,
      SUBSCRIPTION_TIMEOUT_MIN
    );

    // Renew 30 seconds before expiration
    this.subscriptions[serviceId].timer = setTimeout(() =>
        this.renewSubscription({url, sid, serviceId}),
      renewTimeout * 1000
    );
  }

  // Reset
  reset() {
    this.device = null;
    this.deviceDescription = null;
    this.eventsServer = null;
    this.serviceDescriptions = {};
    this.subscriptions = {};
  }

  resolveService(serviceId) {
    return serviceId.includes(':')
      ? serviceId
      : `urn:upnp-org:serviceId:${serviceId}`;
  }

  stopEventsServer() {
    if (this.hasSubscriptions()) {
      return;
    }

    this.device.log('[Client] Stop events server');

    this.eventsServer.close();
    this.eventsServer = null;
  }

  async subscribe(serviceId, listener) {
    serviceId = this.resolveService(serviceId);

    const subs = this.subscriptions[serviceId];

    if (subs) {
      if (!subs.listeners.includes(listener)) {
        this.subscriptions[serviceId].listeners.push(listener);
      }

      return;
    }

    if (!await this.hasService(serviceId)) {
      throw new Error(this.device.homey.__('error.service', {service: serviceId}));
    }

    const request = new Request();
    const service = this.deviceDescription.services[serviceId];
    const server = await this.getEventsServer();
    const url = new URL(service.eventSubURL);

    const res = await request.fetch({
      url,
      options: {
        method: 'SUBSCRIBE',
        headers: {
          HOST: url.host,
          CALLBACK: `<http://${server.address().address}:${server.address().port}/>`,
          NT: 'upnp:event',
          TIMEOUT: `Second-${SUBSCRIPTION_TIMEOUT}`
        }
      }
    });

    if (!res.ok) {
      this.stopEventsServer();

      throw new Error(this.device.homey.__('error.subscribe', {
        service: serviceId,
        status: res.status
      }));
    }

    const sid = res.headers.get('sid');
    const timeout = res.headers.get('timeout');

    const renewTimeout = Math.max(
      parseTimeout(timeout) - SUBSCRIPTION_TIMEOUT_MIN,
      SUBSCRIPTION_TIMEOUT_MIN
    );

    const timer = setTimeout(() =>
        this.renewSubscription({url, sid, serviceId}),
      renewTimeout * 1000
    );

    this.subscriptions[serviceId] = {sid, url, timer, listeners: [listener]};
  }

  async unsubscribe(serviceId, listener) {
    serviceId = this.resolveService(serviceId);

    const subscription = this.subscriptions[serviceId];

    if (!subscription) {
      return;
    }

    const index = subscription.listeners.indexOf(listener);

    if (index === -1) {
      return;
    }

    subscription.listeners.splice(index, 1);

    if (subscription.listeners.length !== 0) {
      return;
    }

    clearTimeout(subscription.timer);

    const request = new Request();

    const res = await request.fetch({
      url: subscription.url,
      options: {
        method: 'UNSUBSCRIBE',
        headers: {
          HOST: subscription.url.host,
          SID: subscription.sid
        }
      }
    });

    if (!res.ok) {
      throw new Error(this.device.homey.__('error.unsubscribe', {
        service: serviceId,
        status: res.status
      }));
    }

    this.subscriptions[serviceId] = null;

    this.stopEventsServer();
  }

}

module.exports = UPnPClient;
