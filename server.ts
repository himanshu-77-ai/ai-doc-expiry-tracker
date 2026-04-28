import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/datastore"]
});
import { readFileSync } from "fs";
import Stripe from "stripe";
import crypto from "crypto";

dotenv.config();

// Set DEBUG=true in .env to see verbose logs. Default: false (keeps cron-job.org output small)
const DEBUG = process.env.DEBUG === "true";
const log = (...args: any[]) => { if (DEBUG) console.log(...args); };

// Initialize Stripe lazily
let stripe: Stripe | null = null;
const getStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

// Initialize Firebase Admin lazily
let db: any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocumentData {
  title: string;
  category: string;
  expiryDate: string;
  userId: string;
}

function getStatusInfo(expiryDate: string, interval: number = 30) {
  const diff = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: "Expired", color: "#EF4444" };
  if (diff <= interval) return { text: "Expiring Soon", color: "#F59E0B" };
  return { text: "Safe", color: "#10B981" };
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error("[Email] SMTP_USER or SMTP_PASS missing");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    debug: true,
    logger: true
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  let projectId = "";
  let configProjectId = "";
  let apiKey = "";
  let databaseId = "(default)";

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    
    configProjectId = firebaseConfig.projectId;
    apiKey = firebaseConfig.apiKey;
    databaseId = firebaseConfig.firestoreDatabaseId || "(default)";

    // Identify actual environment project ID
    const envAuth = new GoogleAuth();
    const envProjectId = await envAuth.getProjectId();
    
    // LOGGING PROJECT IDs
    console.log(`[Firebase Diagnostics] ENV Project: ${envProjectId}, CONFIG Project: ${configProjectId}`);

    // If config project exists, it's the one most likely to have the API enabled by our tools.
    // We prioritize it for the connection search.
    projectId = configProjectId || envProjectId; 

    console.log(`[Firebase] Initializing. Primary Priority: ${configProjectId}, Env Project: ${envProjectId}. Final Target: ${projectId}`);

    // Force environment variables
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.GCLOUD_PROJECT = projectId;
    process.env.FIRESTORE_PROJECT_ID = projectId;
    process.env.DATASTORE_PROJECT_ID = projectId;
    process.env.GCP_PROJECT = projectId;

    // Reset Admin SDK
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app?.delete()));
    }
    
    // Initialize Admin SDK with Config Project ID
    // We try to utilize ADC (Application Default Credentials)
    const firebaseApp = admin.initializeApp({
      projectId: projectId,
      credential: admin.credential.applicationDefault()
    });
    console.log(`[Firebase] Admin SDK Initialized for ${projectId}`);

    const connectAdminSDK = async (dbId: string, pId: string) => {
      try {
        console.log(`[Firebase] Testing Admin SDK connection to [${pId}/${dbId}]...`);
        // We need to re-initialize admin app if we change project ID
        const tempApp = admin.initializeApp({
          projectId: pId,
          credential: admin.credential.applicationDefault()
        }, `temp-${Date.now()}-${pId}`);

        const testDb = (dbId === "(default)" || !dbId) 
          ? getFirestore(tempApp) 
          : getFirestore(tempApp, dbId);
        
        // Use a PROTECTED read for health check to verify real Admin/SA permissions
        await testDb.collection("system").doc("cron_identity").get();
        console.log(`[Firebase] Admin SDK access to [${pId}/${dbId}] verified.`);
        
        // If verified, we make this the global app (by deleting old ones and re-init)
        if (admin.apps.length > 0) {
          await Promise.all(admin.apps.filter(ap => ap?.name !== tempApp.name).map(ap => ap?.delete()));
        }
        return testDb;
      } catch (e: any) {
        if (e.message.includes("not found") || e.code === 5 || e.code === "not-found") {
          console.warn(`[Firebase] Database [${pId}/${dbId}] not found (404).`);
        } else if (e.message.includes("permission") || e.code === 7 || e.code === "permission-denied") {
          console.error(`[Firebase] Admin SDK Permission Denied for [${pId}/${dbId}] (403): ${e.message}`);
        } else {
          console.error(`[Firebase] Admin SDK connection failed for [${pId}/${dbId}]: ${e.message}`);
        }
        return null;
      }
    };

    // Try in order:
    // 1. Config Project + Config DB (Our explicitly configured project)
    // 2. Env Project + Config DB (Environment project)
    // 3. Config Project + (default)
    // 4. Env Project + (default)
    
    console.log("[Firebase] Starting connection search...");
    db = await connectAdminSDK(databaseId, configProjectId);
    if (db) {
       projectId = configProjectId;
    } else if (envProjectId && envProjectId !== configProjectId) {
       console.log(`[Firebase] configProjectId/configDb failed, trying Env Project [${envProjectId}]...`);
       db = await connectAdminSDK(databaseId, envProjectId);
       if (db) projectId = envProjectId;
    }
    
    if (!db) {
      console.log(`[Firebase] Named database [${databaseId}] failed on all projects, trying (default)...`);
      db = await connectAdminSDK("(default)", configProjectId);
      if (db) {
        projectId = configProjectId;
        databaseId = "(default)";
      } else if (envProjectId && envProjectId !== configProjectId) {
        db = await connectAdminSDK("(default)", envProjectId);
        if (db) {
          projectId = envProjectId;
          databaseId = "(default)";
        }
      }
    }
    
    console.log(`[Firebase] Final State: Project [${projectId}], Database [${databaseId}], Connected: ${!!db}`);
    process.env.GOOGLE_CLOUD_PROJECT = projectId;

    // Centralized Identity Registration
    const registerIdentity = async () => {
      try {
        const { saUniqueId, saEmail } = await getServiceAccountInfo();
        const saToken = await getServiceAccountToken();
        const currentProjectId = process.env.GOOGLE_CLOUD_PROJECT || projectId;

        if (saUniqueId || saEmail || saToken) {
          console.log(`[Firebase] Server Identity Verification:`);
          console.log(` - UID: ${saUniqueId}`);
          console.log(` - Email: ${saEmail}`);
          console.log(` - Token Available: ${!!saToken}`);
          console.log(` - Database: ${databaseId}`);
          
          const identityData = {
            uid: saUniqueId,
            email: saEmail,
            role: "admin",
            updatedAt: new Date().toISOString()
          };

          if (db) {
            try {
              if (saUniqueId) {
                await db.collection("system").doc(saUniqueId).set(identityData, { merge: true });
                await db.collection("users").doc(saUniqueId).set({
                  email: saEmail,
                  role: "admin",
                  displayName: "System Server",
                  updatedAt: identityData.updatedAt
                }, { merge: true });
              }
              await db.collection("system").doc("cron_identity").set(identityData, { merge: true });
              console.log("[Firebase] Identity registered via Admin SDK");
              return;
            } catch (e) {
              console.info("[Firebase] Admin SDK identity registration failed, trying REST...");
            }
          }

          // REST Fallback for registration
          const headers: any = { "Content-Type": "application/json" };
          let urlSuffix = `?key=${apiKey}`;
          
          if (saToken) {
            headers["Authorization"] = `Bearer ${saToken}`;
            urlSuffix = ""; // Don't use API key if token is present
            console.log("[Firebase] Using SA Token for identity registration REST fallback");
          }

          const idToUse = saUniqueId || "cron_identity";

          // 1. Register in system
          const systemUrl = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseId}/documents/system/${idToUse}${urlSuffix}`;
          await fetch(systemUrl, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              fields: {
                uid: { stringValue: saUniqueId || "unknown" },
                email: { stringValue: saEmail || "unknown" },
                role: { stringValue: "admin" },
                updatedAt: { stringValue: identityData.updatedAt }
              }
            })
          });

          // 2. Register as admin user
          if (saUniqueId) {
            const userUrl = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseId}/documents/users/${saUniqueId}${urlSuffix}`;
            const userRes = await fetch(userUrl, {
              method: "PATCH",
              headers,
              body: JSON.stringify({
                fields: {
                  email: { stringValue: saEmail || "unknown" },
                  role: { stringValue: "admin" },
                  displayName: { stringValue: "System Server" },
                  updatedAt: { stringValue: identityData.updatedAt }
                }
              })
            });

            if (userRes.ok) {
              console.log("[Firebase] Identity registration REST fallback complete");
            } else {
              console.info(`[Firebase] REST registration failed: ${userRes.status}`);
            }
          }
        }
      } catch (e) {
        console.warn("[Firebase] Identity registration error:", e);
      }
    };

    if (db) {
      console.log("[Firebase] Database connection established successfully.");
      await registerIdentity();
      
      // Seed the health_check collection to ensure status checks work
      try {
        await db.collection("health_check").doc("status").set({
          lastChecked: new Date().toISOString(),
          status: "ok"
        });
      } catch (seedErr) {
        console.warn("[Firebase] Could not seed health_check (expected if permissions are restricted):", seedErr);
      }
    } else {
      console.error("[Firebase] All database connection attempts failed.");
      await registerIdentity();
      // Initialize with default anyway so the app doesn't crash, 
      // but status check will report the error
      db = getFirestore(firebaseApp, databaseId === "(default)" ? undefined : databaseId);
    }

  } catch (err: any) {
    console.error("[Firebase] Critical Initialization Error:", err);
  }

  app.use(express.json());

  // ============================================================
  // KEEP-ALIVE & HEALTH — cron-job.org ke liye (NO rate limit)
  // Render free tier pe 429 se bachne ke liye: BEFORE all middleware
  // Cron-job.org mein ye 2 URLs use karo:
  //   Keep Alive:  GET  /api/health      (har 14 min)
  //   Reminders:   POST /api/ping/reminders (daily 9 AM)
  // ============================================================
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, ts: Date.now(), uptime: process.uptime() });
  });
  app.head("/api/health", (_req, res) => res.status(200).end()); // some monitors use HEAD

  // Helper to get fresh firebase config
  const getFirebaseConfig = () => {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      return config;
    } catch (e) {
      return { projectId: process.env.GOOGLE_CLOUD_PROJECT };
    }
  };
  
  // Diagnostic logging for environment variables
  console.log("Environment Variable Check:");
  console.log("- SMTP_USER:", process.env.SMTP_USER ? "Configured" : "Missing");
  console.log("- SMTP_PASS:", process.env.SMTP_PASS ? "Configured" : "Missing");
  console.log("- RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "Configured" : "Missing");
  console.log("- RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "Configured" : "Missing");
  console.log("- GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Configured" : "Missing");

  // Razorpay Initialization
  let razorpayInstance: Razorpay | null = null;
  function getRazorpay() {
    if (!razorpayInstance) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        return null;
      }
      razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
    return razorpayInstance;
  }

  // Debug Route for Firebase
  app.get("/api/debug/firebase", async (req, res) => {
    try {
      const saToken = await getServiceAccountToken();
      const { saUniqueId, saEmail } = await getServiceAccountInfo();

      const authProjectId = await auth.getProjectId();
      const results: any = {
        config: { projectId, databaseId },
        authProjectId,
        identity: { saUniqueId, saEmail, hasToken: !!saToken },
        adminSdk: { initialized: !!admin.apps.length, dbConnected: !!db },
        env: {
          GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
          GCLOUD_PROJECT: process.env.GCLOUD_PROJECT
        }
      };

      // Test REST for both databases
      const testDb = async (dbId: string) => {
        const url = `https://firestore.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/databases/${dbId}/documents:runQuery`;
        const headers: any = { "Content-Type": "application/json" };
        if (saToken) headers["Authorization"] = `Bearer ${saToken}`;
        
        try {
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "health_check" }], limit: 1 } })
          });
          const text = await response.text();
          return { status: response.status, ok: response.ok, body: text.substring(0, 200) };
        } catch (e: any) {
          return { error: e.message };
        }
      };

      results.restTest = {
        named: await testDb(databaseId),
        default: await testDb("(default)")
      };

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes
  app.get("/api/admin/cron-status", async (req, res) => {
    try {
      const saToken = await getServiceAccountToken();
      let tokenInfo = null;
      if (saToken) {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${saToken}`);
        tokenInfo = await res.json();
      }

      const { saUniqueId, saEmail } = await getServiceAccountInfo();
      
      let systemDoc = null;
      let userDoc = null;
      let restTest = null;
      let writeTest = "not_attempted";
      
      if (db) {
        try {
          await db.collection("system").doc("test_write").set({ 
            time: new Date().toISOString(),
            saUniqueId,
            saEmail
          });
          writeTest = "success";
          
          const systemSnap = await db.collection("system").doc(saUniqueId || "cron_identity").get();
          systemDoc = systemSnap.exists ? systemSnap.data() : null;
          
          if (saUniqueId) {
            const userSnap = await db.collection("users").doc(saUniqueId).get();
            userDoc = userSnap.exists ? userSnap.data() : null;
          }
        } catch (e: any) {
          writeTest = `failed: ${e.message}`;
        }
      }

      // Test REST API
      try {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
        const apiKey = firebaseConfig.apiKey;
        const currentProjectId = process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;
        const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
        
        let url = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseId}/documents:runQuery`;
        const headers: any = { "Content-Type": "application/json" };
        if (saToken) {
          headers["Authorization"] = `Bearer ${saToken}`;
        } else {
          url += `?key=${apiKey}`;
        }
        
        const queryBody = {
          structuredQuery: {
            from: [{ collectionId: "users" }],
            limit: 1
          }
        };

        let restRes = await fetch(url, { 
          method: "POST",
          headers,
          body: JSON.stringify(queryBody)
        });
        
        // Fallback to API Key if Token failed with 403
        if (!restRes.ok && restRes.status === 403 && saToken) {
          console.log("[Firebase Status Check] Token 403, retrying with API Key...");
          let retryUrl = url.split("?")[0];
          retryUrl += `?key=${apiKey}`;
          const retryHeaders = { "Content-Type": "application/json" };
          restRes = await fetch(retryUrl, { 
            method: "POST",
            headers: retryHeaders,
            body: JSON.stringify(queryBody)
          });
        }

        restTest = {
          status: restRes.status,
          ok: restRes.ok,
          data: await restRes.json()
        };
      } catch (e: any) {
        restTest = { error: e.message };
      }
      
      res.json({
        saUniqueId,
        saEmail,
        tokenInfo,
        saTokenAvailable: !!saToken,
        systemDoc,
        userDoc,
        writeTest,
        restTest,
        dbInitialized: !!db,
        projectId: process.env.GOOGLE_CLOUD_PROJECT
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/config/status", async (req, res) => {
    // Small delay to allow for rule propagation if needed
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let dbStatus = false;
    let dbError = null;
    let connectionType = "None";
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    const currentProjectId = projectId || firebaseConfig.projectId;
    const databaseIdToUse = databaseId || firebaseConfig.firestoreDatabaseId || "(default)";
    const apiKey = firebaseConfig.apiKey;

    try {
      if (db) {
        // Use the public health_check collection for the status check
        await db.collection("health_check").limit(1).get();
        dbStatus = true;
        connectionType = "Admin SDK (Direct)";
        dbError = null; 
      } else {
        dbError = "Admin SDK not initialized";
      }
    } catch (err: any) {
      dbError = `Admin SDK: ${err.message}`;
    }

    // If Admin SDK failed, try REST API check as fallback
    if (!dbStatus) {
      const tryRest = async (dbId: string) => {
        try {
          const restUrl = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${dbId}/documents/health_check/status?key=${apiKey}`;
          const restRes = await fetch(restUrl);
          if (restRes.ok || restRes.status === 404) return true;
          const restData: any = await restRes.json();
          console.error(`[Firebase Status] REST Error on Proj ${currentProjectId} DB [${dbId}]:`, JSON.stringify(restData));
          return restData.error?.message || `HTTP ${restRes.status}`;
        } catch (e: any) {
          return e.message;
        }
      };

      console.log(`[Firebase Status] Testing REST fallback on Proj ${currentProjectId} for database: ${databaseIdToUse}`);
      const result1 = await tryRest(databaseIdToUse);
      
      if (result1 === true) {
        dbStatus = true;
        connectionType = "REST API (Fallback)";
        dbError = null; 
      } else {
        console.log("[Firebase Status] REST fallback for configured database failed, trying (default)...");
        const result2 = await tryRest("(default)");
        if (result2 === true) {
          dbStatus = true;
          connectionType = "REST API (Default Fallback)";
          dbError = null; // Clear error because REST fallback is working
        } else {
          dbError = `${dbError} | REST [${databaseId}]: ${result1} | REST [(default)]: ${result2}`;
        }
      }
    }

    res.json({
      smtp: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      smtpDetails: {
        userLength: process.env.SMTP_USER?.length || 0,
        passLength: process.env.SMTP_PASS?.length || 0
      },
      razorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      razorpayDetails: {
        idLength: process.env.RAZORPAY_KEY_ID?.length || 0,
        secretLength: process.env.RAZORPAY_KEY_SECRET?.length || 0
      },
      gemini: !!process.env.GEMINI_API_KEY,
      db: dbStatus,
      dbError: dbError,
      connectionType: connectionType
    });
  });

  // Razorpay Order Creation
  app.post("/api/payments/create-order", async (req, res) => {
    const { amount, currency = "INR" } = req.body; // Default to INR for Razorpay/UPI context
    const rzp = getRazorpay();
    if (!rzp) {
      return res.status(500).json({ error: "Razorpay is not configured on the server." });
    }
    try {
      const options = {
        amount: amount * 100, // amount in the smallest currency unit
        currency,
        receipt: `receipt_${Date.now()}`,
      };
      const order = await rzp.orders.create(options);
      res.json(order);
    } catch (error: any) {
      console.error("Razorpay Error:", error);
      res.status(500).json({ error: "Failed to create order", details: error.message });
    }
  });

  // Stripe Checkout Session
  app.post("/api/payments/create-checkout-session", async (req, res) => {
    const { planName, amount, currency = "usd" } = req.body;
    const stripeClient = getStripe();
    
    if (!stripeClient) {
      return res.status(500).json({ error: "Stripe is not configured on the server." });
    }

    try {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `AI Tracker ${planName} Subscription`,
              },
              unit_amount: amount * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.origin}/?payment=success`,
        cancel_url: `${req.headers.origin}/?payment=cancel`,
      });

      res.json({ id: session.id });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // UPI Settings
  app.get("/api/config/upi", async (req, res) => {
    try {
      if (!db) throw new Error("DB not ready");
      const settings = await db.collection("settings").doc("payment").get();
      res.json(settings.exists ? settings.data() : { upiId: "himansh.cs91@okhdfcbank", upiName: "himanshuu yadav" });
    } catch (err) {
      // Fallback for restricted environments
      res.json({ upiId: "himansh.cs91@okhdfcbank", upiName: "AI Doc Expiry Tracker" });
    }
  });

  app.post("/api/config/upi", async (req, res) => {
    const { upiId, upiName } = req.body;
    try {
      if (!db) throw new Error("DB not ready");
      await db.collection("settings").doc("payment").set({ upiId, upiName }, { merge: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save UPI settings" });
    }
  });

  // Email Notification Route
  app.post("/api/notifications/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ error: "SMTP credentials not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: `"AI Tracker" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Email Error:", error);
      res.status(500).json({ 
        error: "Failed to send email", 
        details: error.message || "Unknown error" 
      });
    }
  });

  // Invite Route
  app.post("/api/invites/send", async (req, res) => {
    const { email, inviteLink } = req.body;
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ error: "SMTP credentials not configured" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: `"AI Tracker" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "You've been invited to AI Tracker",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563EB;">Join AI Tracker</h2>
            <p>You have been invited to collaborate on a document workspace.</p>
            <p>Click the button below to join:</p>
            <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; rounded: 8px; font-weight: bold;">Accept Invitation</a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Invite Error:", error);
      res.status(500).json({ 
        error: "Failed to send invite", 
        details: error.message || "Unknown error" 
      });
    }
  });

  // Helper to get service account token using google-auth-library
  async function getServiceAccountToken() {
    try {
      const auth = new GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/datastore',
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/firebase.database'
        ]
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) {
        console.warn("[Firebase] Token response empty");
      } else {
        console.log("[Firebase] Successfully retrieved service account access token");
      }
      return tokenResponse.token;
    } catch (e: any) {
      console.warn("[Firebase] Could not get service account token:", e.message);
      return null;
    }
  }

  // Helper to get service account unique ID and email
  async function getServiceAccountInfo() {
    try {
      const saToken = await getServiceAccountToken();
      if (!saToken) return { saUniqueId: null, saEmail: null };

      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${saToken}`);
      if (res.ok) {
        const data: any = await res.json();
        // For service accounts, 'sub', 'user_id', 'azp', or 'aud' can contain the numeric unique ID
        return { 
          saUniqueId: data.sub || data.user_id || data.azp || data.aud || null, 
          saEmail: data.email || null 
        };
      }
      return { saUniqueId: null, saEmail: null };
    } catch (e) {
      return { saUniqueId: null, saEmail: null };
    }
  }

  // Centralized Firestore REST Helper
  async function firestoreRest(collection: string, options: { userId?: string, docId?: string, token?: string, expiryDate?: string, useDefaultDb?: boolean } = {}) {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    const apiKey = firebaseConfig.apiKey;
    const currentProjectId = projectId || firebaseConfig.projectId || "unknown";
    const databaseIdToUse = options.useDefaultDb ? "(default)" : (databaseId || firebaseConfig.firestoreDatabaseId || "(default)");

    const headers: any = { "Content-Type": "application/json" };
    
    // Auth Priority: 1. User/Bearer Token (for manual actions), 2. Service Account Token (for cron), 3. API Key
    if (options.token) {
      headers["Authorization"] = `Bearer ${options.token}`;
      console.log(`[FirestoreRest] Using User/Bearer Token for ${collection}`);
    } else {
      const saToken = await getServiceAccountToken();
      if (saToken) {
        headers["Authorization"] = `Bearer ${saToken}`;
        console.log(`[FirestoreRest] Using Service Account Token for ${collection}`);
      } else {
        headers["X-Goog-Api-Key"] = apiKey; 
        console.log(`[FirestoreRest] Using API Key fallback for ${collection}`);
      }
    }

    const mapFields = (fields: any) => {
      const doc: any = {};
      if (!fields) return doc;
      Object.keys(fields).forEach(key => {
        const val = fields[key];
        if (val.stringValue !== undefined) doc[key] = val.stringValue;
        else if (val.integerValue !== undefined) doc[key] = parseInt(val.integerValue);
        else if (val.doubleValue !== undefined) doc[key] = parseFloat(val.doubleValue);
        else if (val.booleanValue !== undefined) doc[key] = val.booleanValue;
        else if (val.timestampValue !== undefined) doc[key] = val.timestampValue;
        else if (val.mapValue !== undefined) doc[key] = mapFields(val.mapValue.fields);
        else if (val.nullValue !== undefined) doc[key] = null;
        else if (val.arrayValue !== undefined) {
          doc[key] = (val.arrayValue.values || []).map((v: any) => {
            const temp = mapFields({ val: v });
            return temp.val;
          });
        }
      });
      return doc;
    };

    // Use runQuery for all collection listings to avoid permission issues with direct listing
    if (!options.docId) {
      let url = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseIdToUse}/documents:runQuery`;
      if (!headers["Authorization"]) url += `?key=${apiKey}`;

      const query: any = {
        structuredQuery: {
          from: [{ collectionId: collection }]
        }
      };

      // Add filter if userId or expiryDate is provided
      if (options.userId || (options as any).expiryDate) {
        const filters: any[] = [];
        if (options.userId) {
          filters.push({
            fieldFilter: {
              field: { fieldPath: "userId" },
              op: "EQUAL",
              value: { stringValue: options.userId }
            }
          });
        }
        if ((options as any).expiryDate) {
          filters.push({
            fieldFilter: {
              field: { fieldPath: "expiryDate" },
              op: "EQUAL",
              value: { stringValue: (options as any).expiryDate }
            }
          });
        }

        if (filters.length === 1) {
          query.structuredQuery.where = filters[0];
        } else if (filters.length > 1) {
          query.structuredQuery.where = {
            compositeFilter: {
              op: "AND",
              filters: filters
            }
          };
        }
      }

      let res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(query)
      });

      // Fallback to API Key if Token failed with 403 or 401
      if (!res.ok && (res.status === 403 || res.status === 401) && headers["Authorization"]) {
        console.info(`[Firebase] REST Query Auth Error (${res.status}), falling back to API Key for ${collection}`);
        let retryUrl = url.split("?")[0];
        retryUrl += `?key=${apiKey}`;
        const retryHeaders = { "Content-Type": "application/json" };
        res = await fetch(retryUrl, {
          method: "POST",
          headers: retryHeaders,
          body: JSON.stringify(query)
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[FirestoreRest] Error fetching ${collection} on Proj ${currentProjectId} DB ${databaseIdToUse}: Status ${res.status}`, errorText);
        
      // If 403 or 404 on named DB, and we're not already on (default), try (default)
      if (!res.ok && (res.status === 404 || res.status === 403) && databaseIdToUse !== "(default)") {
        console.warn(`[FirestoreRest] ${res.status} on project ${currentProjectId} DB ${databaseIdToUse}. Falling back to (default)...`);
        return await firestoreRest(collection, { ...options, useDefaultDb: true });
      }
      
      // If still failing and we are using config project, try env project
      const envAuth = new GoogleAuth();
      const envProjectId = await envAuth.getProjectId();
      if (!res.ok && currentProjectId !== envProjectId) {
         console.warn(`[FirestoreRest] Failure on [${currentProjectId}]. Retrying on Env Project [${envProjectId}]...`);
         process.env.GOOGLE_CLOUD_PROJECT = envProjectId; // temporary switch
         const result = await firestoreRest(collection, options);
         return result;
      }

        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error?.message || `REST Query Error: ${res.status} - ${errorText}`);
        } catch (e) {
          throw new Error(`REST Query Error: ${res.status} - ${errorText}`);
        }
      }

      const results: any[] = await res.json();
      return results
        .filter(r => r.document)
        .map(r => ({
          ...mapFields(r.document.fields),
          id: r.document.name.split("/").pop()
        }));
    }

    let url = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseIdToUse}/documents/${collection}`;
    if (options.docId) url += `/${encodeURIComponent(options.docId)}`;
    if (!headers["Authorization"]) url += `?key=${apiKey}`;

    let res = await fetch(url, { headers });
    
    // Fallback to API Key if Token failed with 403 or 401
    if (!res.ok && (res.status === 403 || res.status === 401) && headers["Authorization"]) {
      console.info(`[Firebase] REST Auth Error (${res.status}), falling back to API Key for ${collection}`);
      let retryUrl = url.split("?")[0];
      retryUrl += `?key=${apiKey}`;
      const retryHeaders = { "Content-Type": "application/json" };
      res = await fetch(retryUrl, { headers: retryHeaders });
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[FirestoreRest] Error on ${collection}: Status ${res.status}`, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error?.message || `REST API Error: ${res.status}`);
      } catch {
        throw new Error(`REST API Error: ${res.status} - ${errorText.substring(0, 100)}`);
      }
    }

    const data: any = await res.json();
    if (options.docId) {
      return mapFields(data.fields);
    } else {
      return (data.documents || []).map((d: any) => ({
        ...mapFields(d.fields),
        id: d.name.split("/").pop()
      }));
    }
  }

  // Reminder Logic
  async function checkAndSendReminders() {
    log(`[Reminders] Starting expiry check at ${new Date().toISOString()}`);
    
    const transporter = createTransporter();
    if (!transporter) {
      console.error("[Reminders] SMTP credentials missing. Reminders aborted.");
      return { success: false, error: "SMTP not configured" };
    }

    try {
      await transporter.verify();
      log("[Reminders] SMTP verified.");

      const now = new Date();
      const todayString = now.toISOString().split('T')[0];
      
      let allUsers: any[] = [];
      try {
        if (db) {
          const snapshot = await db.collection("users").get();
          allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          allUsers = await firestoreRest("users");
        }
      } catch (err) {
        console.error("[Reminders] Failed to fetch users:", err);
      }

      log(`[Reminders] Processing ${allUsers.length} users`);
      let sentCount = 0;

      for (const user of allUsers) {
        const interval = parseInt(user.expiryInterval || "30");
        const triggerDays = [...new Set([interval, 7, 1])].sort((a, b) => b - a);
        
        for (const days of triggerDays) {
          const targetDate = new Date();
          targetDate.setDate(now.getDate() + days);
          const dateString = targetDate.toISOString().split('T')[0];

          let docs: any[] = [];
          try {
            if (db) {
              const snap = await db.collection("documents")
                .where("userId", "==", user.id)
                .where("expiryDate", "==", dateString)
                .get();
              docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else {
              docs = await firestoreRest("documents", { 
                userId: user.id, 
                expiryDate: dateString 
              });
            }
          } catch (err) {
            continue;
          }

          const eligibleDocs = docs.filter(d => d.status !== 'Renewed');

          for (const doc of eligibleDocs) {
            log(`[Reminders] Sending ${days}-day alert to ${user.email} for ${doc.title}`);
            try {
              await transporter.sendMail({
                from: `"AI Tracker Reminders" <${process.env.SMTP_USER}>`,
                to: user.email || process.env.SMTP_USER,
                subject: `Action Required: ${doc.title} Expiring in ${days} Days`,
                html: `
                  <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 12px; max-width: 600px;">
                    <h2 style="color: #E11D48; margin-top: 0;">Expiry Alert</h2>
                    <p>Hello,</p>
                    <p>Your document <strong>${doc.title}</strong> is set to expire on <strong>${doc.expiryDate}</strong> (${days} days from now).</p>
                    <div style="background: #F9FAFB; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #F3F4F6;">
                      <p style="margin: 0; font-weight: bold; color: #111827;">Document Details:</p>
                      <p style="margin: 8px 0 0 0; color: #4B5563;">Type: ${doc.category}</p>
                      <p style="margin: 4px 0 0 0; color: #4B5563;">Number: ${doc.documentNumber || 'N/A'}</p>
                    </div>
                    <p>Please log in to AI Tracker to review or renew this document.</p>
                    <a href="${process.env.APP_URL || '#'}" style="display: inline-block; padding: 12px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Open Dashboard</a>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="font-size: 12px; color: #999; text-align: center;">AI Tracker - Smart Document Intelligence</p>
                  </div>
                `
              });
              sentCount++;
            } catch (mailErr) {
              console.error(`[Reminders] Mail send failed for ${user.email}:`, mailErr);
            }
          }
        }
      }

      console.log(`[Reminders] Done. Sent: ${sentCount}`);
      return { success: true, sentCount };
    } catch (error: any) {
      console.error("[Reminders] Critical failure:", error);
      return { success: false, error: error.message || String(error) };
    }
  }

  // Manual Trigger for Testing Reminders
  app.post("/api/notifications/trigger-reminders", async (req, res) => {
    const result = await checkAndSendReminders();
    if (result.success) {
      res.json({ success: true, sent: result.sentCount || 0, message: "ok" });
    } else {
      res.status(500).json(result);
    }
  });

  // Lightweight ping for cron-job.org
  // IMPORTANT: res.json() FIRST to avoid "output too large" error on cron-job.org
  app.post("/api/ping/reminders", (req, res) => {
    res.json({ ok: true }); // Respond immediately — do NOT await
    setImmediate(() => {
      checkAndSendReminders().catch(console.error);
    });
  });

  // GET version for keep-alive pings (some cron services use GET)
  app.get("/api/ping/reminders", (req, res) => {
    res.json({ ok: true });
    setImmediate(() => {
      checkAndSendReminders().catch(console.error);
    });
  });

  // Simple keep-alive ping (no logic) — use this for the "Keep Alive" cronjob
  app.get("/api/ping", (req, res) => res.json({ ok: true, ts: Date.now() }));
  app.post("/api/ping", (req, res) => res.json({ ok: true, ts: Date.now() }));

  // Manual Trigger for Testing Scheduled Reports
  app.post("/api/notifications/trigger-reports", async (req, res) => {
    try {
      await checkScheduledReports();
    res.json({ success: true, message: "Scheduled reports check triggered" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

    // Test Email
    app.post("/api/notifications/test-email", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Missing email" });

      const transporter = createTransporter();
      if (!transporter) {
        return res.status(500).json({ error: "SMTP not configured" });
      }

      try {
        console.log("[TestEmail] Verifying SMTP connection...");
        await transporter.verify();
        console.log("[TestEmail] SMTP connection verified.");
        
        await transporter.sendMail({
        from: `"AI Tracker" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "AI Tracker - Test Email",
        text: "This is a test email to verify your SMTP settings are working correctly.",
        html: "<p>This is a test email to verify your SMTP settings are working correctly.</p>",
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Test email failed:", error);
      res.status(500).json({ error: "Failed to send test email", details: error.message });
    }
  });

    // Send Full Status Report
    app.post("/api/notifications/send-report", async (req, res) => {
      const { userId, email } = req.body;
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

      console.log(`[Report] Request received for userId: ${userId}, email: ${email}`);
      
      if (!userId || !email) {
        return res.status(400).json({ error: "Missing userId or email" });
      }

      const transporter = createTransporter();
      if (!transporter) {
        return res.status(500).json({ error: "SMTP not configured" });
      }

      try {
        console.log("[Report] Verifying SMTP connection...");
        await transporter.verify();
        console.log("[Report] SMTP connection verified.");

        let docs: DocumentData[] = [];
      
      try {
        if (!db) throw new Error("Database not initialized");
        console.log(`[Report] Fetching documents for userId: ${userId} via Admin SDK`);
        const docsSnapshot = await db.collection("documents").where("userId", "==", userId).get();
        docs = docsSnapshot.docs.map(d => d.data() as DocumentData);
      } catch (adminErr: any) {
        console.info(`[Report] Using REST API path for document retrieval (Admin SDK restricted)`);
        docs = await firestoreRest("documents", { userId, token }) as any;
        console.log(`[Report] REST path found ${docs.length} documents`);
      }
      
      // Fetch user to get expiryInterval preference
      let userPref: any = { expiryInterval: "30" };
      try {
        if (db) {
          const userSnap = await db.collection("users").doc(userId).get();
          if (userSnap.exists) userPref = userSnap.data();
        } else {
          const users = await firestoreRest("users", { userId });
          if (users && users.length > 0) userPref = users[0];
        }
      } catch (prefErr) {
        console.warn("[Report] Failed to fetch user preferences, using defaults");
      }
      const interval = parseInt(userPref.expiryInterval || "30");

      console.log(`[Report] Found ${docs.length} documents. Using interval: ${interval}`);
      if (docs.length === 0) {
        await transporter.sendMail({
          from: `"AI Tracker Reports" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "AI Tracker - Document Status Report",
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px;">
              <h2 style="color: #2563EB; margin-bottom: 20px;">Document Status Report</h2>
              <p>Hello,</p>
              <p>You currently have no documents being tracked in your account.</p>
              <p>To start tracking, please upload a document or scan one using your camera.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999; text-align: center;">AI Tracker</p>
            </div>
          `
        });
        return res.json({ success: true, message: "Empty report sent" });
      }

      const tableRows = docs.map(doc => {
        const { text, color } = getStatusInfo(doc.expiryDate, interval);
        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.title}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.category}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.expiryDate}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${color}; font-weight: bold;">
              ${text}
            </td>
          </tr>
        `;
      }).join("");

      await transporter.sendMail({
        from: `"AI Tracker Reports" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "AI Tracker - Document Status Report",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px;">
            <h2 style="color: #2563EB; margin-bottom: 20px;">Document Status Report</h2>
            <p>Hello,</p>
            <p>Here is the current status of all your tracked documents:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
              <thead>
                <tr style="background: #F9FAFB; text-align: left;">
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Document</th>
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Category</th>
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Expiry</th>
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            
            <p style="margin-top: 20px; font-size: 13px; color: #666;">
              This report was generated on ${new Date().toLocaleString()}.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">AI Tracker</p>
          </div>
        `
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Report Error:", error);
      res.status(500).json({ error: "Failed to send report", details: error.message });
    }
  });

  // Update User Profile
  app.post("/api/user/profile", async (req, res) => {
    const { userId, displayName } = req.body;
    const authHeader = req.headers.authorization;
    const userToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

    if (!userId || !displayName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      let success = false;
      if (db) {
        try {
          await db.collection("users").doc(userId).set({
            displayName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          success = true;
        } catch (adminErr: any) {
          console.warn("[Profile] Admin SDK failed, using REST fallback:", adminErr.message);
        }
      }

      if (!success) {
        const saToken = await getServiceAccountToken();
        const effectiveToken = userToken || saToken;
        const updateData = {
          fields: {
            displayName: { stringValue: displayName },
            updatedAt: { timestampValue: new Date().toISOString() }
          }
        };

        const encodedUserId = encodeURIComponent(userId);
        const currentProjectId = process.env.GOOGLE_CLOUD_PROJECT || getFirebaseConfig().projectId;
        const databaseId = getFirebaseConfig().firestoreDatabaseId || "(default)";
        const apiKey = getFirebaseConfig().apiKey;
        
        const url = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseId}/documents/users/${encodedUserId}?updateMask.fieldPaths=displayName&updateMask.fieldPaths=updatedAt${effectiveToken ? '' : '&key=' + apiKey}`;
        
        const headers: any = { "Content-Type": "application/json" };
        if (effectiveToken) headers["Authorization"] = `Bearer ${effectiveToken}`;

        const restRes = await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(updateData)
        });

        if (restRes.ok) success = true;
        else console.error("[Profile] REST Fallback failed:", await restRes.text());
      }

      if (success) res.json({ status: "success" });
      else res.status(500).json({ error: "Failed to update profile after all attempts." });

    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update User Report Settings
  app.post("/api/user/report-settings", async (req, res) => {
    const { userId, frequency, time, expiryInterval, displayName, photoURL } = req.body;
    const authHeader = req.headers.authorization;
    const userToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    try {
      let success = false;
      if (db) {
        try {
          const updateData: any = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          if (frequency && time) updateData.reportSettings = { frequency, time, lastSent: null };
          if (expiryInterval) updateData.expiryInterval = expiryInterval.toString();
          if (displayName) updateData.displayName = displayName;
          if (photoURL) updateData.photoURL = photoURL;

          await db.collection("users").doc(userId).set(updateData, { merge: true });
          success = true;
        } catch (adminErr: any) {
          console.warn("[Report Settings] Admin SDK failed, using REST fallback:", adminErr.message);
        }
      }

      if (!success) {
        // REST fallback for setting user preferences
        const saToken = await getServiceAccountToken();
        const effectiveToken = userToken || saToken;
        
        const updateData: any = {
          fields: {}
        };
        if (frequency && time) {
          updateData.fields.reportSettings = {
            mapValue: {
              fields: {
                frequency: { stringValue: frequency },
                time: { stringValue: time },
                lastSent: { nullValue: null }
              }
            }
          };
        }
        if (expiryInterval) updateData.fields.expiryInterval = { stringValue: expiryInterval.toString() };
        if (displayName) updateData.fields.displayName = { stringValue: displayName };
        if (photoURL) updateData.fields.photoURL = { stringValue: photoURL };
        updateData.fields.updatedAt = { timestampValue: new Date().toISOString() };

        const tryUpdate = async (dbId: string) => {
          const encodedUserId = encodeURIComponent(userId);
          const currentProjectId = projectId; 
          const baseUrl = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${dbId}/documents/users/${encodedUserId}`;
          
          const performRequest = async (useToken: boolean, useUpdateMask: boolean) => {
            const headers: any = { "Content-Type": "application/json" };
            let url = baseUrl;
            
            if (useToken && effectiveToken) {
              headers["Authorization"] = `Bearer ${effectiveToken}`;
            } else {
              url += `${url.includes('?') ? '&' : '?'}key=${apiKey}`;
            }
            
            if (useUpdateMask) {
              const maskFields = [];
              if (frequency && time) maskFields.push("reportSettings");
              if (expiryInterval) maskFields.push("expiryInterval");
              if (displayName) maskFields.push("displayName");
              if (photoURL) maskFields.push("photoURL");
              maskFields.push("updatedAt");
              url += `${url.includes('?') ? '&' : '?'}updateMask.fieldPaths=${maskFields.join('&updateMask.fieldPaths=')}`;
            }
            
            return await fetch(url, {
              method: "PATCH",
              headers,
              body: JSON.stringify(updateData)
            });
          };

          console.log(`[Report Settings] Attempting REST PATCH to ${dbId} for user ${userId} (Token: ${effectiveToken ? (userToken ? 'User' : 'SA') : 'None'})`);
          
          // 1. Try with token and updateMask
          let res = await performRequest(true, true);

          // 2. Fallback to API Key if Token failed with 403 or 401
          if (!res.ok && (res.status === 403 || res.status === 401) && effectiveToken) {
            console.info(`[Report Settings] REST PATCH Auth Error (${res.status}), falling back to API Key for ${dbId}`);
            res = await performRequest(false, true);
          }

          // 3. If 404, the document doesn't exist. Create it.
          if (res.status === 404) {
            console.log(`[Report Settings] Document not found, creating new user document for ${userId}`);
            // Try create with token first
            res = await performRequest(true, false);
            
            // Fallback to API Key if Token failed with 403 or 401 on create
            if (!res.ok && (res.status === 403 || res.status === 401) && effectiveToken) {
              console.info(`[Report Settings] REST CREATE Auth Error (${res.status}), falling back to API Key for ${dbId}`);
              res = await performRequest(false, false);
            }
          }
          
          if (!res.ok) {
            const errBody = await res.text();
            console.error(`[Report Settings] REST Update failed for ${dbId}: ${res.status} - ${errBody}`);
          }
          
          return res;
        };

        let restRes = await tryUpdate(databaseId);

        if (!restRes.ok && (restRes.status === 404 || restRes.status === 403) && databaseId !== "(default)") {
          console.warn(`[Report Settings] Update failed on ${databaseId} (Status: ${restRes.status}), trying (default)...`);
          restRes = await tryUpdate("(default)");
        }

        if (!restRes.ok) {
          const errText = await restRes.text();
          console.error(`[Report Settings] REST Update failed: ${restRes.status}`, errText);
          
          // If 404, it might be the project ID or database ID.
          if (restRes.status === 404) {
            console.error(`[Report Settings] 404 Error Detail: Please verify Project ID [${projectId}] and Database ID [${databaseId}]`);
          }
          
          throw new Error(`REST Update failed: ${restRes.status} - ${errText}`);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Update settings error:", error);
      res.status(500).json({ error: "Failed to update settings", details: error.message });
    }
  });

  // Get User Report Settings
  app.get("/api/user/report-settings/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      let userData: any = null;
      if (db) {
        const userDoc = await db.collection("users").doc(userId).get();
        userData = userDoc.exists ? userDoc.data() : null;
      } else {
        userData = await firestoreRest("users", { docId: userId });
      }
      const reportData = userData?.reportSettings || { frequency: "none", time: "09:00" };
      res.json({
        ...reportData,
        expiryInterval: userData?.expiryInterval || "30"
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Function to send report (internal)
   async function sendScheduledReport(userId: string, email: string, userInterval: string = "30") {
    console.log(`[Scheduled Report] Sending to ${email} (userId: ${userId}, interval: ${userInterval})`);
    
    const transporter = createTransporter();
    if (!transporter) return;

    const interval = parseInt(userInterval || "30");

    try {
      console.log("[Scheduled Report] Verifying SMTP connection...");
      await transporter.verify();
      console.log("[Scheduled Report] SMTP connection verified.");
      let docs: DocumentData[] = [];
      try {
        if (db) {
          const docsSnapshot = await db.collection("documents").where("userId", "==", userId).get();
          docs = docsSnapshot.docs.map(d => d.data() as DocumentData);
        } else {
          docs = await firestoreRest("documents", { userId }) as any;
        }
      } catch (e) {
        console.error("[Scheduled Report] Failed to fetch docs:", e);
        return;
      }

      const tableRows = docs.length > 0 ? docs.map(doc => {
        const { text, color } = getStatusInfo(doc.expiryDate, interval);
        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.title}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.category}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${doc.expiryDate}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${color}; font-weight: bold;">
              ${text}
            </td>
          </tr>
        `;
      }).join("") : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No documents found</td></tr>';

      await transporter.sendMail({
        from: `"AI Tracker Reports" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "AI Tracker - Scheduled Status Report",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px;">
            <h2 style="color: #2563EB; margin-bottom: 20px;">Scheduled Status Report</h2>
            <p>Hello,</p>
            <p>Here is your scheduled document status report.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #F9FAFB; text-align: left;">
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Document</th>
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Category</th>
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Expiry</th>
                  <th style="padding: 12px; border-bottom: 2px solid #eee;">Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">AI Tracker</p>
          </div>
        `
      });

      // Update lastSent
      const nowIso = new Date().toISOString();
      let updated = false;

      if (db) {
        try {
          // Use dot notation to avoid wiping other fields in the reportSettings map
          await db.collection("users").doc(userId).update({
            "reportSettings.lastSent": nowIso
          });
          updated = true;
          console.log(`[Scheduled Report] Updated lastSent for ${userId} via Admin SDK`);
        } catch (e: any) {
          console.warn("[Scheduled Report] Admin SDK dot-notation update failed, trying full merge:", e.message);
          // Fallback to merge ONLY if update fails - note this MAY wipe frequency/time
          try {
            const userDoc = await db.collection("users").doc(userId).get();
            const currentSettings = userDoc.exists ? userDoc.data()?.reportSettings : {};
            await db.collection("users").doc(userId).set({
              reportSettings: { ...currentSettings, lastSent: nowIso }
            }, { merge: true });
            updated = true;
          } catch (mergeErr: any) {
            console.error("[Scheduled Report] Failed all update methods:", mergeErr.message);
          }
        }
      }

      if (!updated) {
        // Fallback for lastSent update
        const saToken = await getServiceAccountToken();
        const currentProjectId = process.env.GOOGLE_CLOUD_PROJECT || projectId;

        const tryUpdate = async (dbId: string) => {
          const encodedUserId = encodeURIComponent(userId);
          let url = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${dbId}/documents/users/${encodedUserId}?updateMask.fieldPaths=reportSettings.lastSent`;
          const headers: any = { "Content-Type": "application/json" };
          if (saToken) {
            headers["Authorization"] = `Bearer ${saToken}`;
          } else {
            url += `&key=${apiKey}`;
          }
          return fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              fields: {
                reportSettings: {
                  mapValue: {
                    fields: {
                      lastSent: { stringValue: nowIso }
                    }
                  }
                }
              }
            })
          });
        };

        let res = await tryUpdate(databaseId);
        if (!res.ok && databaseId !== "(default)") {
          await tryUpdate("(default)");
        }
      }
    } catch (error) {
      console.error("[Scheduled Report] Error:", error);
    }
  }

  // Check and Send Scheduled Reports
  async function checkScheduledReports() {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    log(`[Cron] Check at ${currentHour}:${currentMinute} UTC`);

    try {
      let users: any[] = [];
      const tryFetchUsers = async () => {
        try {
          if (db) {
            const usersSnapshot = await db.collection("users").where("reportSettings.frequency", "!=", "none").get();
            const fetched = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            if (fetched.length > 0) return fetched;
          }
        } catch (e: any) {
          log(`[Cron] Admin SDK fetch failed: ${e.message}`);
        }

        const tryRest = async (dbId: string) => {
          try {
            const fetched = await firestoreRest("users", { useDefaultDb: dbId === "(default)" });
            return fetched || [];
          } catch (e: any) {
            if (dbId !== "(default)") {
              try { return await firestoreRest("users", { useDefaultDb: true }); } catch {}
            }
            return [];
          }
        };

        return await tryRest(databaseId);
      };

      users = await tryFetchUsers();
      
      const eligibleUsers = users.filter(u => {
        const s = u.reportSettings;
        return s && s.frequency !== "none" && s.time;
      });

      for (const user of eligibleUsers) {
        const settings = user.reportSettings;
        const [targetH, targetM] = settings.time.split(":");
        if (targetH !== currentHour || targetM !== currentMinute) continue;

        const lastSent = settings.lastSent ? new Date(settings.lastSent) : null;
        let shouldSend = !lastSent;

        if (lastSent) {
          const diffDays = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
          if (settings.frequency === "daily" && diffDays >= 0.9) shouldSend = true;
          else if (settings.frequency === "weekly" && diffDays >= 6.9) shouldSend = true;
          else if (settings.frequency === "monthly" && diffDays >= 27.9) shouldSend = true;
        }

        if (shouldSend) {
          try {
            await sendScheduledReport(user.id, user.email, user.expiryInterval);
            console.log(`[Cron] Report sent to ${user.email}`);
          } catch (err: any) {
            console.error(`[Cron] Report failed for ${user.id}:`, err.message);
          }
        }
      }
    } catch (e: any) {
      console.error("[Cron] Failed:", e.message);
    }
  }

  // Schedule Daily Check (at 9:00 AM)
  cron.schedule("0 9 * * *", () => {
    checkAndSendReminders();
  });

  // Check scheduled reports every minute for precision
  cron.schedule("* * * * *", () => {
    checkScheduledReports();
  });

  // Helper to update user plan
  async function updateUserPlan(userId: string, plan: string) {
    console.log(`[Billing] Updating user ${userId} to plan: ${plan}`);
    try {
      if (db) {
        await db.collection("users").doc(userId).set({ plan }, { merge: true });
      } else {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
        const apiKey = firebaseConfig.apiKey;
        const currentProjectId = process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;
        const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
        const url = `https://firestore.googleapis.com/v1/projects/${currentProjectId}/databases/${databaseId}/documents/users/${userId}?updateMask.fieldPaths=plan&key=${apiKey}`;
        
        await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: { plan: { stringValue: plan } }
          })
        });
      }
      console.log(`[Billing] Successfully updated user ${userId} plan`);
    } catch (err: any) {
      console.error(`[Billing] Failed to update user plan:`, err.message);
    }
  }

  app.get("/api/admin/full-health", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      smtp: "Checking...",
      firebase: "Checking...",
      gemini: !!process.env.GEMINI_API_KEY
    };

    // 1. Test SMTP
    try {
      const transporter = createTransporter();
      if (!transporter) throw new Error("Transporter creation failed (credentials missing)");
      await transporter.verify();
      results.smtp = "Verified (Connected & Authenticated)";
    } catch (e: any) {
      results.smtp = `Failed: ${e.message}`;
    }

    // 2. Test Firebase Admin
    try {
      if (db) {
        await db.collection("health_check").doc("status").get();
        results.firebase = "Admin SDK: Connected";
      } else {
        results.firebase = "Admin SDK: Failed (Initialization Error)";
      }
    } catch (e: any) {
      results.firebase = `Admin SDK: Error (${e.message})`;
    }

    // 3. Test REST Fallback
    try {
      const docs = await firestoreRest("health_check", { useDefaultDb: false });
      results.firebaseRest = `Success (Found ${docs.length} docs in health_check)`;
    } catch (e: any) {
      results.firebaseRest = `Failed: ${e.message}`;
    }

    res.json(results);
  });

  // Razorpay Webhook
  app.post("/api/webhooks/razorpay", express.json(), async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!secret || !signature) {
      return res.status(400).send("Missing secret or signature");
    }

    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("[Razorpay Webhook] Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    const event = req.body.event;
    console.log(`[Razorpay Webhook] Received event: ${event}`);

    if (event === "payment.captured") {
      const payment = req.body.payload.payment.entity;
      const userId = payment.notes?.userId;
      const plan = payment.notes?.plan || "Monthly";
      
      if (userId) {
        await updateUserPlan(userId, plan);
      }
    }

    res.json({ status: "ok" });
  });

  // Stripe Webhook
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      const stripeClient = getStripe();
      if (!stripeClient || !endpointSecret) {
        throw new Error("Stripe or Webhook Secret not configured");
      }
      event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`[Stripe Webhook] Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan || "Monthly";

      if (userId) {
        await updateUserPlan(userId, plan);
      }
    }

    res.json({ received: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
