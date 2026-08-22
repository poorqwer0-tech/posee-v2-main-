// pm2 script for POS dev server
const { execSync } = require("child_process");
const path = require("path");

process.env.NODE_ENV = "development";
process.env.HOSTNAME = "0.0.0.0";

const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");
process.argv = ["node", nextBin, "dev", "-p", "3001"];

require(nextBin);
