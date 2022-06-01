'use strict';

const {XMLParser} = require('fast-xml-parser');

const code = {
  NO_SERVICE: 'NO_SERVICE',
  NO_ACTION: 'NO_ACTION',
  NO_EVENTS: 'NO_EVENTS',
  UPNP: 'UPNP',
  SUBSCRIBE: 'SUBSCRIBE',
  SUBSCRIBE_RENEW: 'SUBSCRIBE_RENEW',
  UNSUBSCRIBE: 'UNSUBSCRIBE'
};

function UPnPError(statusCode, xmlString) {
  const parser = new XMLParser();
  const envelope = parser.parse(xmlString);
  const error = envelope['s:Envelope']['s:Body']['s:Fault'].detail.UPnPError;
  const {errorCode, errorDescription} = error;
  const err = new Error(`(${errorCode}) ${errorDescription}`);

  err.code = code.UPNP;
  err.statusCode = statusCode;
  err.errorCode = errorCode;

  return err;
}

module.exports = {
  code,
  UPnPError
};
