const MINIMUM_DEPTH = 35;

class DepthMonitor {
  constructor(normalSprinklers, malfunctioningSprinklers, depthSensor) {
    this.normalSprinklers = normalSprinklers;
    this.malfunctioningSprinklers = malfunctioningSprinklers;
    this.depthSensor = depthSensor;
    this._onDepth = async (data) => {
      const depth = data.depth;
      // console.log(`DepthMonitor: Depth: ${depth}`);
      if (depth < MINIMUM_DEPTH) {
        // Check if any sprinkler (normal or malfunctioning) is on
        const allSprinklers = [...this.normalSprinklers, ...this.malfunctioningSprinklers];
        const anyOn = allSprinklers.some(s => s.state === 'on');
        if (!anyOn) {
          // Send off command to all malfunctioning sprinklers
          for (const sprinkler of this.malfunctioningSprinklers) {
            console.log(`DepthMonitor: Emergency off for malfunctioning sprinkler '${sprinkler.name}' (depth=${depth})`);
            sprinkler.off();
          }
        }
      }
    };
    this.depthSensor.on('depth', this._onDepth);
  }

  cleanup() {
    this.depthSensor.off('depth', this._onDepth);
  }
}

module.exports = DepthMonitor;