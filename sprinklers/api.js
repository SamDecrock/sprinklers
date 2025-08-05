const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT || 3000;
const app = express();

function exposeApi(sprinklerSequence, sprinklers, scheduler, depthSensor) {
  app.use(cors({ origin: "*" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static("public"));

  app.get("/api/sprinklers", (req, res) => {
    res.json({ sprinklers: sprinklerSequence.map(s => s.toObject()) });
  });

  app.get("/api/sprinklers/:id", (req, res) => {
    const sprinkler = sprinklerSequence.find(s => s.gpioPin == parseInt(req.params.id));
    if (!sprinkler) return res.status(404).json({ error: 'Sprinkler not found' });
    res.json(sprinkler.toObject());
  });

  app.post("/api/sprinklers/:id", async (req, res) => {
    try {
      const state = req.body.state;
      if (!['on', 'off'].includes(state)) return res.status(400).json({ error: 'Invalid state' });

      const sprinkler = sprinklerSequence.find(s => s.gpioPin == parseInt(req.params.id));
      if (!sprinkler) return res.status(404).json({ error: 'Sprinkler not found' });
      if(state == 'on') sprinkler.on();
      else sprinkler.off();

      res.json({});
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get("/api/stats", (req, res) => {
    const totalMinutes = sprinklers.getTotalMinutesLast24h();
    res.json({ totalMinutes });
  });

  // Scheduler endpoints
  app.get("/api/scheduler", (req, res) => {
    res.json({ enabled: scheduler.isEnabled });
  });

  app.post("/api/scheduler/enable", (req, res) => {
    scheduler.enable();
    res.json({ message: 'Depth-based scheduling enabled' });
  });

  app.post("/api/scheduler/disable", (req, res) => {
    scheduler.disable();
    res.json({ message: 'Depth-based scheduling disabled' });
  });

  // Depth sensor endpoint
  app.get("/api/depth", (req, res) => {
    res.json({ depth: depthSensor.currentDepth});
  });

  app.listen(PORT, () => {
    console.log(`[API] Server running on port ${PORT}`);
  });
}

module.exports = { exposeApi };
