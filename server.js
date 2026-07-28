// TMC Ganesh Union — donation collection backend (Node.js + Express + Razorpay)
// Flow: client sends {name, phone, amount} -> we create a Razorpay order ->
// client completes payment -> Razorpay webhook confirms it -> we mark it paid.
// Replace the in-memory `donations` array with a real database before going live.

const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
require("dotenv").config();

const app = express();

// Webhook route needs the raw body for signature verification —
// must be registered BEFORE express.json().
app.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (signature !== expected) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const razorpayOrderId = event.payload.payment.entity.order_id;
      const donation = donations.find((d) => d.razorpayOrderId === razorpayOrderId);
      if (donation) {
        donation.status = "paid";
        console.log(`Donation ${donation.id} from ${donation.name} marked as paid (₹${donation.amount}).`);
        // TODO: send a WhatsApp/SMS thank-you receipt here, or log to a sheet/DB
      }
    }

    res.status(200).send("ok");
  }
);

app.use(express.json());

// Serve the frontend (public/index.html + any assets) from the same app,
// so there's no separate frontend deployment or CORS to manage.
app.use(express.static("public"));

// ---- "Database" (replace with a real DB table) ----
let donations = []; // { id, name, phone, amount, status, razorpayOrderId }
let nextId = 1;

const MIN_AMOUNT = 10; // rupees
const MAX_AMOUNT = 100000; // sanity cap, adjust as needed

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ---- Create a donation order ----
app.post("/donations", async (req, res) => {
  try {
    const { name, phone, amount } = req.body;

    if (!name || !phone || !amount) {
      return res.status(400).json({ error: "Name, phone, and amount are required." });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_AMOUNT || amt > MAX_AMOUNT) {
      return res.status(400).json({ error: `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.` });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amt * 100), // paise
      currency: "INR",
      receipt: `donation_${nextId}`,
    });

    const donation = {
      id: nextId++,
      name,
      phone,
      amount: amt,
      status: "pending",
      razorpayOrderId: razorpayOrder.id,
    };
    donations.push(donation);

    res.json({
      donationId: donation.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amt,
      currency: "INR",
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// ---- Check a donation's status ----
app.get("/donations/:id", (req, res) => {
  const donation = donations.find((d) => d.id === Number(req.params.id));
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

// ---- Simple totals view for the committee ----
app.get("/donations-summary", (req, res) => {
  const paid = donations.filter((d) => d.status === "paid");
  res.json({
    totalCollected: paid.reduce((s, d) => s + d.amount, 0),
    totalContributors: paid.length,
    pending: donations.filter((d) => d.status === "pending").length,
  });
});

// Fallback: any non-API route serves the app itself (mobile browsers
// bookmarking or refreshing on "/" land on the page correctly).
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`TMC Ganesh Union app running on port ${PORT}`));
