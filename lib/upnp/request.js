'use strict';

const {XMLBuilder} = require('fast-xml-parser');
const parser = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@'
});

function getData(data) {
  if (!data) {
    return {};
  }

  return Object.keys(data).reduce((a, name) => {
    const value = data[name];
    if (value !== undefined) {
      a[name] = (value === null) ? '' : value.toString();
    }

    return a;
  }, {});
}

function createSOAPAction(service, actionName, data) {
  const envelope = {
    's:Envelope': {
      '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
      '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/',
      's:Body': {
        [`u:${actionName}`]: {
          '@xmlns:u': service.serviceType,
          ...getData(data)
        }
      }
    }
  }

  return parser.build(envelope);
}

module.exports = {
  createSOAPAction
}

