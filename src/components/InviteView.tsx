import { useState } from "react";
import { Mail, Phone, Copy, Check, Send, MessageCircle } from "lucide-react";

interface InviteViewProps {
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  invitePhone: string;
  setInvitePhone: (v: string) => void;
  isSendingInvite: boolean;
  onSendInvite: (method: "email" | "whatsapp" | "both") => void;
}

export function InviteView({
  inviteEmail,
  setInviteEmail,
  invitePhone,
  setInvitePhone,
  isSendingInvite,
  onSendInvite,
}: InviteViewProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");

  const inviteLink = `${window.location.origin}?invite=${Math.random().toString(36).substr(2, 9)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Copy this link:\n${inviteLink}`);
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `🔐 You are invited to AI Tracker!\n\nTrack your document expiry dates with AI-powered reminders.\n\n👉 Join here: ${inviteLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center border-b border-gray-100">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send size={28} className="text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Invite Your Team</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Share your document workspace to collaborate and track expiries together.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("email")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "email"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Mail size={16} /> Email
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === "whatsapp"
                ? "text-green-600 border-b-2 border-green-600 bg-green-50/50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Email Tab */}
          {activeTab === "email" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  onKeyDown={(e) => e.key === "Enter" && onSendInvite("email")}
                />
              </div>
              <button
                onClick={() => onSendInvite("email")}
                disabled={isSendingInvite || !inviteEmail}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSendingInvite ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                ) : (
                  <><Mail size={16} /> Send Email Invite</>
                )}
              </button>
            </div>
          )}

          {/* WhatsApp Tab */}
          {activeTab === "whatsapp" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Number (with country code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Enter with country code e.g. +917210033172
                </p>
              </div>

              <button
                onClick={() => {
                  if (!invitePhone) return;
                  const text = encodeURIComponent(
                    `🔐 You are invited to AI Tracker!\n\nTrack document expiry dates with AI-powered reminders.\n\n👉 Join here: ${inviteLink}`
                  );
                  window.open(
                    `https://wa.me/${invitePhone.replace(/[^0-9]/g, "")}?text=${text}`,
                    "_blank"
                  );
                  setInvitePhone("");
                }}
                disabled={!invitePhone}
                className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} /> Send via WhatsApp
              </button>

              <button
                onClick={shareWhatsApp}
                className="w-full py-3 border-2 border-green-500 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} /> Share Link on WhatsApp
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-gray-400 uppercase tracking-wider">
                or copy link
              </span>
            </div>
          </div>

          {/* Copy Link */}
          <div className="flex gap-2">
            <div className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-500 truncate border border-gray-100">
              {inviteLink}
            </div>
            <button
              onClick={copyLink}
              className={`px-4 py-3 rounded-xl border transition-all font-medium text-sm flex items-center gap-1.5 ${
                copied
                  ? "bg-green-50 border-green-200 text-green-600"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
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
