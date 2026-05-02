import React, { useState, useMemo } from "react";
import { UserPlus, Copy, Check, MessageCircle } from "lucide-react";

interface InviteViewProps {
  inviteEmail: string;
  setInviteEmail: (val: string) => void;
  invitePhone: string;
  setInvitePhone: (val: string) => void;
  isSendingInvite: boolean;
  onSendInvite: (method: "email" | "whatsapp" | "both") => void;
}

export function InviteView({ 
  inviteEmail, 
  setInviteEmail,
  invitePhone,
  setInvitePhone,
  isSendingInvite, 
  onSendInvite 
}: InviteViewProps) {
  const [copied, setCopied] = useState(false);

  // Generate a stable invite link for this session
  const inviteId = useMemo(() => Math.random().toString(36).substr(2, 9), []);
  const inviteLink = `${window.location.origin}?invite=${inviteId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy this link manually:\n" + inviteLink);
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      "You are invited to AI Tracker!\n\nTrack your document expiry dates with AI-powered reminders.\n\nJoin here: " + inviteLink
    );
    window.open("https://wa.me/?text=" + text, "_blank");
  };

  const shareWhatsAppDirect = () => {
    if (!invitePhone) return;
    const phone = invitePhone.replace(/[^0-9]/g, "");
    const text = encodeURIComponent(
      "You are invited to AI Tracker!\n\nTrack your document expiry dates with AI-powered reminders.\n\nJoin here: " + inviteLink
    );
    window.open("https://wa.me/" + phone + "?text=" + text, "_blank");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-8">
      <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
        <UserPlus size={40} />
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Invite Your Team</h2>
        <p className="text-gray-500">Share your document workspace with others to collaborate and track expiries together.</p>
      </div>

      {/* WhatsApp Invite */}
      <div className="space-y-3 text-left">
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <MessageCircle size={16} className="text-green-600" />
          Send via WhatsApp (Direct)
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
          />
          <button
            onClick={shareWhatsAppDirect}
            disabled={!invitePhone}
            className="bg-green-500 text-white px-5 py-3 rounded-xl font-bold hover:bg-green-600 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            <MessageCircle size={16} /> Send
          </button>
        </div>
        <p className="text-xs text-gray-400">Enter number with country code e.g. +917210033172</p>
      </div>

      {/* Share on WhatsApp (no number needed) */}
      <button
        onClick={shareWhatsApp}
        className="w-full py-3 border-2 border-green-500 text-green-600 rounded-xl font-bold hover:bg-green-50 transition-all flex items-center justify-center gap-2"
      >
        <MessageCircle size={18} /> Share Invite on WhatsApp
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-400">Or Copy Link</span>
        </div>
      </div>

      {/* Copy Link */}
      <div className="flex gap-2">
        <input
          readOnly
          value={inviteLink}
          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm text-gray-600"
        />
        <button
          onClick={copyLink}
          className={`px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
            copied
              ? "bg-green-100 text-green-600 border border-green-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
        </button>
      </div>

      <p className="text-sm text-gray-400">Invited users will have view-only access by default.</p>
    </div>
  );
}
