require('./helpers');
const Sprinkler = require('./Sprinkler');
const PolaritySwitcher = require('./PolaritySwitcher');
const SprinklerController = require('./controller/SprinklerController');
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

const sprinklers = [
  new Sprinkler(polaritySwither, 6 , 'Wit', depthSensor),
  new Sprinkler(polaritySwither, 13, 'Bruin', depthSensor),
  new Sprinkler(polaritySwither, 19, 'Blauw', depthSensor),
  new Sprinkler(polaritySwither, 26, 'Groen', depthSensor),
];

// Start the depth monitor
const depthMonitor = new DepthMonitor([sprinklers[0], sprinklers[2], sprinklers[3]], [sprinklers[1]], depthSensor);

const sequence = [
  { index: 0, sprinklerTime: 3 },
  { index: 1, sprinklerTime: 3 },
  { index: 3, sprinklerTime: 3 },
  { index: 2, sprinklerTime: 3 },
];

const controller = new SprinklerController(sprinklers, polaritySwither, sequence);

// Print initial depth
depthSensor.on('depth', (data) => {
  // console.log(`Current depth: ${data.depth} cm`);
});

// Create scheduler instance with required configuration
const scheduler = new Scheduler(controller, depthSensor, {
  depthThreshold: 42, // Depth threshold in cm

  useStabilityLogic: true, // When true, the depth should be stable for a certain amount of time. Stable means that the depth is not changing by more than a few cm.
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
  for (const sprinkler of sprinklers) {
    if (sprinkler.state === 'on') {
      console.log(`Turning off sprinkler ${sprinkler.name}`);
      await sprinkler.off();
    }
  }

  // Turn off polarity switcher
  await polaritySwither.off();

  console.log('All sprinklers stopped. Exiting...');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Expose API with scheduler
api.exposeApi(sprinklers, controller, scheduler, depthSensor);

