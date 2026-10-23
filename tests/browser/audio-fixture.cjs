/* A continuous audible fixture: Chromium's default fake mic starts with silence. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

module.exports = function audioFixture() {
  const file = path.join(os.tmpdir(), `translator-test-tone-${process.pid}.wav`);
  const rate = 48000,
    frames = rate * 2,
    data = Buffer.alloc(44 + frames * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index++) {
    const t = index / rate;
    const wave = Math.sin(2 * Math.PI * 220 * t) + 0.4 * Math.sin(2 * Math.PI * 570 * t);
    const envelope = 0.6 + 0.4 * Math.cos(2 * Math.PI * 4 * t);
    data.writeInt16LE(Math.round(wave * envelope * 7000), 44 + index * 2);
  }
  fs.writeFileSync(file, data);
  process.once("exit", () => fs.rmSync(file, { force: true }));
  return `--use-file-for-fake-audio-capture=${file}`;
};
