const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT || 3000;
const app = express();

function exposeApi(sprinklers, controller, scheduler, depthSensor) {
  app.use(cors({ origin: "*" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static("public"));

  app.get("/api/sprinklers", (req, res) => {
    res.json({ sprinklers: sprinklers.map(s => s.toObject()) });
  });

  app.get("/api/sprinklers/:id", (req, res) => {
    const sprinkler = sprinklers.find(s => s.gpioPin == req.params.id);
    if (!sprinkler) return res.status(404).json({ error: 'Sprinkler not found' });
    res.json(sprinkler.toObject());
  });

  app.post("/api/sprinklers/:id", async (req, res) => {
    try {
      const state = req.body.state;
      if (!['on', 'off'].includes(state)) return res.status(400).json({ error: 'Invalid state' });

      const updated = await controller.setSprinklerState(parseInt(req.params.id), state);
      res.json(updated);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get("/api/stats", (req, res) => {
    const totalMinutes = controller.getTotalMinutesLast24h();
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
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { exposeApi };
