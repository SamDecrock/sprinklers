const MINIMUM_DEPTH = 38;

class DepthMonitor {
  constructor(normalSprinklers, malfunctioningSprinklers, depthSensor) {
    this.normalSprinklers = normalSprinklers;
    this.malfunctioningSprinklers = malfunctioningSprinklers;
    this.depthSensor = depthSensor;

    this._onDepth = async (data) => {
      // console.log(`DepthMonitor: Depth: ${data.depth}`);
      if (data.depth <= MINIMUM_DEPTH) {

        if(data.previousDepth === null || data.depth > data.previousDepth) return;  // it's rising again

        // Check if any sprinkler (normal or malfunctioning) is on
        const allSprinklers = [...this.normalSprinklers, ...this.malfunctioningSprinklers];
        const anyOn = allSprinklers.some(s => s.state === 'on');
        if (!anyOn) {
          // Send off command to all malfunctioning sprinklers
          for (const sprinkler of this.malfunctioningSprinklers) {
            console.log(`[DepthMonitor] Emergency off for malfunctioning sprinkler '${sprinkler.name}' (depth=${data.depth.toFixed(2)})`);
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