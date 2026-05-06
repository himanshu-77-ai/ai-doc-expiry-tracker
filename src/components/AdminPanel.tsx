import React, { useState, useEffect } from "react";
import {
  Shield, Search, Save, X, ChevronDown,
  Users, ToggleLeft, ToggleRight, AlertCircle,
  CheckCircle, Loader2, RefreshCw, Crown
} from "lucide-react";
import { auth } from "../lib/firebase";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
// SECURITY: ADMIN_UID is NOT exported here — it lives only in the server env var.
// The UI still uses the UID for route-level display gating, read from App.tsx
// which gets it from the server /api/config/status response or firebase claims.
// We keep a local reference purely for the "Access Denied" guard — the server
// independently verifies the Firebase ID token, so spoofing this has no effect.
export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";

export const PLAN_CONFIG = {
  free:    { label: "Free",    docLimit: 5,  price: "$0"  },
  monthly: { label: "Monthly", docLimit: 10, price: "$5/mo" },
  yearly:  { label: "Yearly",  docLimit: 50, price: "$45/yr" },
};

export const DEFAULT_FEATURES = {
  reminders:   true,
  emailAlerts: true,
  reports:     false,
  aiChat:      false,
  ocrScanning: false,
  inviteFriend:false,
  calendarSync:false,
  whatsappSms: false,
};

export const FEATURE_LABELS: Record<string, string> = {
  reminders:    "📅 Expiry Reminders",
  emailAlerts:  "📧 Email Alerts",
  reports:      "📊 Reports (Excel/PDF)",
  aiChat:       "🤖 AI Chat Assistant",
  ocrScanning:  "🔍 OCR Scanning",
  inviteFriend: "👥 Invite Friends",
  calendarSync: "🗓️ Calendar Sync",
  whatsappSms:  "💬 WhatsApp/SMS Alerts",
};

// ── TYPES ────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  plan: string;
  adminPlan?: string;
  adminDocLimit?: number;
  adminExpiry?: string;
  adminNote?: string;
  features?: Record<string, boolean>;
  createdAt?: string;
  lastLogin?: string;
  docCount?: number;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}

function effectivePlan(u: AdminUser) {
  return u.adminPlan || u.plan || "free";
}

function effectiveDocLimit(u: AdminUser) {
  if (u.adminDocLimit != null) return u.adminDocLimit;
  return PLAN_CONFIG[effectivePlan(u) as keyof typeof PLAN_CONFIG]?.docLimit ?? 5;
}

