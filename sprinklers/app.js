require('./helpers');
const Sprinkler = require('./Sprinkler');
const PolaritySwitcher = require('./PolaritySwitcher');
const Sprinklers = require('./Sprinklers');
const Scheduler = require('./Scheduler');
const DepthSensor = require('./DepthSensor');
const api = require('./api');
const TimeBasedScheduler = require('./TimeBasedScheduler');
const DepthMonitor = require('./DepthMonitor');

const polaritySwither = new PolaritySwitcher(16, 20, 21);

// Create depth sensor instance
const depthSensor = new DepthSensor({
  socketUrl: 'http://192.168.204.19:4000'
});

// Connect to depth sensor
depthSensor.connect();

const sprinklerSequence = [
  new Sprinkler(polaritySwither, 6 , 'New Sprinklers'  , depthSensor, 0), // connected to other sprinkler system
  new Sprinkler(polaritySwither, 13, 'Bruin', depthSensor, 5 * 60 * 1000),
  new Sprinkler(polaritySwither, 19, 'Blauw', depthSensor, 5 * 60 * 1000),
  new Sprinkler(polaritySwither, 26, 'Groen', depthSensor, 5 * 60 * 1000),
];

// Start the depth monitor
const depthMonitor = new DepthMonitor([sprinklerSequence[0], sprinklerSequence[2], sprinklerSequence[3]], [sprinklerSequence[1]], depthSensor);


const sprinklers = new Sprinklers(sprinklerSequence, polaritySwither);

// Print initial depth
depthSensor.on('depth', (data) => {
  // console.log(`Current depth: ${data.depth} cm`);
});

// Create scheduler instance with required configuration
const scheduler = new Scheduler(sprinklers, depthSensor, {
  depthThreshold: 42, // Depth threshold in cm

  useStabilityLogic: false, // When true, the depth should be stable for a certain amount of time. Stable means that the depth is not changing by more than a few cm.
  stabilityThreshold: 2, // 2 cm difference threshold
  stabilityTime: 60*1000, // 60 seconds
  // another way is to simply wait for a certain time before resuming sprinklers
  // we can find this with the findOptimalWaitTime.js script
  waitTimeBeforeResuming: 2*60*1000, // 2 minutes, in case you don't use stability logic
});

// Create time-based scheduler to control the main scheduler
const timeBasedScheduler = new TimeBasedScheduler(scheduler);
timeBasedScheduler.start();

// Handle process termination
const cleanup = async () => {
  console.log('\nGracefully shutting down...');

  // Cleanup time-based scheduler
  timeBasedScheduler.cleanup();

  // Cleanup scheduler
  scheduler.cleanup();

  // Stop all sprinklers
  for (const sprinkler of sprinklerSequence) {
    if (sprinkler.state === 'on') {
      console.log(`[app.js] Turning off sprinkler ${sprinkler.name}`);
      await sprinkler.off();
    }
  }

  // Turn off polarity switcher
  await polaritySwither.off();

  console.log('[app.js] All sprinklers stopped. Exiting...');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Expose API with scheduler
api.exposeApi(sprinklerSequence, sprinklers, scheduler, depthSensor);

