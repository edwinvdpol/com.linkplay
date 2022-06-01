'use strict';

const fetch = require('node-fetch');
const {SimpleClass} = require('homey');

class Request extends SimpleClass {

  async fetch({url, type, options = {}}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 2000);

    let fetchOptions = Object.assign({}, {
      signal: controller.signal
    }, options);

    try {
      const res = await fetch(url, fetchOptions);

      // Check HTTP response
      await this.checkStatus(res);

      if (type === 'text') {
        return res.text();
      }

      if (type === 'json') {
        return res.json();
      }

      return res;
    } catch (err) {
      this.handleError(err);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Check response status
  checkStatus = res => {
    if (res.ok) {
      return res;
    }

    if (res.status === 400) {
      this.error('Bad request', JSON.stringify(res));
      throw new Error('api.badRequest');
    }

    if (res.status === 502 || res.status === 504) {
      this.error('Timeout', JSON.stringify(res));
      throw new Error('api.timeout');
    }

    if (res.status === 500) {
      this.error('Server error', JSON.stringify(res));
      throw new Error('api.error');
    }

    this.error('Unknown error', JSON.stringify(res));
    throw new Error('api.connection');
  };

  // Handle network errors
  handleError = err => {
    if (err.type === 'system') {
      throw new Error('api.connection');
    }

    if (err.type === 'aborted') {
      throw new Error('api.timeout');
    }

    if (err.type === 'invalid-json') {
      throw new Error('api.response');
    }

    throw new Error(err.message);
  };

}

module.exports = Request;
