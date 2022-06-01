const {parseTime} = require('../Util');

const toArray = value => value.split(',');

module.exports = {
  CurrentMediaDuration: parseTime,
  CurrentTrackDuration: parseTime,
  CurrentTransportActions: toArray,
  PossiblePlaybackStorageMedia: toArray
};