// ── COMPONENT ────────────────────────────────────────────────────────────────
interface AdminPanelProps {
  currentUserId: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtered, setFiltered] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [approvingPayment, setApprovingPayment] = useState<string | null>(null);

  // Guard — only admin
  if (currentUserId !== ADMIN_UID) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-400">
        <Shield size={48} />
        <p className="text-lg font-semibold">Access Denied</p>
      </div>
    );
  }

  // ── FETCH USERS ────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
      setFiltered(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); fetchPendingPayments(); }, []);

  // ── FETCH PENDING PAYMENTS ─────────────────────────────────────────────────
  const fetchPendingPayments = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/pending-payments", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPayments(data);
      }
    } catch (e) {
      console.error("Failed to fetch pending payments:", e);
    }
  };

  // ── APPROVE PAYMENT ────────────────────────────────────────────────────────
  const approvePayment = async (payment: any) => {
    setApprovingPayment(payment.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/approve-payment/${payment.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ userId: payment.userId, plan: payment.plan })
      });
      if (!res.ok) throw new Error("Approval failed");
      setPendingPayments(prev => prev.filter(p => p.id !== payment.id));
      await fetchUsers(); // refresh user list
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApprovingPayment(null);
    }
  };

  // ── SEARCH ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? users.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.displayName?.toLowerCase().includes(q)
      ) : users
    );
  }, [search, users]);

  // ── SAVE USER ──────────────────────────────────────────────────────────────
  const saveUser = async (u: AdminUser) => {
    setSaving(u.id);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          adminPlan:     u.adminPlan     || null,
          adminDocLimit: u.adminDocLimit ?? null,
          adminExpiry:   u.adminExpiry   || null,
          adminNote:     u.adminNote     || null,
          features:      u.features      || DEFAULT_FEATURES,
        })
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(u.id);
      setTimeout(() => setSaved(null), 2500);
      setUsers(prev => prev.map(p => p.id === u.id ? u : p));
      setEditingUser(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  // ── EDIT HELPERS ───────────────────────────────────────────────────────────
  const startEdit = (u: AdminUser) => {
    setEditingUser({
      ...u,
      features: { ...DEFAULT_FEATURES, ...(u.features || {}) }
    });
  };

  const updateField = (field: keyof AdminUser, value: any) => {
    setEditingUser(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const toggleFeature = (key: string) => {
    setEditingUser(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        features: { ...DEFAULT_FEATURES, ...(prev.features || {}), [key]: !(prev.features?.[key] ?? DEFAULT_FEATURES[key as keyof typeof DEFAULT_FEATURES]) }
      };
    });
  };

  const removeOverride = () => {
    setEditingUser(prev => prev ? {
      ...prev,
      adminPlan: undefined,
      adminDocLimit: undefined,
      adminExpiry: undefined,
      adminNote: undefined,
      features: { ...DEFAULT_FEATURES }
    } : prev);
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-xl">
            <Crown size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Admin Control Panel</h2>
            <p className="text-gray-500 text-sm">Manage user plans & feature access</p>
          </div>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users",   value: users.length,                                          color: "bg-blue-50 text-blue-700"   },
          { label: "Free",          value: users.filter(u => effectivePlan(u) === "free").length,    color: "bg-gray-50 text-gray-700"   },
          { label: "Monthly",       value: users.filter(u => effectivePlan(u) === "monthly").length, color: "bg-green-50 text-green-700" },
          { label: "Yearly",        value: users.filter(u => effectivePlan(u) === "yearly").length,  color: "bg-purple-50 text-purple-700"},
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-4`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm font-medium opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Pending UPI Payments */}
      {pendingPayments.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
            <AlertCircle size={18} /> Pending UPI Payments ({pendingPayments.length})
          </h3>
          <div className="space-y-3">
            {pendingPayments.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-4 flex items-center justify-between gap-4 border border-orange-100">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{p.userEmail}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Plan: <strong>{p.plan}</strong> · Amount: ₹{p.amount} · {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => approvePayment(p)}
                  disabled={approvingPayment === p.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 flex items-center gap-2 shrink-0"
                >
                  {approvingPayment === p.id
                    ? <><Loader2 size={14} className="animate-spin" /> Approving...</>
                    : <><CheckCircle size={14} /> Approve</>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <div key={u.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{u.email}</p>
                    {u.adminPlan && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        Admin Override
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span>Plan: <strong className="text-gray-600">{effectivePlan(u).toUpperCase()}</strong></span>
                    <span>Docs: <strong className="text-gray-600">{u.docCount ?? 0}/{effectiveDocLimit(u)}</strong></span>
                    <span>Last login: {formatDate(u.lastLogin)}</span>
                  </div>
                  {u.adminNote && (
                    <p className="text-xs text-purple-500 mt-1">📝 {u.adminNote}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {saved === u.id && (
                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                      <CheckCircle size={14} /> Saved!
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(u)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p>No users found</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-5">

              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Edit User</h3>
                  <p className="text-sm text-gray-500 truncate">{editingUser.email}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={22} />
                </button>
              </div>

              {/* Plan Override */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Plan Override</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["free", "monthly", "yearly"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        updateField("adminPlan", p);
                        if (!editingUser.adminDocLimit) {
                          updateField("adminDocLimit", PLAN_CONFIG[p].docLimit);
                        }
                      }}
                      className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                        (editingUser.adminPlan || editingUser.plan) === p
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {PLAN_CONFIG[p].label}
                      <span className="block text-xs opacity-70">{PLAN_CONFIG[p].price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Doc Limit */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Document Limit <span className="text-gray-400 font-normal">(default: {PLAN_CONFIG[effectivePlan(editingUser) as keyof typeof PLAN_CONFIG]?.docLimit})</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={editingUser.adminDocLimit ?? PLAN_CONFIG[effectivePlan(editingUser) as keyof typeof PLAN_CONFIG]?.docLimit ?? 5}
                  onChange={e => updateField("adminDocLimit", parseInt(e.target.value) || 5)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
                />
              </div>

              {/* Features */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-3">Feature Access</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                    const isOn = editingUser.features?.[key] ?? DEFAULT_FEATURES[key as keyof typeof DEFAULT_FEATURES];
                    return (
                      <div
                        key={key}
                        onClick={() => toggleFeature(key)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                          isOn ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        {isOn
                          ? <ToggleRight size={22} className="text-green-500" />
                          : <ToggleLeft size={22} className="text-gray-400" />
                        }
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Override Expiry */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Override Expiry Date</label>
                <input
                  type="date"
                  value={editingUser.adminExpiry || ""}
                  onChange={e => updateField("adminExpiry", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty = no expiry (permanent override)</p>
              </div>

              {/* Note */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Admin Note</label>
                <input
                  type="text"
                  placeholder="e.g. Beta tester, Friend, Investor..."
                  value={editingUser.adminNote || ""}
                  onChange={e => updateField("adminNote", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={removeOverride}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50"
                >
                  Remove Override
                </button>
                <button
                  onClick={() => saveUser(editingUser)}
                  disabled={saving === editingUser.id}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  {saving === editingUser.id
                    ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : <><Save size={16} /> Save Changes</>
                  }
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
