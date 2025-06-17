const { InfluxDB, FieldType } = require('influx');
const koffi = require("koffi");
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const widgetlords = koffi.load("libwidgetlords.so");
const readChannel = widgetlords.func("pi_spi_8ai_read_single", "uint16", ["uint8", "uint8"]);

const influx = new InfluxDB({
  host: 'localhost',
  database: 'depthdb',
  schema: [
    {
      measurement: 'water_depth',
      fields: { depth: FieldType.FLOAT, raw: FieldType.INTEGER },
      tags: ['channel']
    }
  ]
});

// Ensure DB exists
influx.getDatabaseNames().then(names => {
  if (!names.includes('depthdb')) {
    return influx.createDatabase('depthdb');
  }
});

function rawToDepth(raw) {
  return Math.max(0, (raw - 730) * 0.1804);
}

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
  const raw = readChannel(2, 0);
  const depth = rawToDepth(raw);

  // Emit the depth data to all connected clients
  io.emit('depth', { depth, raw, timestamp: new Date() });

  influx.writePoints([
    {
      measurement: 'water_depth',
      tags: { channel: '2' },
      fields: { depth, raw },
      timestamp: new Date(),
    }
  ]).catch(err => {
    console.error(`Error saving to InfluxDB: ${err}`);
  });

  console.log(`Raw: ${raw}, Depth: ${depth.toFixed(1)} cm`);
}, 2000);
