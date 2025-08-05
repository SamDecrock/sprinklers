const cron = require('node-cron');

class TimeBasedScheduler {
  constructor(mainScheduler) {
    this.mainScheduler = mainScheduler;
    this.isEnabled = false;
    this.ENABLE_HOUR = 3;  // 03:00
    this.DISABLE_HOUR = 12; // 12:00
    this.TIMEZONE = 'Europe/Brussels';
  }

  getCurrentBrusselsTime() {
    const now = new Date();
    const brusselsTime = new Date(now.toLocaleString('en-US', { timeZone: this.TIMEZONE }));
    return brusselsTime.toLocaleTimeString('en-US', { hour12: false, timeZone: this.TIMEZONE });
  }

  isWithinAllowedTimeWindow() {
    // Get current time in Brussels timezone
    const now = new Date();
    const brusselsTime = new Date(now.toLocaleString('en-US', { timeZone: this.TIMEZONE }));
    const currentHour = brusselsTime.getHours();

    console.log(`[TimeBasedScheduler] Current Brussels time is ${this.getCurrentBrusselsTime()}`);
    return currentHour >= this.ENABLE_HOUR && currentHour < this.DISABLE_HOUR;
  }

  start() {
    // Set initial state based on current time
    if (this.isWithinAllowedTimeWindow()) {
      console.log('[TimeBasedScheduler] Current time is within allowed window, enabling main scheduler');
      this.mainScheduler.enable();
      this.isEnabled = true;
    } else {
      console.log('[TimeBasedScheduler] Current time is outside allowed window, disabling main scheduler');
      this.mainScheduler.disable();
      this.isEnabled = false;
    }

    // Enable at configured hour Brussels time
    cron.schedule(`0 ${this.ENABLE_HOUR} * * *`, () => {
      console.log(`[TimeBasedScheduler] Enabling main scheduler at ${String(this.ENABLE_HOUR).padStart(2, '0')}:00 Brussels time (current time: ${this.getCurrentBrusselsTime()})`);
      this.mainScheduler.enable();
      this.isEnabled = true;
    }, {
      timezone: this.TIMEZONE
    });

    // Disable at configured hour Brussels time
    cron.schedule(`0 ${this.DISABLE_HOUR} * * *`, () => {
      console.log(`[TimeBasedScheduler] Disabling main scheduler at ${String(this.DISABLE_HOUR).padStart(2, '0')}:00 Brussels time (current time: ${this.getCurrentBrusselsTime()})`);
      this.mainScheduler.disable();
      this.isEnabled = false;
    }, {
      timezone: this.TIMEZONE
    });
  }

  cleanup() {
    console.log(`[TimeBasedScheduler] Stopping at ${this.getCurrentBrusselsTime()}`);
    // No cleanup needed for cron jobs
  }
}

module.exports = TimeBasedScheduler;