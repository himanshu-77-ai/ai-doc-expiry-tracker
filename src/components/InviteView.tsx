import React, { useState, useMemo } from "react";
import { UserPlus, Copy, Check, MessageCircle } from "lucide-react";

interface InviteViewProps {
  inviteEmail: string;
  setInviteEmail: (val: string) => void;
  invitePhone?: string;
  setInvitePhone?: (val: string) => void;
  isSendingInvite: boolean;
  onSendInvite: (method?: "email" | "whatsapp") => void;
}

export function InviteView({ 
  inviteEmail, 
  setInviteEmail,
  invitePhone = "",
  setInvitePhone,
  isSendingInvite, 
  onSendInvite 
}: InviteViewProps) {
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState(invitePhone);
  const [sent, setSent] = useState(false);

  // Stable invite link for this session
  const inviteId = useMemo(() => Math.random().toString(36).substr(2, 9), []);
  const inviteLink = window.location.origin + "?invite=" + inviteId;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy this link:\n" + inviteLink);
    }
  };

  // FIX: Use window.open() instead of window.location.href to avoid navigating away
  const shareWhatsAppDirect = () => {
    if (!phone) return;
    const num = phone.replace(/[^0-9]/g, "");
    if (num.length < 10) {
      alert("Please enter a valid phone number with country code (e.g. +917210033172)");
      return;
    }
    const text = encodeURIComponent(
      "You are invited to AI Tracker!\n\nTrack your document expiry dates with AI-powered reminders.\n\nJoin here: " + inviteLink
    );
    window.open("https://wa.me/" + num + "?text=" + text, "_blank");
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setPhone("");
    }, 2000);
  };

  const shareWhatsAppGeneral = () => {
    const text = encodeURIComponent(
      "You are invited to AI Tracker!\n\nTrack your document expiry dates with AI-powered reminders.\n\nJoin here: " + inviteLink
    );
    // FIX: Use window.open instead of window.location.href
    window.open("https://wa.me/?text=" + text, "_blank");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center border-b border-gray-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} />
          </div>
          <h2 className="text-2xl font-bold">Invite Your Team</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Share your document workspace with others to collaborate and track expiries together.
          </p>
        </div>

        <div className="p-6 lg:p-8 space-y-6">
          {/* WhatsApp Direct with number */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MessageCircle size={15} className="text-green-600" />
              Send via WhatsApp (Direct to number)
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && shareWhatsAppDirect()}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
              />
              <button
                onClick={shareWhatsAppDirect}
                disabled={!phone || isSendingInvite}
                className={`px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  sent 
                    ? "bg-green-100 text-green-600 border border-green-200"
                    : "bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                }`}
              >
                {sent ? <><Check size={16} /> Sent!</> : <><MessageCircle size={16} /> Send</>}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              With country code — e.g. +917210033172 (opens WhatsApp)
            </p>
          </div>

          {/* Share on WhatsApp (no number needed) */}
          <button
            onClick={shareWhatsAppGeneral}
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
              <span className="bg-white px-3 text-gray-400">Or copy invite link</span>
            </div>
          </div>

          {/* Copy Link */}
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
    </div>
  );
}
