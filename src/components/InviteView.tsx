import React, { useState, useMemo, useEffect } from "react";
import { UserPlus, Copy, Check, MessageCircle, Send, Clock, Calendar, Phone } from "lucide-react";

interface InviteViewProps {
  inviteEmail: string;
  setInviteEmail: (val: string) => void;
  invitePhone?: string;
  setInvitePhone?: (val: string) => void;
  isSendingInvite: boolean;
  onSendInvite: (method?: "email" | "whatsapp") => void;
  documents?: any[];
  stats?: { total: number; safe: number; expiring: number; expired: number };
  userEmail?: string;
}

export function InviteView({
  inviteEmail,
  setInviteEmail,
  invitePhone = "",
  setInvitePhone,
  isSendingInvite,
  onSendInvite,
  documents = [],
  stats,
  userEmail = "",
}: InviteViewProps) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // ── Persist phone number in localStorage ────────────────────────
  const [phone, setPhone] = useState(() => {
    return localStorage.getItem("ai_tracker_invite_phone") || invitePhone || "";
  });

  useEffect(() => {
    if (phone) localStorage.setItem("ai_tracker_invite_phone", phone);
  }, [phone]);

  // ── Stable invite link ───────────────────────────────────────────
  const inviteId = useMemo(() => {
    const stored = sessionStorage.getItem("ai_tracker_invite_id");
    if (stored) return stored;
    const id = Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem("ai_tracker_invite_id", id);
    return id;
  }, []);
  const inviteLink = window.location.origin + "?invite=" + inviteId;

  // ── Copy link ────────────────────────────────────────────────────
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy this link:\n" + inviteLink);
    }
  };

  // ── Send invite via WhatsApp (direct to number) ──────────────────
  const sendInviteWhatsApp = () => {
    const num = phone.replace(/[^0-9]/g, "");
    if (num.length < 10) {
      alert("Please enter a valid phone number with country code (e.g. +917210033172)");
      return;
    }
    const text = encodeURIComponent(
      "👋 You are invited to AI Tracker!\n\n" +
      "Track your document expiry dates with AI-powered reminders. Never miss a renewal!\n\n" +
      "🔗 Join here: " + inviteLink
    );
    window.open("https://wa.me/" + num + "?text=" + text, "_blank");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  // ── Send Document Status Report via WhatsApp ─────────────────────
  const sendReportWhatsApp = () => {
    const num = phone.replace(/[^0-9]/g, "");
    if (num.length < 10) {
      alert("Please enter phone number first to send the report.");
      return;
    }
    const safeCount = stats?.safe ?? 0;
    const expiringCount = stats?.expiring ?? 0;
    const expiredCount = stats?.expired ?? 0;
    const totalCount = stats?.total ?? documents.length;

    const docLines = documents.slice(0, 5).map((d: any) =>
      `• ${d.title} — Expires: ${d.expiryDate || "N/A"}`
    ).join("\n");

    const reportText = encodeURIComponent(
      `📊 *AI Tracker — Document Status Report*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📁 Total Documents: ${totalCount}\n` +
      `✅ Safe: ${safeCount}\n` +
      `⚠️ Expiring Soon: ${expiringCount}\n` +
      `🚨 Expired: ${expiredCount}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      (docLines ? `*Recent Documents:*\n${docLines}\n━━━━━━━━━━━━━━━━━━━━\n` : "") +
      `🔗 View Full Report: ${window.location.origin}`
    );
    window.open("https://wa.me/" + num + "?text=" + reportText, "_blank");
    setReportSent(true);
    setTimeout(() => setReportSent(false), 3000);
  };

  // ── Schedule WhatsApp report ─────────────────────────────────────
  const [scheduleFreq, setScheduleFreq] = useState(
    () => localStorage.getItem("wa_report_freq") || "weekly"
  );
  const [scheduleTime, setScheduleTime] = useState(
    () => localStorage.getItem("wa_report_time") || "09:00"
  );
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const saveSchedule = () => {
    localStorage.setItem("wa_report_freq", scheduleFreq);
    localStorage.setItem("wa_report_time", scheduleTime);
    localStorage.setItem("wa_report_phone", phone);
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 2000);
  };

  // ── Share on WhatsApp (no number) ───────────────────────────────
  const shareWhatsAppGeneral = () => {
    const text = encodeURIComponent(
      "👋 You are invited to AI Tracker!\n\n" +
      "Track your document expiry dates with AI-powered reminders.\n\n" +
      "🔗 Join here: " + inviteLink
    );
    window.open("https://wa.me/?text=" + text, "_blank");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Invite Card ── */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
        <div className="p-8 text-center border-b border-gray-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} />
          </div>
          <h2 className="text-2xl font-bold">Invite Your Team</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Share your document workspace with others to collaborate and track expiries together.
          </p>
        </div>

        <div className="p-6 lg:p-8 space-y-5">
          {/* Phone number — persistent */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Phone size={14} className="text-gray-500" />
              WhatsApp Number <span className="text-xs text-gray-400 font-normal">(saved automatically)</span>
            </label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendInviteWhatsApp()}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
            />
            <p className="text-xs text-gray-400">With country code — e.g. +917210033172</p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={sendInviteWhatsApp}
              disabled={!phone}
              className={`py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                sent
                  ? "bg-green-100 text-green-600 border border-green-200"
                  : "bg-green-500 text-white hover:bg-green-600 disabled:opacity-40"
              }`}
            >
              {sent ? <><Check size={15} /> Invite Sent!</> : <><MessageCircle size={15} /> Send Invite</>}
            </button>
            <button
              onClick={sendReportWhatsApp}
              disabled={!phone}
              className={`py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                reportSent
                  ? "bg-blue-100 text-blue-600 border border-blue-200"
                  : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
              }`}
            >
              {reportSent ? <><Check size={15} /> Report Sent!</> : <><Send size={15} /> Send Report</>}
            </button>
          </div>

          <button
            onClick={shareWhatsAppGeneral}
            className="w-full py-3 border-2 border-green-500 text-green-600 rounded-xl font-bold hover:bg-green-50 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} /> Share Invite on WhatsApp (No Number Needed)
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-400">Or copy invite link</span>
            </div>
          </div>

          {/* Copy link */}
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs text-gray-600 min-w-0"
            />
            <button
              onClick={copyLink}
              className={`px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                copied
                  ? "bg-green-100 text-green-600 border border-green-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            Invited users will have view-only access by default.
          </p>
        </div>
      </div>

      {/* ── WhatsApp Report Schedule Card ── */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 lg:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Schedule WhatsApp Reports</h3>
            <p className="text-xs text-gray-500">Get automatic status reports on WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Clock size={12} /> Frequency
            </label>
            <select
              value={scheduleFreq}
              onChange={(e) => setScheduleFreq(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/20"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Monday)</option>
              <option value="monthly">Monthly (1st)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Clock size={12} /> Time
            </label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/20"
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-700 font-medium">
            📌 Note: WhatsApp schedule preference is saved locally. You'll receive reports when you manually click "Send Report" or via the automated Twilio integration (if configured).
          </p>
        </div>

        <button
          onClick={saveSchedule}
          className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            scheduleSaved
              ? "bg-green-100 text-green-600 border border-green-200"
              : "bg-gray-900 text-white hover:bg-black"
          }`}
        >
          {scheduleSaved ? <><Check size={16} /> Schedule Saved!</> : <><Calendar size={16} /> Save Schedule Preference</>}
        </button>
      </div>
    </div>
  );
}
