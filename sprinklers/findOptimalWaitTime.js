require('./helpers');
const Sprinkler = require('./Sprinkler');
const DepthSensor = require('./DepthSensor');
const fs = require('fs');

class WaitTimeOptimizer {
  constructor(sprinkler, depthSensor, config) {
    this.sprinkler = sprinkler;
    this.depthSensor = depthSensor;
    this.config = config;
    this.currentWaitTime = 30 * 1000; // Start with 30 seconds (in milliseconds)
    this.maxWaitTime = 4 * 60 * 60 * 1000; // Test up to 4 hours (in milliseconds)
    this.currentTest = {
      waitTime: 0,
      sprinklerTime: 0,
      ratio: 0
    };
    this.bestTest = {
      waitTime: 0,
      sprinklerTime: 0,
      ratio: 0
    };
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('Starting wait time optimization...');
    console.log('This will test different waiting times to find the optimal water extraction rate.');
    console.log('Press Ctrl+C to stop at any time.\n');

    // Connect to depth sensor
    console.log('Connecting to depth sensor...');
    await this.depthSensor.connect();
    console.log('Connected to depth sensor');

    // Get initial depth reading
    console.log('Getting initial depth...');
    const initialDepth = await this.getInitialDepth();
    console.log(`Initial depth: ${initialDepth.toFixed(2)}cm`);

    // If water is above threshold, pump it down first
    if (initialDepth > this.config.depthThreshold) {
      console.log('Water is above threshold, pumping down first...');
      await this.sprinkler.on();
      await this.waitForThreshold();
      await this.sprinkler.off();
      console.log('Water has reached threshold');
    }

    console.log(`Using sprinkler: ${this.sprinkler.name}\n`);

    while (true) { // Loop indefinitely
      console.log('running test');
      await this.runTest();
    }
  }

  async getInitialDepth() {
    return new Promise((resolve) => {
      this.depthSensor.once('depth', (data) => {
        resolve(data.depth);
      });
    });
  }

  async waitForThreshold() {
    return new Promise((resolve) => {
      const checkDepth = (data) => {
        if (data.depth < this.config.depthThreshold) {
          this.depthSensor.removeListener('depth', checkDepth);
          resolve();
        }
      };
      this.depthSensor.on('depth', checkDepth);
    });
  }

  async runTest() {
    const waitTimeSeconds = this.currentWaitTime / 1000;
    const waitTimeMinutes = waitTimeSeconds / 60;
    console.log(`\nTesting wait time: ${waitTimeSeconds} seconds (${waitTimeMinutes.toFixed(1)} minutes)`);

    // Reset test data
    this.currentTest = {
      waitTime: this.currentWaitTime,
      sprinklerTime: 0,
      ratio: 0
    };

    // Wait for the specified time
    console.log('Waiting...');
    await this.wait(this.currentWaitTime);

    // Start sprinkler and measure time until threshold
    console.log('Starting sprinkler...');
    const startTime = Date.now();
    await this.sprinkler.on();

    // Wait until depth goes below threshold
    await this.waitForThreshold();

    // Calculate sprinkler time
    this.currentTest.sprinklerTime = (Date.now() - startTime) / 1000; // Convert to seconds
    await this.sprinkler.off();

    // Calculate ratio (sprinkler time / wait time)
    this.currentTest.ratio = this.currentTest.sprinklerTime / (this.currentTest.waitTime / 1000);

    // Update best test if this one is better
    if (this.currentTest.ratio > this.bestTest.ratio) {
      this.bestTest = { ...this.currentTest };
    }

    // Log current test results
    const logEntry = `Test results for ${waitTimeSeconds} seconds (${waitTimeMinutes.toFixed(1)} minutes) wait:\n` +
                     `Sprinkler time: ${this.currentTest.sprinklerTime.toFixed(1)} seconds\n` +
                     `Ratio: ${this.currentTest.ratio.toFixed(3)}\n` +
                     `Current best: ${this.bestTest.ratio.toFixed(3)} (${this.bestTest.waitTime / 1000} seconds / ${(this.bestTest.waitTime / 1000 / 60).toFixed(1)} minutes wait)\n`;
    console.log(logEntry); // Print log entry to console
    fs.appendFileSync('optimization_log.txt', logEntry);

    // Double the wait time for next test
    this.currentWaitTime *= 2;
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
    if (this.sprinkler.state === 'on') {
      this.sprinkler.off();
    }
    // Disconnect from depth sensor
    this.depthSensor.disconnect();
  }
}

// Setup hardware
const sprinkler = new Sprinkler(6, 'Wit');

// Create depth sensor instance
const depthSensor = new DepthSensor({
  socketUrl: 'http://192.168.204.19:4000'
});

// Create optimizer instance
const optimizer = new WaitTimeOptimizer(sprinkler, depthSensor, {
  depthThreshold: 42, // Depth threshold in cm
});

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  optimizer.stop();

  console.log('All sprinklers stopped. Exiting...');
  process.exit(0);
});

// Start the optimization process
optimizer.start();