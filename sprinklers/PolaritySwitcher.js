const fs = require('fs');

const BREAKER_TIME = 0.100;

class PolaritySwitcher {

  constructor(gpioBreakerPin, gpioPin1, gpioPin2) {
    this.simulate = false;
    if (!fs.existsSync('/sys/class/gpio/export')) {
      console.log('> Not on a Pi, simulating things ...');
      this.simulate = true;
      return;
    }

    this.isForward = true;
    const Gpio = require('onoff').Gpio;

    this.breakerPin = new Gpio(gpioBreakerPin, 'out', {activeLow: true});
    this.breakerPin.writeSync(0);
    this.pin1 = new Gpio(gpioPin1, 'out', {activeLow: true});
    this.pin1.writeSync(0);
    this.pin2 = new Gpio(gpioPin2, 'out', {activeLow: true});
    this.pin2.writeSync(0);
  }

  async forward() {
    if(this.isForward) {
      // console.log(`> Already in forward`);
      this.breakerPin.writeSync(1); // could be off because we just started
      return;
    }
    this.isForward = true;
    // console.log(`> Setting polarity to forward`);
    if(this.simulate) return;

    this.breakerPin.writeSync(0);
    await sleep(BREAKER_TIME);
    this.pin1.writeSync(0);
    this.pin2.writeSync(0);
    await sleep(BREAKER_TIME);
    this.breakerPin.writeSync(1);
  }

  async reverse() {
    if(!this.isForward) {
      // console.log(`> Already in reverse`);
      this.breakerPin.writeSync(1); // could be off because we just started
      return;
    }
    this.isForward = false;

    // console.log(`> Setting polarity to reverse`);
    if(this.simulate) return;

    this.breakerPin.writeSync(0);
    await sleep(BREAKER_TIME);
    this.pin1.writeSync(1);
    this.pin2.writeSync(1);
    await sleep(BREAKER_TIME);
    this.breakerPin.writeSync(1);
  }

  async off() {
    // console.log('> Turning off polarity switcher');
    if(this.simulate) return;
    this.breakerPin.writeSync(0);
    this.pin1.writeSync(0);
    this.pin2.writeSync(0);
    this.isForward = true;  // both 0 == isForward
  }

}

module.exports = PolaritySwitcher;
