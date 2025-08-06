class Scheduler {
  constructor(sprinklers, depthSensor, config) {
    if (!config || !config.depthThreshold || !config.stabilityThreshold || !config.stabilityTime || config.useStabilityLogic === undefined || !config.waitTimeBeforeResuming) {
      throw new Error('Scheduler requires all configuration parameters: depthThreshold, stabilityThreshold, stabilityTime, useStabilityLogic, waitTimeBeforeResuming');
    }

    this.sprinklers = sprinklers;
    this.depthSensor = depthSensor;
    this.isEnabled = false;
    this.hasGoneBelowThreshold = false;
    this.isWaiting = false;
    this.waitTimeoutId = null;
    this.depthReadings = [];
    this.config = config;

    this.setupDepthSensorListeners();  // only do this once
  }

  enable() {
    if (this.isEnabled) return;

    this.isEnabled = true;
    this.hasGoneBelowThreshold = false;
    this.isWaiting = false;
    this.depthReadings = [];

    // Get initial depth reading and start sprinklers if above threshold
    this.depthSensor.once('depth', (data) => {
      if (data.depth >= this.config.depthThreshold) {
        console.log(`[Scheduler] Initial depth (${data.depth.toFixed(2)}cm) above threshold, starting sprinklers`);
        this.sprinklers.resume();
      }
    });
  }

  disable() {
    if (!this.isEnabled) return;

    this.isEnabled = false;
    this.hasGoneBelowThreshold = false;
    this.isWaiting = false;

    // Clear any pending wait timeout
    if (this.waitTimeoutId) {
      clearTimeout(this.waitTimeoutId);
      this.waitTimeoutId = null;
    }

    this.depthReadings = [];

    // Stop sprinklers when disabling
    this.sprinklers.pause();
  }

  setupDepthSensorListeners() {
    this.depthSensor.on('depth', (data) => {
      if (!this.isEnabled) return;

      // console.log('[Scheduler] New depth reading:', data.depth.toFixed(2), 'cm');

      // If depth is below threshold, stop sprinklers
      // we also check if the sprinklers are running so we don't log and send pause multiple times which messes up the logs
      if (data.depth < this.config.depthThreshold && this.sprinklers.areRunning()) {
        console.log(`[Scheduler] Depth (${data.depth.toFixed(2)}) below threshold (${this.config.depthThreshold}), pausing sprinklers`);
        this.sprinklers.pause();
        this.hasGoneBelowThreshold = true;
        this.isWaiting = false;
        this.depthReadings = [];
        return;
      }

      // If we're above threshold and have gone below before
      if (data.depth >= this.config.depthThreshold && this.hasGoneBelowThreshold) {
        if (this.config.useStabilityLogic) {
          this.handleStabilityLogic(data);
        } else {
          this.handleWaitTimeLogic();
        }
      }
    });
  }

  handleStabilityLogic(data) {
    if (!this.isEnabled) return;
    const now = Date.now();

    // Add new reading with timestamp
    this.depthReadings.push({
      depth: data.depth,
      timestamp: now
    });

    // Remove readings older than STABILITY_TIME
    const cutoffTime = now - this.config.stabilityTime;
    this.depthReadings = this.depthReadings.filter(reading => reading.timestamp >= cutoffTime - 1000);

    // Only check stability if we have readings spanning the full time window
    if (this.depthReadings.length > 0) {
      const oldestReading = this.depthReadings[0];
      const newestReading = this.depthReadings[this.depthReadings.length - 1];
      const timeSpan = newestReading.timestamp - oldestReading.timestamp;

      if (timeSpan >= this.config.stabilityTime) {
        const minDepth = Math.min(...this.depthReadings.map(r => r.depth));
        const maxDepth = Math.max(...this.depthReadings.map(r => r.depth));
        const depthDifference = maxDepth - minDepth;

        if (depthDifference <= this.config.stabilityThreshold) {
          console.log(`[Scheduler] [depth:${this.depthSensor.depth.toFixed(2) }] Depth has been stable within ${this.config.stabilityThreshold}cm for ${this.config.stabilityTime/1000} seconds, resuming sprinklers`);
          if (this.isEnabled) {
            this.sprinklers.resume();
            this.hasGoneBelowThreshold = false;
            this.depthReadings = [];
          }
        }
      }
    }
  }

  handleWaitTimeLogic() {
    if (!this.isEnabled || this.isWaiting) return;

    this.isWaiting = true;
    console.log(`[Scheduler] [depth:${this.depthSensor.currentDepth.toFixed(2)}] Waiting for ${this.config.waitTimeBeforeResuming / 1000 / 60} minutes before resuming sprinklers`);
    this.waitTimeoutId = setTimeout(() => {
      if (this.isEnabled) {
        console.log(`[Scheduler] [depth:${this.depthSensor.currentDepth.toFixed(2)}] Wait time elapsed, resuming sprinklers`);
        this.sprinklers.resume();
        this.hasGoneBelowThreshold = false;
        this.isWaiting = false;
        this.waitTimeoutId = null;
      }
    }, this.config.waitTimeBeforeResuming);
  }

  cleanup() {
    // Clear any pending wait timeout
    if (this.waitTimeoutId) {
      clearTimeout(this.waitTimeoutId);
      this.waitTimeoutId = null;
    }
    this.depthSensor.disconnect();
  }
}

module.exports = Scheduler;