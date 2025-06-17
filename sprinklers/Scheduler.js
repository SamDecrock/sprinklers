class Scheduler {
  constructor(controller, depthSensor, config) {
    if (!config || !config.depthThreshold || !config.stabilityThreshold || !config.stabilityTime || config.useStabilityLogic === undefined || !config.waitTimeBeforeResuming) {
      throw new Error('Scheduler requires all configuration parameters: depthThreshold, stabilityThreshold, stabilityTime, useStabilityLogic, waitTimeBeforeResuming');
    }

    this.sprinklerController = controller;
    this.depthSensor = depthSensor;
    this.isEnabled = false;
    this.hasGoneBelowThreshold = false;
    this.depthReadings = [];
    this.config = config;
  }

  enable() {
    if (this.isEnabled) return;

    this.isEnabled = true;
    this.hasGoneBelowThreshold = false;
    this.depthReadings = [];

    this.setupDepthSensorListeners();

    // Get initial depth reading and start sprinklers if above threshold
    this.depthSensor.once('depth', (data) => {
      if (data.depth >= this.config.depthThreshold) {
        console.log(`Initial depth (${data.depth.toFixed(2)}cm) above threshold, starting sprinklers`);
        this.sprinklerController.resume();
      }
    });
  }

  disable() {
    if (!this.isEnabled) return;

    this.isEnabled = false;
    this.hasGoneBelowThreshold = false;
    this.depthReadings = [];

    // Stop sprinklers when disabling
    if (this.sprinklerController.isSprinkling) {
      console.log('Scheduler disabled - Stopping sprinklers');
      this.sprinklerController.pause();
    }
  }

  setupDepthSensorListeners() {
    this.depthSensor.on('depth', (data) => {
      if (!this.isEnabled) return;

      // console.log('New depth reading:', data.depth.toFixed(2), 'cm');

      // If depth is below threshold, stop sprinklers
      if (data.depth < this.config.depthThreshold && this.sprinklerController.isSprinkling) {
        console.log(`Depth (${data.depth.toFixed(2)}) below threshold (${this.config.depthThreshold}), pausing sprinklers`);
        this.sprinklerController.pause();
        this.hasGoneBelowThreshold = true;
        this.depthReadings = [];
        return;
      }

      // If we're above threshold and have gone below before
      if (data.depth >= this.config.depthThreshold && this.hasGoneBelowThreshold && !this.sprinklerController.isSprinkling) {
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
          console.log(`Depth has been stable within ${this.config.stabilityThreshold}cm for ${this.config.stabilityTime/1000} seconds, resuming sprinklers`);
          if (this.isEnabled) {
            this.sprinklerController.resume();
            this.hasGoneBelowThreshold = false;
            this.depthReadings = [];
          }
        }
      }
    }
  }

  handleWaitTimeLogic() {
    if (!this.isEnabled) return;
    console.log(`Waiting for ${this.config.waitTimeBeforeResuming / 1000} seconds before resuming sprinklers`);
    setTimeout(() => {
      if (this.isEnabled) {
        console.log('Wait time elapsed, resuming sprinklers');
        this.sprinklerController.resume();
        this.hasGoneBelowThreshold = false;
      }
    }, this.config.waitTimeBeforeResuming);
  }

  cleanup() {
    this.depthSensor.disconnect();
  }
}

module.exports = Scheduler;