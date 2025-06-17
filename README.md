# Homemade sprinkler system

- Uses the TL‑136 Liquid Level Level Sensor Detector 24VDC 4‑20mA to check the water level https://www.aliexpress.com/item/1005004309828489.html
- Uses the Widgetlords Pi-SPi-8AI+ to read the signal: https://widgetlords.com/collections/pi-spi-series-1/products/pi-spi-8aiplus-raspberry-pi-analog-input-4-20-ma-interface to check the water level.
- Uses the Aqualin Solenoid Valve to control the sprinklers: https://www.aliexpress.com/item/32697751769.html
- Uses an 8 channel relay board to control the valves: https://www.aliexpress.com/item/1005008071902438.html


## Set up

- Uses one Pi to connect the water level sensor because the Widgetlords Pi-SPi-8AI+ takes up the whole GPIO header.
- Uses another Pi to control 4 Aqualin Solenoid Valves with relays.

### Water level PI

Reads the level from the Widgetlords Pi-SPi-8AI+ board and emits it over socket.io

It also sends it to a local InfluxDB so it can be visualized with Grafana.

#### Deploy

```
rsync -avhS --progress --exclude 'node_modules' ./ 192.168.204.19:/apps/waterlevel
```

### Sprinkler PI

Listens to the depth changes from the Water Level Pi.

Conrols 4 sprinklers using the solenoid valves.

Has some logic to start the sprinklers when the water level is stable and stop when the water level is low.

Also includes a scheduler to only sprinkle between 3 AM in the morning and 12 PM in the afternoon.

#### Deploy

```
rsync -avhS --progress --exclude 'node_modules' ./ 192.168.204.18:/apps/sprinklers/new
```
