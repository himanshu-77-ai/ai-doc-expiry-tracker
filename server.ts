import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import { Resend } from "resend";
import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import Stripe from "stripe";
import crypto from "crypto";

dotenv.config();

// ─── DATE HELPERS ──────────────────────────────────────────────────────
/**
 * Resolves the "ReferenceError: fmtDate is not defined" seen in logs.
 * This formats dates for the HTML report tables.
 */
const fmtDate = (dateString: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ─── SERVICE ACCOUNT HELPERS ───────────────────────────────────────────
function getServiceAccountCredential() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    }
  } catch (e: any) {
    console.error("[Firebase] Bad FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
  }
  return admin.credential.applicationDefault();
}

const SA_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/firebase.database"
];

function buildGoogleAuth() {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return new GoogleAuth({ credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON), scopes: SA_SCOPES });
    }
  } catch (e) {}
  return new GoogleAuth({ scopes: SA_SCOPES });
}

const auth = buildGoogleAuth();
const DEBUG = process.env.DEBUG === "true";
const log = (...args: any[]) => { if (DEBUG) console.log(...args); };

let stripe: Stripe | null = null;
const getStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

let db: any;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocumentData {
  title: string;
  category: string;
  expiryDate: string;
  userId: string;
  documentNumber?: string;
  status?: string;
}

function getStatusInfo(expiryDate: string, interval: number = 30) {
  const diff = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: "Expired", color: "#EF4444" };
  if (diff <= interval) return { text: "Expiring Soon", color: "#F59E0B" };
  return { text: "Safe", color: "#10B981" };
}

// ── EMAIL via Resend ─────────────────────────────────────────────────────────
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[Email] RESEND_API_KEY missing");
    return null;
  }
  return new Resend(key);
}

