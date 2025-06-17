class SprinklerController {
  constructor(sprinklers, polaritySwither, sequence) {
    this.sprinklers = sprinklers;
    this.polaritySwither = polaritySwither;
    this.sequence = sequence;

    this.isSprinkling = false;
    this.sequenceIndex = 0;
    this.timeout = null;
    this.remainingTime = 0; // Track remaining time for interrupted sprinklers

    this.totalSprinkleLog = []; // { timestamp: Date, onTime: Number }
  }

  async start() {
    if (this.isSprinkling || this.sequence.length === 0) return;
    this.isSprinkling = true;

    const { index } = this.sequence[this.sequenceIndex];
    const sprinkler = this.sprinklers[index];

    await sprinkler.on();

    // Use remaining time if it exists, otherwise use full sprinkler time
    const sprinklerTime = this.remainingTime > 0 ? this.remainingTime : this.sequence[this.sequenceIndex].sprinklerTime * 60 * 1000;
    this.timeout = setTimeout(() => this.stop(), sprinklerTime);
  }

  async stop() {
    if (!this.isSprinkling) return;
    this.isSprinkling = false;

    const { index } = this.sequence[this.sequenceIndex];
    const sprinkler = this.sprinklers[index];

    await sprinkler.off();

    this.addOnTime(sprinkler.onTime);

    // Clear the timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    // Calculate remaining time if we were interrupted
    if (this.remainingTime > 0) {
      this.remainingTime = 0; // Reset remaining time since we completed the cycle
    }

    this.sequenceIndex = (this.sequenceIndex + 1) % this.sequence.length;

    await this.polaritySwither.off();

    // Wait 5 seconds before starting the next sprinkler
    setTimeout(() => this.start(), 5000);
  }

  async pause() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.isSprinkling) {
      const { index } = this.sequence[this.sequenceIndex];
      const sprinkler = this.sprinklers[index];

      // Calculate remaining time before stopping
      const elapsedTime = Date.now() - sprinkler.lastOnTime;
      const totalTime = this.sequence[this.sequenceIndex].sprinklerTime * 60 * 1000;
      this.remainingTime = Math.max(0, totalTime - elapsedTime);
      console.log(`Pausing sprinkler ${sprinkler.name} with ${Math.round(this.remainingTime/1000)} seconds remaining`);

      await sprinkler.off();
      await this.polaritySwither.off();

      this.addOnTime(sprinkler.onTime);
    }

    this.isSprinkling = false;
  }

  async resume() {
    if (!this.isSprinkling) {
      console.log(`Resuming sprinkler with ${Math.round(this.remainingTime/1000)} seconds remaining`);
      this.start();
    }
  }

  addOnTime(onTime) {
    this.totalSprinkleLog.push({ timestamp: Date.now(), onTime: onTime / 1000.0 / 60.0 });
  }

  async restart() {
    await this.pause();
    this.sequenceIndex = 0;
    this.start();
  }

  cleanLog() {
    const now = Date.now();
    this.totalSprinkleLog = this.totalSprinkleLog.filter(
      entry => now - entry.timestamp < 24 * 60 * 60 * 1000
    );
  }

  getTotalMinutesLast24h() {
    this.cleanLog();
    const totalMinutes = this.totalSprinkleLog.reduce((sum, entry) => sum + entry.onTime, 0);
    return Math.round(totalMinutes*100)/100;
  }

  getIsRunningSchedule() {
    return this.isSprinkling;
  }

  async setSprinklerState(gpioPin, state) {
    const sprinkler = this.sprinklers.find(s => s.gpioPin == gpioPin);
    if (!sprinkler) {
      throw new Error(`Sprinkler with GPIO ${gpioPin} not found`);
    }

    if (state === 'on') {
      await sprinkler.on();
    } else if (state === 'off') {
      await sprinkler.off();
      this.addOnTime(sprinkler.onTime);
    }

    return sprinkler.toObject();
  }
}

module.exports = SprinklerController;
