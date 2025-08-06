class Sprinklers {
  constructor(sprinklerSequence) {
    this.sprinklerSequence = sprinklerSequence;

    this.isSprinkling = false;
    this.currentSprinklerIndex = 0;

    this.remainingTime = 0; // Track remaining time for interrupted sprinklers

    this.totalSprinkleLog = []; // { timestamp: Date, onTime: Number }


    this.runTimer = null;
    this.waitForStartTimer = null;
  }

  async resume() {
    console.log(`[Sprinklers] resume`)
    if (this.isSprinkling) return;
    this.isSprinkling = true;

    const sprinkler = this.getCurrentSprinkler();
    const runTimeRemaining = sprinkler.desiredRunTime - sprinkler.totalRunTime;
    // in the very unlikely case that this is 0 or even lower than 0, continue with the next sprinkler:
    // this can happen more often if desiredRunTime is set 0
    if(runTimeRemaining <= 0) {
      sprinkler.resetTotalRunTime();
      this.isSprinkling = false;
      await this.continueWithNextSprinkler();
      return;
    }
    this.runTimer = setTimeout(() => this.desiredRunTimeEnded(), runTimeRemaining);
    console.log(`[Sprinklers] Turning ${sprinkler.name} on for ${(runTimeRemaining/1000.0/60.0).toFixed(2)} minutes`);
    await sprinkler.on();
  }

  async desiredRunTimeEnded() {
    console.log(`[Sprinklers] desiredRunTimeEnded`)
    this.clearTimers();
    if (!this.isSprinkling) return;
    this.isSprinkling = false;

    const sprinkler = this.getCurrentSprinkler();

    await sprinkler.off();
    this.logRunTime(sprinkler.runTime);
    sprinkler.resetTotalRunTime();

    // Wait 5 seconds before starting the next sprinkler
    this.waitForStartTimer = setTimeout(() => this.continueWithNextSprinkler(), 5000);
  }

  async continueWithNextSprinkler() {
    console.log(`[Sprinklers] continueWithNextSprinkler`)
    if (this.isSprinkling) return;
    this.isSprinkling = true;


    this.setNextSprinkler();
    const sprinkler = this.getCurrentSprinkler();
    console.log(`[Sprinklers] Turning ${sprinkler.name} on for ${(sprinkler.desiredRunTime/1000.0/60.0).toFixed(2)} minutes`);
    this.runTimer = setTimeout(() => this.desiredRunTimeEnded(), sprinkler.desiredRunTime);
    await sprinkler.on();
  }

  async pause() {
    console.log(`[Sprinklers] pause`)
    this.clearTimers();
    if (!this.isSprinkling) return;
    this.isSprinkling = false;

    const sprinkler = this.getCurrentSprinkler();
    await sprinkler.off();

    this.logRunTime(sprinkler.runTime);
  }

  clearTimers() {
    if (this.runTimer) {
      clearTimeout(this.runTimer);
      this.runTimer = null;
    }

    if(this.waitForStartTimer) {
      clearTimeout(this.waitForStartTimer);
      this.waitForStartTimer = null;
    }
  }

  getCurrentSprinkler() {
    return this.sprinklerSequence[this.currentSprinklerIndex];
  }

  setNextSprinkler() {
    this.currentSprinklerIndex = (this.currentSprinklerIndex + 1) % this.sprinklerSequence.length;
  }

  logRunTime(runTime) {
    this.totalSprinkleLog.push({ timestamp: Date.now(), runTime: runTime / 1000.0 / 60.0 });
  }

  async restart() {
    await this.pause();
    this.currentSprinklerIndex = 0;
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
    const totalMinutes = this.totalSprinkleLog.reduce((sum, entry) => sum + entry.runTime, 0);
    return Math.round(totalMinutes*100)/100;
  }
}

module.exports = Sprinklers;
