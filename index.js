// const test = async () => {
//   const net = require('net');
//
//   let client = new net.Socket();
//
//   client.connect(8899, '192.168.1.190', () => {
//     console.log('Connected');
//
//     // let command = 'MCU+PAS+RAKOIT:LED:1&';
//     let command = 'MCU+PLP+002';
//     const cmdBuf = Buffer.from(command);
//     const lencBuf = Buffer.alloc(4);
//
//     lencBuf.writeUInt16LE(command.length, 0);
//
//     let header = Buffer.from([0x18, 0x96, 0x18, 0x20]);
//     let checksum = Buffer.from([0xc1, 0x02, 0x00, 0x00]);
//     let reserved = Buffer.alloc(8);
//
//     const totalLength = header.length + lencBuf.length + checksum.length + reserved.length + cmdBuf.length;
//     let newBuffer = Buffer.concat([header, lencBuf, checksum, reserved, cmdBuf], totalLength);
//
//     client.write(newBuffer);
//   });
//
//   client.on('data', function (data) {
//     const message = data.toString().replace(/[^\x20-\x7E]/g, '').trim();
//     console.log(message);
//
//     if (message.includes('AXX+VOL+')) {
//       console.log('volume', Number(message.substring(message.length - 3)));
//     }
//
//   });
//
//   client.on('close', function () {
//     console.log('Connection closed');
//   });
//
// };

// const test = async () => {
//   const UPnPRemote = require('./lib/remote');
//
//   const remote = new UPnPRemote({
//     url: 'http://192.168.1.190:59152/description.xml'
//   });
//
//   function onTransportState(data) {
//     console.log('onTransportState', data);
//   }
//
//   async function onVolume(volume) {
//     console.log('onVolume', volume);
//   }
//
//   const mediaInfo = await remote.getMediaInfo();
//   console.log(mediaInfo);
//
//   // await remote.client.start();
//   //
//   // console.log(await remote.client.getDeviceDescription());
//   // await remote.on('TransportState', onTransportState);
//   // await remote.on('Volume', onVolume);
// };

// test();

// const volume = await remote.getVolume();
// await remote.setVolume(volume + 1);
// await remote.off('Volume', volumeHandler);

const test = async () => {
  console.log('plm_support');
  let buf = Uint16Array.from([0x8016]);

  console.log(buf.toString());
  let bits = parseInt(buf.toString(), 10).toString(2);
  let rev = bits.split('').reverse().join('');

  console.log(bits);
  console.log(rev);
  console.log('');
  console.log('LineIn:' + rev[1]);
  console.log('Bluetooth:' + rev[2]);
  console.log('USB:' + rev[3]);
  console.log('Optical:' + rev[4]);
  console.log('Coaxial:' + rev[6]);
  console.log('LinIn 2:' + rev[8]);
  console.log('USBDAC:' + rev[15]);

  console.log('');
  console.log('');
  console.log('streams_all');
  let str = Uint16Array.from([0x7bff7ffe]);

  console.log(str.toString());
  let strbits = parseInt(buf.toString(), 10).toString(2);
  let strrev = strbits.split('').reverse().join('');

  console.log(strbits);
  console.log(strrev);
  console.log('');
  console.log('Airplay:' + rev[0]);
  console.log('DLNA:' + rev[1]);
  console.log('TTPod:' + rev[2]);
  console.log('Tunein:' + rev[3]);
  console.log('Pandora:' + rev[4]);
  console.log('DoubanFM:' + rev[5]);

  // "plm_support": "0x8016"
  // "streams_all": "0x7bff7ffe",
  //   "streams": "0x7b9831fe",

  // console.log(parseInt(buf.toString(), 16));
  // console.log(buf.readInt16LE());
  // console.log(buf.readInt16BE());
};

test();
