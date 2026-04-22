import React, { useState } from "react";
import { 
  Check, 
  Zap, 
  Shield, 
  Star, 
  CreditCard,
  X,
  Loader2
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "motion/react";
import { loadStripe } from "@stripe/stripe-js";
import { User } from "../types";
import { cn } from "../lib/utils";

interface SubscriptionViewProps {
  user: User | null;
  upiSettings: { upiId: string, upiName: string };
  razorpayKeyId?: string;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  user,
  upiSettings,
  razorpayKeyId
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'stripe' | 'upi'>('razorpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [editableAmount, setEditableAmount] = useState<string>("");

  const plans = [
    { name: "Free", price: "0", features: ["Up to 5 Documents", "Basic Reminders", "Standard Search"] },
    { name: "Monthly", price: "10", features: ["Unlimited Documents", "AI OCR Scanning", "Priority Reminders", "Excel/PDF Reports", "AI Chat Assistant"], popular: true },
    { name: "Yearly", price: "100", features: ["All Monthly Features", "2 Months Free", "Priority Support", "Calendar Sync"] },
  ];

  const handlePayment = async (plan: string, usdAmount: number) => {
    setIsProcessing(true);
    const conversionRate = 90;
    const inrAmount = usdAmount * conversionRate;

    try {
      if (paymentMethod === 'upi') {
        setSelectedPlan({ name: plan, amount: inrAmount, usdAmount });
        setEditableAmount(inrAmount.toString());
        setShowUpiModal(true);
        setIsProcessing(false);
        return;
      }

      if (paymentMethod === 'stripe') {
        const stripe = await loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder");
        if (!stripe) throw new Error("Stripe failed to load");

        const response = await fetch("/api/payments/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planName: plan, amount: usdAmount }),
        });
        const session = await response.json();
        if (session.error) throw new Error(session.error);

        // @ts-ignore
        const result = await stripe.redirectToCheckout({ sessionId: session.id });
        if (result.error) alert(result.error.message);
        return;
      }

      // Default: Razorpay
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: inrAmount }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create Razorpay order");
      }

      const order = await response.json();
      if (!order.id) throw new Error("Invalid order received from server");
      
      // @ts-ignore
      const options = {
        key: razorpayKeyId || (import.meta as any).env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: order.amount,
        currency: order.currency,
        name: "AI Tracker",
        description: `${plan} Subscription`,
        order_id: order.id,
        notes: {
          userId: user?.uid,
          plan: plan
        },
        handler: function (response: any) {
          alert("Payment Successful! Payment ID: " + response.razorpay_payment_id);
        },
        prefill: {
          name: user?.displayName || "User",
          email: user?.email || "",
        },
        theme: {
          color: "#2563EB",
        },
        modal: {
          on_dismiss: function() {
            setIsProcessing(false);
          }
        }
      };
      
      // @ts-ignore
      if (!(window as any).Razorpay) {
        throw new Error("Razorpay SDK not loaded. Please confirm your internet connection.");
      }
      
      // @ts-ignore
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Payment error:", err);
      alert(`Payment failed: ${err.message || "Please check configuration."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
        <p className="text-gray-500 text-lg">Choose the plan that's right for you.</p>
        
        <div className="flex items-center justify-center gap-4 mt-8">
          <button 
            onClick={() => setPaymentMethod('razorpay')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all border",
              paymentMethod === 'razorpay' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            Razorpay
          </button>
          <button 
            onClick={() => setPaymentMethod('upi')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all border",
              paymentMethod === 'upi' ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            UPI
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.name} 
            className={cn(
              "bg-white p-8 rounded-3xl border flex flex-col h-full transition-all hover:shadow-xl",
              plan.popular ? "border-blue-600 shadow-lg lg:scale-105" : "border-gray-200"
            )}
          >
            {plan.popular && (
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-4">
                MOST POPULAR
              </span>
            )}
            <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold">${plan.price}</span>
              <span className="text-gray-500 font-medium">/ {plan.name === 'Yearly' ? 'year' : 'month'}</span>
            </div>
            {plan.price !== "0" && (
              <p className="text-sm text-gray-400 mb-8">≈ ₹{parseInt(plan.price) * 90}</p>
            )}
            {plan.price === "0" && <div className="mb-8" />}
            <ul className="space-y-4 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-gray-600">
                  <Check size={18} className="text-blue-600" />
                  <span className="text-sm font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => plan.price !== "0" && handlePayment(plan.name, parseInt(plan.price))}
              disabled={isProcessing && plan.price !== "0"}
              className={cn(
                "w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                plan.price === "0" ? "bg-gray-100 text-gray-900" :
                paymentMethod === 'stripe' ? "bg-indigo-600 text-white hover:bg-indigo-700" :
                paymentMethod === 'upi' ? "bg-orange-600 text-white hover:bg-orange-700" :
                "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {isProcessing && plan.price !== "0" ? <Loader2 className="animate-spin" size={20} /> : null}
              {plan.price === "0" ? "Current Plan" : `Upgrade via ${paymentMethod.toUpperCase()}`}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showUpiModal && selectedPlan && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6 text-center"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">UPI Payment</h3>
                <button onClick={() => setShowUpiModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center gap-4">
                <QRCodeSVG 
                  value={`upi://pay?pa=${upiSettings.upiId}&pn=${upiSettings.upiName}&am=${editableAmount}&cu=INR`}
                  size={200}
                />
                <div className="space-y-1">
                  <p className="font-bold text-lg">{upiSettings.upiName}</p>
                  <p className="text-gray-500 font-mono text-sm">{upiSettings.upiId}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500 text-sm">Amount (₹):</span>
                  <input 
                    type="number"
                    value={editableAmount}
                    onChange={(e) => setEditableAmount(e.target.value)}
                    className="w-32 px-3 py-1 border border-blue-200 rounded-lg text-right font-bold text-blue-600 outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={() => {
                  alert("Thank you! Verification will take up to 24 hours.");
                  setShowUpiModal(false);
                }}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold"
              >
                I have Paid
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
