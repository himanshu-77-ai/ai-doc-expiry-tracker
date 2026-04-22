import React from "react";
import { Shield, FileText, ChevronLeft } from "lucide-react";

interface LegalPageProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<LegalPageProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 bg-white rounded-3xl shadow-sm border border-gray-100">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors mb-8 group"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <Shield size={24} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      </div>

      <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
        <p className="text-lg leading-relaxed">
          Last updated: April 14, 2026
        </p>
        
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>
          <p>
            AI Tracker collects information you provide directly to us when you create an account, upload documents, or contact us for support. This includes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> Name, email address, and profile picture provided via Google Login.</li>
            <li><strong>Document Data:</strong> Titles, expiry dates, and images/PDFs of documents you upload for tracking.</li>
            <li><strong>Usage Data:</strong> Information about how you interact with our services.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve our services.</li>
            <li>Send you automated expiry reminders and status reports.</li>
            <li>Process payments for premium subscriptions.</li>
            <li>Respond to your comments, questions, and requests.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">3. Data Storage and Security</h2>
          <p>
            Your documents are stored securely using Firebase Storage and Firestore. We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">4. International Data Transfers</h2>
          <p>
            AI Tracker is a global service. Your information may be transferred to, and maintained on, computers located outside of your state, province, or country where the data protection laws may differ.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">5. Your Rights</h2>
          <p>
            You have the right to access, update, or delete the personal information we have on you. You can do this directly within your account settings or by contacting us.
          </p>
        </section>
      </div>
    </div>
  );
};

export const TermsOfService: React.FC<LegalPageProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 bg-white rounded-3xl shadow-sm border border-gray-100">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors mb-8 group"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <FileText size={24} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      </div>

      <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
        <p className="text-lg leading-relaxed">
          Last updated: April 14, 2026
        </p>
        
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">1. Acceptance of Terms</h2>
          <p>
            By accessing or using AI Tracker, you agree to be bound by these Terms of Service. If you do not agree to all the terms and conditions, you may not access the service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">2. Description of Service</h2>
          <p>
            AI Tracker is a document tracking and reminder service. We provide tools to help you manage document expiry dates and receive notifications.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">3. User Responsibilities</h2>
          <p>
            You are responsible for:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintaining the confidentiality of your account.</li>
            <li>The accuracy of the information you upload.</li>
            <li>Ensuring you have the right to upload the documents you provide.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">4. Subscription and Payments</h2>
          <p>
            Certain features require a paid subscription. All payments are non-refundable unless required by law. We use third-party processors (Stripe and Razorpay) to handle billing.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">5. Limitation of Liability</h2>
          <p>
            AI Tracker shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
          </p>
        </section>
      </div>
    </div>
  );
};