async function sendEmail({ from, to, subject, html, text }: {
  from?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY not configured");

  const fromAddr = from || `AI Tracker <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`;

  const { data, error } = await resend.emails.send({
    from: fromAddr,
    to,
    subject,
    html: html || text || "",
  });

  if (error) throw new Error(error.message);
  return data;
}

// ── WhatsApp via Twilio ───────────────────────────────────────────────────────
async function sendWhatsApp(to: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio not configured");
  const twilio = await import("twilio");
  const client = (twilio as any).default ? (twilio as any).default(sid, token) : (twilio as any)(sid, token);
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const toWA = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  return await client.messages.create({ from, to: toWA, body: message });
}

function buildWhatsAppReport(docs: any[], interval: number = 30, title: string = "Document Status Report"): string {
  const now = new Date();
  const expired = docs.filter(d => {
    const diff = Math.ceil((new Date(d.expiryDate).getTime() - now.getTime()) / 86400000);
    return diff < 0 && d.status !== "Renewed";
  });
  const expiring = docs.filter(d => {
    const diff = Math.ceil((new Date(d.expiryDate).getTime() - now.getTime()) / 86400000);
    return diff >= 0 && diff <= interval && d.status !== "Renewed";
  });
  const safe = docs.filter(d => {
    const diff = Math.ceil((new Date(d.expiryDate).getTime() - now.getTime()) / 86400000);
    return diff > interval || d.status === "Renewed";
  });

  const lines: string[] = [];
  lines.push("AI Tracker - " + title);
  lines.push("Date: " + now.toLocaleDateString("en-IN"));
  lines.push("");
  lines.push("Summary: " + docs.length + " total | " + expired.length + " expired | " + expiring.length + " expiring | " + safe.length + " safe");
  lines.push("");

  if (expired.length > 0) {
    lines.push("EXPIRED (Action Required):");
    expired.slice(0, 5).forEach((d: any) => lines.push("- " + d.title + " | " + d.expiryDate));
    if (expired.length > 5) lines.push("  ...and " + (expired.length - 5) + " more");
    lines.push("");
  }
  if (expiring.length > 0) {
    lines.push("EXPIRING SOON:");
    expiring.slice(0, 5).forEach((d: any) => {
      const diff = Math.ceil((new Date(d.expiryDate).getTime() - now.getTime()) / 86400000);
      lines.push("- " + d.title + " | " + d.expiryDate + " (" + diff + " days)");
    });
    if (expiring.length > 5) lines.push("  ...and " + (expiring.length - 5) + " more");
    lines.push("");
  }
  if (safe.length > 0) {
    const safeNames = safe.slice(0, 3).map((d: any) => d.title).join(", ");
    const extra = safe.length > 3 ? " +" + (safe.length - 3) + " more" : "";
    lines.push("SAFE: " + safeNames + extra);
    lines.push("");
  }
  lines.push("Open app: https://ai-doc-expiry-tracker.onrender.com");
  return lines.join("\n");
}

async function startServer() {
  const app = express();
  // FIXED: Using dynamic port for Render
  const PORT = process.env.PORT || 3000;

  let projectId = "";
  let configProjectId = "";
  let apiKey = "";
  let databaseId = process.env.FIREBASE_DATABASE_ID || "(default)";

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    
    configProjectId = firebaseConfig.projectId;
    apiKey = firebaseConfig.apiKey;
    databaseId = firebaseConfig.firestoreDatabaseId || "(default)";

    const envAuth = new GoogleAuth();
    const envProjectId = await envAuth.getProjectId();
    console.log(`[Firebase Diagnostics] ENV Project: ${envProjectId}, CONFIG Project: ${configProjectId}`);

    projectId = configProjectId || envProjectId; 
    console.log(`[Firebase] Initializing. Final Target: ${projectId}`);

    process.env.GOOGLE_CLOUD_PROJECT = projectId;

    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app?.delete()));
    }
    
    const firebaseApp = admin.initializeApp({
      projectId: projectId,
      credential: getServiceAccountCredential()
    });

    const connectAdminSDK = async (dbId: string, pId: string) => {
      try {
        const tempApp = admin.initializeApp({
          projectId: pId,
          credential: getServiceAccountCredential()
        }, `temp-${Date.now()}-${pId}`);

        const testDb = (dbId === "(default)" || !dbId) 
          ? getFirestore(tempApp) 
          : getFirestore(tempApp, dbId);
        
        await testDb.collection("system").doc("cron_identity").get();
        if (admin.apps.length > 0) {
          await Promise.all(admin.apps.filter(ap => ap?.name !== tempApp.name).map(ap => ap?.delete()));
        }
        return testDb;
      } catch (e: any) {
        return null;
      }
    };

    db = await connectAdminSDK(databaseId, configProjectId);
    if (!db) db = await connectAdminSDK("(default)", configProjectId);
    
    console.log(`[Firebase] Connected: ${!!db}`);
  } catch (err: any) {
    console.error("[Firebase] Initialization Error:", err);
  }

  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now(), uptime: process.uptime() }));
  app.post("/api/ping/reminders", (req, res) => {
    res.json({ ok: true });
    setImmediate(() => { checkAndSendReminders().catch(console.error); });
  });

  // Razorpay Initialization
  let razorpayInstance: Razorpay | null = null;
  function getRazorpay() {
    if (!razorpayInstance) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) return null;
      razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return razorpayInstance;
  }

  // Reminder Logic
  async function checkAndSendReminders() {
    log(`[Reminders] Starting expiry check...`);
    if (!process.env.RESEND_API_KEY) return { success: false, error: "Resend not configured" };

    try {
      const now = new Date();
      let allUsers: any[] = [];
      if (db) {
        const snapshot = await db.collection("users").get();
        allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      let sentCount = 0;
      for (const user of allUsers) {
        if (user.features?.emailAlerts === false) continue;
        const interval = parseInt(user.expiryInterval || "30");
        const triggerDays = [...new Set([interval, 7, 1])].sort((a, b) => b - a);
        
        for (const days of triggerDays) {
          const targetDate = new Date();
          targetDate.setDate(now.getDate() + days);
          const dateString = targetDate.toISOString().split('T')[0];

          let docs: any[] = [];
          if (db) {
            const snap = await db.collection("documents")
              .where("userId", "==", user.id)
              .where("expiryDate", "==", dateString)
              .get();
            docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }

          const eligibleDocs = docs.filter(d => d.status !== 'Renewed');
          for (const doc of eligibleDocs) {
            // FIXED: Using Resend (sendEmail) instead of SMTP to avoid timeouts[cite: 1]
            await sendEmail({
              to: user.email,
              subject: `Action Required: ${doc.title} Expiring in ${days} Days`,
              html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>Expiry Alert</h2>
                <p>Your document <strong>${doc.title}</strong> expires on ${doc.expiryDate}.</p>
                <a href="https://ai-doc-expiry-tracker.onrender.com" style="background: #2563EB; color: white; padding: 10px; text-decoration: none;">Open Dashboard</a>
              </div>`
            });
            sentCount++;

            if (user.whatsappPhone) {
              try {
                const waMsg = `📅 *AI Tracker Alert*\n\n*${doc.title}* expires in *${days} days*!`;
                await sendWhatsApp(user.whatsappPhone, waMsg);
              } catch {}
            }
          }
        }
      }
      return { success: true, sentCount };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Full Status Report Route
  app.post("/api/notifications/send-report", async (req, res) => {
    const { userId, email } = req.body;
    if (!userId || !email) return res.status(400).json({ error: "Missing fields" });

    try {
      let docs: DocumentData[] = [];
      if (db) {
        const docsSnapshot = await db.collection("documents").where("userId", "==", userId).get();
        docs = docsSnapshot.docs.map(d => d.data() as DocumentData);
      }
      
      const interval = 30;
      // FIXED: fmtDate is now defined at the top of the file[cite: 1]
      const tableRows = docs.map(doc => {
        const { text, color } = getStatusInfo(doc.expiryDate, interval);
        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.title}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.category}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${fmtDate(doc.expiryDate)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${color}; font-weight: bold;">${text}</td>
          </tr>`;
      }).join("");

      await sendEmail({
        to: email,
        subject: "AI Tracker - Status Report",
        html: `<table style="width: 100%; border-collapse: collapse;">
          <thead><tr style="background: #eee;"><th>Doc</th><th>Cat</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>`
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Billing & Stripe Logic
  app.post("/api/payments/create-checkout-session", async (req, res) => {
    const { planName, amount, currency = "usd" } = req.body;
    const stripeClient = getStripe();
    if (!stripeClient) return res.status(500).json({ error: "Stripe not configured" });
    try {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price_data: { currency, product_data: { name: `AI Tracker ${planName}` }, unit_amount: amount * 100 }, quantity: 1 }],
        mode: "payment",
        success_url: `${req.headers.origin}/?payment=success`,
        cancel_url: `${req.headers.origin}/?payment=cancel`,
      });
      res.json({ id: session.id });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // Admin Routes
  const ADMIN_UID = "v7U6iaF8wpXBLE9m1A3Crbeq5hq2";
  app.get("/api/admin/users", async (req, res) => {
    if (req.headers["x-admin-uid"] !== ADMIN_UID) return res.status(403).end();
    if (!db) return res.status(500).end();
    const snap = await db.collection("users").get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
