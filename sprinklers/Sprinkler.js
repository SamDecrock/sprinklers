const fs = require('fs')

const PULSE_TIME = 0.300;
const COOLDOWN_TIME = 0.200;  // after pulse has been sent, wait a bit so that a new instruction never overlaps.
// Else 2 pulses could be seen as one.
// In reality this is never a problem as sending 2 pulses to the same sprinkler without changing the polarity.
// has the same effect anyway.
// (Changing the polarity introduces a sleep time)
const POLARITY_PULSE_DELAY = 0.100 // time between setting polarity and giving pulse
const MINIMUM_DEPTH = 35; // minimum depth in cm before sprinkler can operate

class Sprinkler {

  constructor(polaritySwither, gpioPin, name, depthSensor) {
    this.polaritySwither = polaritySwither;
    this.gpioPin = gpioPin;
    this.name = name;
    this.depthSensor = depthSensor;

    this.onTime = 0;
    this.offTime = 0;

    this.lastOnTime = null;
    this.lastOffTime = null;

    this.simulate = false;
    if (!fs.existsSync('/sys/class/gpio/export')) {
      console.log('> Not on a Pi, simulating things ...');
      this.simulate = true;
      return;
    }

    const Gpio = require('onoff').Gpio;
    this.pin = new Gpio(gpioPin, 'out', { activeLow: true });
    this.pin.writeSync(0);
    this.state = 'off';

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
        if (currentDepth < MINIMUM_DEPTH) {
          console.log(`> Emergency turn off sprinkler '${this.name}' - depth (${currentDepth.toFixed(2)}cm) below minimum threshold (${MINIMUM_DEPTH}cm)`);
          this.off();
        }
      }
    }, 1000); // Check every second
  }

  async on() {
    console.log(`> Turning on sprinkler '${this.name}' (GPIO ${this.gpioPin})`);
    this.state = 'on';

    if (this.lastOffTime) {
      this.offTime = Date.now() - this.lastOffTime;
      this.lastOffTime = null;
    }
    this.lastOnTime = Date.now();
    this.onTime = 0;

    if (this.simulate) return;
    await this.polaritySwither.forward();
    await sleep(POLARITY_PULSE_DELAY); // make sure sure polarity is set well before giving pulse
    await this.pulse();
    await this.polaritySwither.off();
  }

  async off() {
    console.log(`> Turning off sprinkler '${this.name}' (GPIO ${this.gpioPin})`);
    this.state = 'off';

    if (this.lastOnTime) {
      this.onTime = Date.now() - this.lastOnTime;
      this.lastOnTime = null;
    }
    this.lastOffTime = Date.now();
    this.offTime = 0;

    if (this.simulate) return;
    await this.polaritySwither.reverse();
    await sleep(POLARITY_PULSE_DELAY); // make sure sure polarity is set well before giving pulse
    await this.pulse();
    await this.polaritySwither.off();
    if (this.gpioPin == 13) {
      // weird valve
      await sleep(1.000);
      await this.polaritySwither.reverse();
      await sleep(POLARITY_PULSE_DELAY);
      await this.pulse();
      await this.polaritySwither.off();

      await sleep(1.000);
      await this.polaritySwither.reverse();
      await sleep(POLARITY_PULSE_DELAY);
      await this.pulse();
      await this.polaritySwither.off();

      await sleep(1.000);
      await this.polaritySwither.reverse();
      await sleep(POLARITY_PULSE_DELAY);
      await this.pulse();
      await this.polaritySwither.off();

      await sleep(1.000);
      await this.polaritySwither.reverse();
      await sleep(POLARITY_PULSE_DELAY);
      await this.pulse();
      await this.polaritySwither.off();

      await sleep(1.000);
      await this.polaritySwither.reverse();
      await sleep(POLARITY_PULSE_DELAY);
      await this.pulse();
      await this.polaritySwither.off();
    }
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
      onTime: this.onTime / 1000,   // return in seconds
      offTime: this.offTime / 1000
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
