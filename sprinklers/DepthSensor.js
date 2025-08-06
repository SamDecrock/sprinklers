const io = require('socket.io-client');
const EventEmitter = require('events');

class DepthSensor extends EventEmitter {
  constructor(config) {
    super();
    if (!config || !config.socketUrl) {
      throw new Error('DepthSensor requires socketUrl configuration');
    }
    this.config = config;
    this.socket = null;
    this.currentDepth = null;
    this.previousDepth = null;
  }


  connect() {
    if (this.socket) return;

    this.socket = io(this.config.socketUrl);
    this.setupSocketListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  setupSocketListeners() {
    this.socket.on('depth', (data) => {
      this.previousDepth = this.currentDepth;
      this.currentDepth = data.depth;

      data.previousDepth = this.previousDepth;
      this.emit('depth', data);
    });
  }
}

module.exports = DepthSensor;