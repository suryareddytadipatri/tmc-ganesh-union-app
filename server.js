// TMC Ganesh Union — server (Node.js + Express)
// Payments now happen directly via UPI (no gateway, no fees). This backend's
// only job is to keep a simple record of contributions for the committee:
// each donor self-reports after paying via the UPI QR, and that gets logged
// here so the site can show a running total and the committee has a list.
//
// IMPORTANT: this is a self-reported record, not a verified payment log
// (there's no gateway to confirm the money actually arrived). Cross-check
// against your bank/UPI app statement periodically — see GET /donations-export.

const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const DATA_FILE = path.join(__dirname, "donations.json");

// ---- Load existing records from disk on startup (survives restarts within
// the same deploy; a fresh deploy on some hosts may reset this — export
// regularly via /donations-export if you want a permanent backup). ----
let donations = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    donations = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
} catch (err) {
  console.error("Could not read donations.json, starting fresh.", err);
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(donations, null, 2));
  } catch (err) {
    console.error("Could not save donations.json", err);
  }
}

const MIN_AMOUNT = 10;
const MAX_AMOUNT = 100000;

// ---- Log a self-reported contribution (called when someone submits their UTR) ----
app.post("/donations", (req, res) => {
  const { name, phone, amount, utr } = req.body;

  if (!name || !phone || !amount || !utr) {
    return res.status(400).json({ error: "Name, phone, amount, and UPI reference number are required." });
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < MIN_AMOUNT || amt > MAX_AMOUNT) {
    return res.status(400).json({ error: `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.` });
  }

  const record = {
    id: donations.length + 1,
    name: String(name).slice(0, 100),
    phone: String(phone).slice(0, 15),
    amount: amt,
    utr: String(utr).slice(0, 40),
    status: "self-reported",
    timestamp: new Date().toISOString(),
  };
  donations.push(record);
  save();

  res.json({ ok: true, id: record.id });
});

// ---- Public summary: total collected + contributor count (no names) ----
app.get("/donations-summary", (req, res) => {
  res.json({
    totalCollected: donations.reduce((sum, d) => sum + d.amount, 0),
    totalContributors: donations.length,
  });
});

// ---- Public donor list: name + amount only (no phone/UTR — those stay private) ----
app.get("/donors-public", (req, res) => {
  const list = donations
    .map((d) => ({ name: d.name, amount: d.amount }))
    .reverse(); // most recent first
  res.json(list);
});

// ---- Committee-only: full list, protected by a simple admin key ----
// Visit: https://your-app-url.com/donations?key=YOUR_ADMIN_KEY
app.get("/donations", (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized. Add ?key=YOUR_ADMIN_KEY to the URL." });
  }
  res.json(donations);
});

// ---- Committee-only: download all records as CSV for backup/reconciliation ----
// Visit: https://your-app-url.com/donations-export?key=YOUR_ADMIN_KEY
app.get("/donations-export", (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(401).send("Unauthorized. Add ?key=YOUR_ADMIN_KEY to the URL.");
  }
  const header = "id,name,phone,amount,utr,status,timestamp\n";
  const rows = donations
    .map((d) => `${d.id},"${d.name}",${d.phone},${d.amount},${d.utr || ""},${d.status},${d.timestamp}`)
    .join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=donations.csv");
  res.send(header + rows);
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`TMC Ganesh Union app running on port ${PORT}`));
