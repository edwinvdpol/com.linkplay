'use strict';

function pad(v) {
  return (v < 10) ? '0' + v : v;
}

function formatTime(seconds) {

  let h = Math.floor(seconds / 3600);
  let m = Math.floor((seconds - (h * 3600)) / 60);
  let s = (seconds - (h * 3600) - (m * 60));

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function parseTime(time) {
  if (!time) {
    return 0;
  }

  const parts = time.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function getProtocols(str) {
  const protocols = str.split(',');
  const result = [];

  protocols.forEach(protocol => {
    if (!protocol) {
      return;
    }

    const p = protocol.split(':');
    result.push({
      protocol: p[0],
      network: p[1],
      contentFormat: p[2],
      additionalInfo: p[3]
    });
  });

  return result;
}

function parseProtocols({Source, Sink}) {
  return {
    source: getProtocols(Source),
    sink: getProtocols(Sink)
  };
}

module.exports = {
  formatTime,
  parseTime,
  parseProtocols
};
