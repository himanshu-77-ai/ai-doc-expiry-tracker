import React from "react";
import { UserPlus, Mail, Copy, Loader2 } from "lucide-react";

interface InviteViewProps {
  inviteEmail: string;
  setInviteEmail: (val: string) => void;
  isSendingInvite: boolean;
  onSendInvite: () => void;
}

export function InviteView({ 
  inviteEmail, 
  setInviteEmail, 
  isSendingInvite, 
  onSendInvite 
}: InviteViewProps) {
  return (
    <div className="max-w-2xl mx-auto bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-8">
      <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
        <UserPlus size={40} />
      </div>
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Invite Your Team</h2>
        <p className="text-gray-500">Share your document workspace with others to collaborate and track expiries together.</p>
      </div>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <input 
            type="email"
            placeholder="Enter email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button 
            onClick={onSendInvite}
            disabled={isSendingInvite || !inviteEmail}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSendingInvite ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
            Send Invite
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-100"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">Or Copy Link</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input 
            readOnly 
            value={`${window.location.origin}/invite/abc-123`} 
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm"
          />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/invite/abc-123`);
              alert("Invite link copied to clipboard!");
            }}
            className="bg-gray-100 text-gray-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
          >
            <Copy size={18} />
          </button>
        </div>
      </div>

      <div className="pt-8 border-t border-gray-100">
        <p className="text-sm text-gray-400">Invited users will have view-only access by default.</p>
      </div>
    </div>
  );
}
