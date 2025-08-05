const fs = require('fs')

const PULSE_TIME = 0.150;
const COOLDOWN_TIME = 0.200;  // after pulse has been sent, wait a bit so that a new instruction never overlaps.
// Else 2 pulses could be seen as one.
// In reality this is never a problem as sending 2 pulses to the same sprinkler without changing the polarity.
// has the same effect anyway.
// (Changing the polarity introduces a sleep time)
const POLARITY_PULSE_DELAY = 0.100 // time between setting polarity and giving pulse
const MINIMUM_DEPTH = 38; // minimum depth in cm before sprinkler can operate

class Sprinkler {

  constructor(polaritySwither, gpioPin, name, depthSensor, desiredRunTime) {
    this.polaritySwither = polaritySwither;
    this.gpioPin = gpioPin;
    this.name = name;
    this.depthSensor = depthSensor;

    this.startedAt = null;
    this.runTime = 0;
    this.totalRunTime = 0;
    this.desiredRunTime = desiredRunTime;

    this.state = 'off';

    this.simulate = false;
    if (!fs.existsSync('/sys/class/gpio/export')) {
      console.log(`[${this.name}] Not on a Pi, simulating things ...`);
      this.simulate = true;
      return;
    }

    const Gpio = require('onoff').Gpio;
    this.pin = new Gpio(gpioPin, 'out', { activeLow: true });
    this.pin.writeSync(0);


    // Set up depth monitoring
    this._depthCheckInterval = null;
    this.setupDepthMonitoring();
  }

  setupDepthMonitoring() {
    if (this._depthCheckInterval) {
      clearInterval(this._depthCheckInterval);
    }

    this._depthCheckInterval = setInterval(() => {
      if (this.state === 'on' && this.depthSensor && this.depthSensor.currentDepth !== null) {
        const currentDepth = this.depthSensor.currentDepth;
        if (currentDepth <= MINIMUM_DEPTH) {
          console.log(`[${this.name} (${this.gpioPin})] Emergency turn off - depth (${currentDepth.toFixed(2)}cm) below minimum threshold (${MINIMUM_DEPTH}cm)`);
          this.off();
        }
      }
    }, 1000); // Check every second
  }

  async on() {
    console.log(`[${this.name}] on`);
    this.state = 'on';

    this.startedAt = Date.now();
    this.runTime = 0;

    if (this.simulate) return;
    await this.polaritySwither.forward();
    await sleep(POLARITY_PULSE_DELAY); // make sure sure polarity is set well before giving pulse
    await this.pulse();
    await this.polaritySwither.off();
  }

  resetTotalRunTime() {
    this.totalRunTime = 0;
  }

  async off() {
    console.log(`[${this.name}] off`);
    this.state = 'off';

    if (this.startedAt) {
      this.runTime = Date.now() - this.startedAt;
      this.totalRunTime += this.runTime;
      this.startedAt = null;
    }

    if (this.simulate) return;
    await this.polaritySwither.reverse();
    await sleep(POLARITY_PULSE_DELAY); // make sure sure polarity is set well before giving pulse
    await this.pulse();
    if (this.gpioPin == 13) {
      // newer valves need more pulses to turn off
      await this.pulse();
      await this.pulse();
    }
    await this.polaritySwither.off();
  }

  async pulse() {
    this.pin.writeSync(1);
    await sleep(PULSE_TIME);
    this.pin.writeSync(0);
    await sleep(COOLDOWN_TIME);
  }

  toObject() {
    return {
      id: '' + this.gpioPin,
      name: this.name,
      state: this.state,
      runTime: this.runTime / 1000   // return in seconds
    };
  }

  cleanup() {
    if (this._depthCheckInterval) {
      clearInterval(this._depthCheckInterval);
      this._depthCheckInterval = null;
    }
  }
}

module.exports = Sprinkler;
