/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  LayoutDashboard, 
  FileText, 
  Bell, 
  Calendar, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  MessageSquare,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CreditCard,
  UserPlus,
  ChevronRight,
  X,
  Loader2,
  FileUp,
  Trash2,
  Eye,
  RefreshCw,
  Copy,
  Check,
  Camera,
  Edit,
  Mail,
  ExternalLink,
  CalendarDays,
  Save,
  BarChart3,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isAfter, isBefore, addDays, differenceInDays, parseISO } from "date-fns";
import { useDropzone } from "react-dropzone";
import { extractDocumentInfo, chatWithAssistant } from "./lib/gemini";
import { compressImage, cn, getDynamicStatus } from "./lib/utils";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import Webcam from "react-webcam";
import { QRCodeSVG } from "qrcode.react";
import { loadStripe } from "@stripe/stripe-js";
import { auth, db, storage } from "./lib/firebase";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from "firebase/storage";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  updateProfile
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  updateDoc,
  setDoc,
  getDoc,
  getDocs
} from "firebase/firestore";

import { Document, User } from "./types";
import { DashboardView } from "./components/DashboardView";
import { Sidebar } from "./components/Sidebar";
import { DocumentCard } from "./components/DocumentCard";
import { DocumentTable } from "./components/DocumentTable";
import { UploadModal } from "./components/UploadModal";
import { CameraModal } from "./components/CameraModal";
import { ChatAssistant } from "./components/ChatAssistant";
import { CalendarView } from "./components/CalendarView";
import { SettingsView } from "./components/SettingsView";
import { SubscriptionView } from "./components/SubscriptionView";
import { RemindersView } from "./components/RemindersView";
import { InviteView } from "./components/InviteView";
import { ReportsView } from "./components/ReportsView";
import { Header } from "./components/Header";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { PrivacyPolicy, TermsOfService } from "./components/LegalPages";
import { StatCard, StatusBadge } from "./components/Common";

const base64ToFile = (base64: string, filename: string) => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [saveStage, setSaveStage] = useState<'idle' | 'preparing' | 'uploading' | 'database'>('idle');
  const [manualFormData, setManualFormData] = useState({
    title: "",
    category: "Other",
    expiryDate: "",
    issueDate: "",
    documentNumber: "",
    summary: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTriggeringReminders, setIsTriggeringReminders] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isTestingStorage, setIsTestingStorage] = useState(false);

  const sendReport = async () => {
    if (!user) {
      alert("You must be logged in to send a report.");
      return;
    }
    setIsSendingReport(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/notifications/send-report", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email
        })
      });
      const data = await response.json();
      if (response.ok) {
        alert("Full status report sent to your email!");
      } else {
        alert(`Failed to send report: ${data.details || data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Report connection error:", err);
      alert("Error connecting to server for status report.");
    } finally {
      setIsSendingReport(false);
    }
  };

  const saveReportSettings = async () => {
    if (!user) return;
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/user/report-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          expiryInterval,
          ...reportSettings
        })
      });
      if (response.ok) {
        alert("Report schedule updated successfully!");
      } else {
        alert("Failed to update schedule.");
      }
    } catch (err) {
      console.error("Save settings error:", err);
      alert("Error saving report schedule.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const triggerReminders = async () => {
    setIsTriggeringReminders(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/notifications/trigger-reminders", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Reminder check complete. Emails sent: ${data.sentCount || 0}`);
      } else {
        alert(`Failed to trigger reminders: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Trigger reminders error:", err);
      alert("An error occurred while triggering reminders.");
    } finally {
      setIsTriggeringReminders(false);
    }
  };
  const [scannedData, setScannedData] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: "Hello! I'm your **AI Tracker Assistant**. I can help you track expiries, summarize your assets, and answer questions about your documents.\n\nHow can I assist you today?" }
  ]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (scannedData) {
      setManualFormData({
        title: scannedData.title || "",
        category: scannedData.category || "Other",
        expiryDate: scannedData.expiryDate || "",
        issueDate: scannedData.issueDate || "",
        documentNumber: scannedData.documentNumber || "",
        summary: scannedData.summary || ""
      });
    }
  }, [scannedData]);
  const [error, setError] = useState<string | null>(null);
  const [configStatus, setConfigStatus] = useState<{ 
    smtp: boolean, 
    razorpay: boolean, 
    razorpayKeyId?: string,
    gemini: boolean, 
    db: boolean, 
    dbError?: string | null,
    connectionType?: string
  } | null>(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [reportSettings, setReportSettings] = useState({ frequency: 'none', time: '09:00' });
  const [upiSettings, setUpiSettings] = useState({ upiId: "", upiName: "" });
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'stripe' | 'upi'>('razorpay');

  useEffect(() => {
    fetch("/api/config/upi")
      .then(res => res.json())
      .then(data => setUpiSettings(data))
      .catch(err => console.error("Failed to load UPI settings:", err));
  }, []);

  useEffect(() => {
    if (user) {
      console.log("Fetching report settings for user:", user.uid);
      setIsInitialLoadComplete(false); // Reset to prevent premature auto-saves
      fetch(`/api/user/report-settings/${user.uid}`)
        .then(res => res.json())
        .then(data => {
          console.log("Report settings received:", data);
          if (data) {
            setReportSettings({
              frequency: data.frequency || 'none',
              time: data.time || '09:00'
            });
            if (data.expiryInterval) {
              const parsedVal = parseInt(data.expiryInterval);
              if (!isNaN(parsedVal)) {
                console.log("Setting expiry interval from DB:", parsedVal);
                setExpiryInterval(parsedVal);
              }
            }
          }
          // Delay marking load as complete to ensure state updates have propagated
          setTimeout(() => {
            console.log("Initial load marked as complete for:", user.uid);
            setIsInitialLoadComplete(true);
          }, 1000);
        })
        .catch(err => {
          console.error("Failed to load report settings:", err);
          setIsInitialLoadComplete(true);
        });
    } else {
      setIsInitialLoadComplete(false);
    }
  }, [user]);

  const saveProfile = async (data: { displayName: string, expiryInterval: number, photoFile?: File }) => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      let finalPhotoURL = user.photoURL;

      if (data.photoFile) {
        console.log("Uploading custom profile picture via Resumable task...");
        const profileRef = ref(storage, `profiles/${user.uid}/${Date.now()}_thumb`);
        const uploadTask = uploadBytesResumable(profileRef, data.photoFile);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', null, 
            (error) => reject(new Error(`Profile image upload failed: ${error.message}`)), 
            () => resolve()
          );
          setTimeout(() => reject(new Error("Profile image upload timed out.")), 30000);
        });
        
        finalPhotoURL = await getDownloadURL(uploadTask.snapshot.ref);
        console.log("Profile picture uploaded successfully:", finalPhotoURL);
      }

      // Update Firebase Auth Profile
      await updateProfile(auth.currentUser!, {
        displayName: data.displayName,
        photoURL: finalPhotoURL
      });

      // Update Firestore Record
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/user/report-settings", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.uid,
          displayName: data.displayName,
          expiryInterval: data.expiryInterval,
          photoURL: finalPhotoURL,
          ...reportSettings
        })
      });

      if (response.ok) {
        // Force state update to reflect new profile info
        setUser(prev => prev ? { ...prev, displayName: data.displayName, photoURL: finalPhotoURL } : null);
        alert("Account settings saved successfully!");
      } else {
        alert("Failed to save account settings.");
      }
    } catch (err) {
      console.error("Save profile error:", err);
      alert("Error saving account settings. Please check your connection.");
    } finally {
      setIsSavingProfile(false);
    }
  };
  const [copiedError, setCopiedError] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [docToEdit, setDocToEdit] = useState<Document | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [calendarFilter, setCalendarFilter] = useState<'All' | 'Safe' | 'Expiring Soon' | 'Expired'>('All');
  const [expiryInterval, setExpiryInterval] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const webcamRef = React.useRef<Webcam>(null);

  // Auto-save settings
  useEffect(() => {
    if (!user || !isInitialLoadComplete || expiryInterval === null) return;
    const timer = setTimeout(async () => {
      console.log("Auto-saving settings...", { expiryInterval, ...reportSettings });
      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch("/api/user/report-settings", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ userId: user.uid, expiryInterval, ...reportSettings })
        });
      } catch (err) {
        console.error("Auto-save settings failed:", err);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [reportSettings, expiryInterval, user, isInitialLoadComplete]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/config/upi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(upiSettings)
        });
      } catch (err) {
        console.error("Auto-save UPI settings failed:", err);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [upiSettings, user]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);

      if (user) {
        // Sync user profile to Firestore for server-side reminders
        try {
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to sync user profile:", err);
        }
      }
    });
    
    // Fetch config status
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/config/status");
        const data = await res.json();
        setConfigStatus(data);
      } catch (err) {
        console.error("Failed to fetch config status:", err);
      }
    };
    fetchStatus();

    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    if (!user) {
      setDocuments([]);
      return;
    }

    const q = query(
      collection(db, "documents"), 
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Document[];
      setDocuments(docs);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Failed to fetch documents. Please check your permissions.");
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === "auth/unauthorized-domain") {
        setError(`Unauthorized Domain: Please add ${window.location.hostname} to your Firebase authorized domains.`);
      } else {
        setError(`Login failed: ${err.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Status calculation
  const getStatus = useCallback((expiryDate: string): Document['status'] => {
    return getDynamicStatus(expiryDate, expiryInterval ?? 30);
  }, [expiryInterval]);

  const handleRenew = async (docObj: Document) => {
    try {
      if (!user) return;
      console.log(`Renewing document: ${docObj.title}`);
      const docRef = doc(db, "documents", docObj.id);
      await updateDoc(docRef, {
        status: 'Renewed',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Renew error:", err);
      setError("Failed to mark document as renewed.");
    }
  };

  // Optimized stats and filtering
  const stats = useMemo(() => ({
    total: documents.length,
    safe: documents.filter(d => d.status === 'Renewed' || getStatus(d.expiryDate) === 'Safe').length,
    expiring: documents.filter(d => d.status !== 'Renewed' && getStatus(d.expiryDate) === 'Expiring Soon').length,
    expired: documents.filter(d => d.status !== 'Renewed' && getStatus(d.expiryDate) === 'Expired').length,
  }), [documents, getStatus]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const docTitle = doc.title || "";
      const docCat = doc.category || "";
      const matchesSearch = docTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          docCat.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterCategory === 'All' || docCat === filterCategory;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [documents, searchQuery, filterCategory]);

  const handleFileUpload = async (files: File[]) => {
    console.log("handleFileUpload started", { filesCount: files.length });
    if (!user) {
      console.error("Upload failed: User not logged in");
      setError("You must be logged in to upload documents.");
      return;
    }
    const file = files[0];
    if (!file) {
      console.warn("Upload failed: No file selected");
      return;
    }
    setSelectedFile(file);

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      console.error("Upload failed: File too large", file.size);
      setError("File is too large. Please upload a file smaller than 10MB.");
      return;
    }

    setIsScanning(true);
    setError(null);
    try {
      console.log("Starting image compression...");
      const { blob, base64 } = await compressImage(file);
      const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
      setSelectedFile(compressedFile);
      
      const mimeType = "image/jpeg";
      console.log("Compression success, starting extraction...", { size: blob.size });
      
      const info = await extractDocumentInfo(base64, mimeType);
      console.log("AI Extraction success:", info);
      
      // Use URL.createObjectURL for faster preview instead of FileReader
      const previewUrl = URL.createObjectURL(blob);
      setScannedData({ ...info, fileUrl: previewUrl, base64 });
      setIsScanning(false);
    } catch (error: any) {
      console.error("Upload error in handleFileUpload:", error);
      setError(error.message || "Failed to process document.");
      setIsScanning(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      console.error("File rejections:", fileRejections);
      setError("Invalid file type. Please upload an image or PDF.");
      return;
    }
    console.log("Files dropped:", acceptedFiles);
    handleFileUpload(acceptedFiles);
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    multiple: false
  });

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput;
    setChatInput("");
    setIsChatLoading(true);
    const newMessages = [...chatMessages, { role: 'user' as const, text: userMsg }];
    setChatMessages(newMessages);

    try {
      const safeDocs = documents.filter(d => d.status === 'Renewed' || getStatus(d.expiryDate) === 'Safe');
      const soonDocs = documents.filter(d => d.status !== 'Renewed' && getStatus(d.expiryDate) === 'Expiring Soon');
      const expiredDocs = documents.filter(d => d.status !== 'Renewed' && getStatus(d.expiryDate) === 'Expired');

      let docsContext = `--- ASSET HEALTH REPORT ---\n`;
      docsContext += `Summary: ${documents.length} objects total. ${expiredDocs.length} critical, ${soonDocs.length} at risk, ${safeDocs.length} secure.\n\n`;
      
      if (expiredDocs.length > 0) {
        docsContext += "CRITICAL EXPIRY LIST:\n" + expiredDocs.slice(0, 10).map(d => `- ${d.title} (Expired: ${d.expiryDate})`).join("\n") + (expiredDocs.length > 10 ? "\n... and others" : "") + "\n\n";
      }
      if (soonDocs.length > 0) {
        docsContext += "AT-RISK LIST (Expiring Soon):\n" + soonDocs.slice(0, 10).map(d => `- ${d.title} (Expires: ${d.expiryDate})`).join("\n") + (soonDocs.length > 10 ? "\n... and others" : "") + "\n\n";
      }
      if (safeDocs.length > 0) {
        docsContext += "SECURE LIST:\n" + safeDocs.slice(0, 5).map(d => `- ${d.title} (Valid: ${d.expiryDate})`).join("\n") + (safeDocs.length > 5 ? `\n... plus ${safeDocs.length - 5} other secure items.` : "") + "\n\n";
      }

      console.log("Chat Context Prep:", docsContext);
      const response = await chatWithAssistant(newMessages, userMsg, docsContext);
      setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error: any) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Sorry, I'm having trouble: ${error.message || "Unknown error"}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      const data = documents.map(d => {
        let createdAtDate: Date | null = null;
        if (d.createdAt) {
          if (d.createdAt.seconds) createdAtDate = new Date(d.createdAt.seconds * 1000);
          else if (d.createdAt instanceof Date) createdAtDate = d.createdAt;
          else {
            const parsed = new Date(d.createdAt);
            if (!isNaN(parsed.getTime())) createdAtDate = parsed;
          }
        }

        return {
          'Document Name': d.title,
          'Category': d.category,
          'Expiry Date': d.expiryDate,
          'Status': d.status === 'Renewed' ? 'Renewed' : getStatus(d.expiryDate),
          'Document Number': d.documentNumber || 'N/A',
          'Summary': d.summary || 'N/A',
          'Created At': createdAtDate ? format(createdAtDate, 'yyyy-MM-dd HH:mm') : 'N/A'
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths
    const wscols = [
      { wch: 30 }, // Name
      { wch: 15 }, // Category
      { wch: 15 }, // Expiry
      { wch: 15 }, // Status
      { wch: 20 }, // Doc Number
      { wch: 20 }, // Created At
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
    XLSX.writeFile(wb, "AI_Tracker_Report.xlsx");
    } catch (err) {
      console.error("Excel Export error:", err);
      setError("Failed to generate Excel report.");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("AI Tracker - Document Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 30);
      
      // @ts-ignore
      doc.autoTable({
        startY: 40,
        head: [['Title', 'Category', 'Expiry Date', 'Status', 'Doc Number']],
        body: documents.map(d => [d.title, d.category, d.expiryDate, getStatus(d.expiryDate), d.documentNumber || '-']),
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 249, 250] }
      });
      
      doc.save("AI_Tracker_Report.pdf");
    } catch (err) {
      console.error("PDF Export error:", err);
      setError("Failed to generate PDF report.");
    }
  };

  const captureCamera = useCallback(async () => {
    console.log("captureCamera triggered");
    if (!user) {
      console.error("Capture failed: User not logged in");
      setError("You must be logged in to capture documents.");
      return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera access is not supported by your browser or is blocked. Please try opening the app in a new tab.");
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      console.log("Screenshot captured successfully");
      setIsCameraOpen(false);
      setIsScanning(true);
      setError(null);
      try {
        console.log("Compressing camera capture...");
        const { blob, base64 } = await compressImage(imageSrc);
        const compressedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(compressedFile);
        
        console.log("Camera capture compressed, starting extraction...");
        const info = await extractDocumentInfo(base64, "image/jpeg");
        console.log("AI Extraction success from camera:", info);
        
        const previewUrl = URL.createObjectURL(blob);
        setScannedData({ ...info, fileUrl: previewUrl, base64 });
        setIsScanning(false);
      } catch (err: any) {
        console.error("Camera scan error:", err);
        setError(err.message || "Failed to process captured image. AI scan failed.");
        setIsScanning(false);
      }
    } else {
      console.warn("Capture failed: No image source from webcam. Check camera permissions.");
      setError("Failed to capture image. Please ensure your camera is enabled and permitted.");
    }
  }, [webcamRef, user]);

  const refreshConfigStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      const response = await fetch("/api/config/status");
      const data = await response.json();
      setConfigStatus(data);
    } catch (err) {
      console.error("Config status error:", err);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setIsSendingInvite(true);
    try {
      const inviteId = Math.random().toString(36).substr(2, 9);
      const response = await fetch("/api/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          inviteLink: `${window.location.origin}?invite=${inviteId}`
        })
      });
      if (response.ok) {
        alert("Invite sent successfully!");
        setInviteEmail("");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to send invite");
      }
    } catch (err: any) {
      console.error("Invite error:", err);
      setError(`Failed to send invite: ${err.message}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const updateDocument = async (id: string, data: Partial<Document>) => {
    try {
      const docRef = doc(db, "documents", id);
      await updateDoc(docRef, data);
      setDocToEdit(null);
    } catch (err) {
      console.error("Update error:", err);
      setError("Failed to update document.");
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      await deleteDoc(doc(db, "documents", id));
      setDocToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete document.");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center space-y-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/20">
            <ShieldCheck size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">AI Tracker</h1>
            <p className="text-gray-500">Securely track and manage your important documents with AI.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        handleLogout={handleLogout} 
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          user={user}
          setIsSidebarOpen={setIsSidebarOpen}
          setIsUploadModalOpen={setIsUploadModalOpen}
          setManualFormData={setManualFormData}
          setScannedData={setScannedData}
          setSelectedFile={setSelectedFile}
          exportToExcel={exportToExcel}
          exportToPDF={exportToPDF}
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-12">
          <ErrorDisplay error={error} setError={setError} />
          
          {activeTab === "dashboard" && (
            <DashboardView 
              stats={stats}
              upcomingDocuments={documents.filter(d => getStatus(d.expiryDate) !== 'Safe' && d.status !== 'Renewed')}
              onScanClick={() => setIsUploadModalOpen(true)}
              onRenew={handleRenew}
              getStatus={getStatus}
              configStatus={configStatus}
              onTabChange={setActiveTab}
            />
          )}

          {activeTab === "documents" && (
            <DocumentTable 
              documents={filteredDocs}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              onEdit={setDocToEdit}
              onDelete={setDocToDelete}
              onView={setSelectedDoc}
            />
          )}

          {activeTab === "subscription" && (
            <SubscriptionView 
              user={user} 
              upiSettings={upiSettings} 
              razorpayKeyId={configStatus?.razorpayKeyId} 
            />
          )}
          {activeTab === "privacy" && <PrivacyPolicy onBack={() => setActiveTab("dashboard")} />}
          {activeTab === "terms" && <TermsOfService onBack={() => setActiveTab("dashboard")} />}
          {activeTab === "settings" && (
            <SettingsView 
              user={user}
              configStatus={configStatus}
              isRefreshingStatus={isRefreshingStatus}
              onRefreshStatus={refreshConfigStatus}
              copiedError={copiedError}
              onCopyError={() => {
                const errorText = `DATABASE DIAGNOSTICS:\n\nConnection Type: ${configStatus.connectionType || 'Unknown'}\n\nError Message:\n${configStatus.dbError}`;
                navigator.clipboard.writeText(errorText);
                setCopiedError(true);
                setTimeout(() => setCopiedError(false), 2000);
              }}
              isSendingEmail={isSendingEmail}
              onSendTestEmail={async () => {
                if (!user?.email) {
                  alert("User email not found. Are you logged in?");
                  return;
                }
                setIsSendingEmail(true);
                try {
                  const response = await fetch("/api/notifications/send-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      to: user.email,
                      subject: "AI Tracker Test Email",
                      text: "This is a test email from AI Powered Document Expiry Tracker to verify your SMTP settings.",
                      html: "<h1>AI Tracker</h1><p>Your SMTP settings are working correctly!</p>"
                    })
                  });
                  if (response.ok) alert("Test email sent! Check your inbox.");
                  else {
                    const errData = await response.json();
                    alert(`Failed to send test email: ${errData.details || errData.error || "Unknown error"}`);
                  }
                } catch (err) {
                  console.error("Test email error:", err);
                  alert("Error connecting to server for test email.");
                } finally {
                  setIsSendingEmail(false);
                }
              }}
              isTriggeringReminders={isTriggeringReminders}
              onTriggerReminders={triggerReminders}
              isSendingReport={isSendingReport}
              onSendReport={sendReport}
              reportSettings={reportSettings}
              setReportSettings={setReportSettings}
              isSavingSettings={isSavingSettings}
              onSaveReportSettings={saveReportSettings}
              expiryInterval={expiryInterval ?? 30}
              setExpiryInterval={setExpiryInterval}
              upiSettings={upiSettings}
              setUpiSettings={setUpiSettings}
              isSavingUpi={isSavingUpi}
              onSaveUpiSettings={async () => {
                setIsSavingUpi(true);
                try {
                  const response = await fetch("/api/config/upi", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(upiSettings)
                  });
                  if (response.ok) {
                    alert("UPI settings saved successfully!");
                  } else {
                    alert("Failed to save UPI settings.");
                  }
                } catch (err) {
                  console.error("Save UPI error:", err);
                  alert("Error saving UPI settings.");
                } finally {
                   setIsSavingUpi(false);
                }
              }}
              onSaveProfile={saveProfile}
              isSavingProfile={isSavingProfile}
              recentDocuments={documents}
              isTestingStorage={isTestingStorage}
              onTestStorage={async () => {
                if (!user) return;
                setIsTestingStorage(true);
                try {
                  console.log("Testing storage connection with dummy file...");
                  const testRef = ref(storage, `tests/${user.uid}/test_${Date.now()}.txt`);
                  const blob = new Blob(["Storage Connection Test"], { type: "text/plain" });
                  
                  const timeoutPromise = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Storage test timed out (30s).")), 30000)
                  );
                  
                  const uploadPromise = (async () => {
                    await uploadBytes(testRef, blob);
                    return "Success";
                  })();
                  
                  await Promise.race([uploadPromise, timeoutPromise]);
                  alert("Storage Connection SUCCESS: Your browser can communicate with Firebase Storage.");
                } catch (err: any) {
                  console.error("Storage Test Error:", err);
                  alert(`Storage Connection FAILED: ${err.message}\n\nThis usually means your network or firewall is blocking Firebase Storage binary uploads.`);
                } finally {
                  setIsTestingStorage(false);
                }
              }}
            />
          )}
          {activeTab === "invite" && (
            <InviteView 
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              isSendingInvite={isSendingInvite}
              onSendInvite={sendInvite}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarView 
              documents={documents}
              currentCalendarDate={currentCalendarDate}
              setCurrentCalendarDate={setCurrentCalendarDate}
              calendarFilter={calendarFilter}
              setCalendarFilter={setCalendarFilter}
              setSelectedDoc={setSelectedDoc}
              getStatus={getStatus}
            />
          )}

          {activeTab === "reminders" && (
            <RemindersView 
              documents={documents}
              getStatus={getStatus}
              isTriggeringReminders={isTriggeringReminders}
              onTriggerReminders={triggerReminders}
              expiryInterval={expiryInterval ?? 30}
              setExpiryInterval={setExpiryInterval}
              onRenew={handleRenew}
            />
          )}

          {activeTab === "reports" && (
            <ReportsView 
              documents={documents}
              isSendingReport={isSendingReport}
              onSendReport={sendReport}
              reportSettings={reportSettings}
              onSaveReportSettings={saveReportSettings}
              setReportSettings={setReportSettings}
              isSavingSettings={isSavingSettings}
              expiryInterval={expiryInterval ?? 30}
            />
          )}
        </div>
      </main>

      {/* AI Chat Button */}
      <button 
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
      >
        <MessageSquare size={24} />
      </button>

      <ChatAssistant 
        isOpen={isChatOpen}
        setIsOpen={setIsChatOpen}
        messages={chatMessages}
        input={chatInput}
        setInput={setChatInput}
        onSend={handleSendMessage}
        isLoading={isChatLoading}
      />

      <UploadModal 
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setScannedData(null);
          setManualFormData({
            title: "",
            category: "Other",
            expiryDate: "",
            issueDate: "",
            documentNumber: "",
            summary: ""
          });
          setSelectedFile(null);
        }}
        onFileUpload={handleFileUpload}
        isScanning={isScanning}
        scannedData={scannedData}
        onSave={async (data) => {
          if (!user) return;
          setIsSavingDoc(true);
          setSaveStage('preparing');
          setError(null);
          setUploadProgress(0);
          console.log("Saving document session started...", { data, fileName: selectedFile?.name });
          
          try {
            let finalFileUrl = null;
            let finalFileData = null;
            
            // Check if we have a base64 fallback from the scan
            const base64Data = scannedData?.base64;

            if (base64Data || selectedFile) {
              setSaveStage('uploading');
              console.log("Initiating file upload to Storage...", { 
                hasBase64: !!base64Data, 
                hasFile: !!selectedFile
              });
              
              const storageRef = ref(storage, `documents/${user.uid}/${Date.now()}_${selectedFile?.name || 'document.jpg'}`);
              setUploadProgress(10);
              
              const uploadPromise = new Promise<string>((resolve, reject) => {
                if (base64Data) {
                  uploadString(storageRef, base64Data, 'base64', { contentType: 'image/jpeg' })
                    .then(async (snapshot) => {
                      const url = await getDownloadURL(snapshot.ref);
                      resolve(url);
                    })
                    .catch(reject);
                } else if (selectedFile) {
                  const uploadTask = uploadBytesResumable(storageRef, selectedFile);
                  uploadTask.on('state_changed', 
                    (snapshot) => {
                      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 70 + 10;
                      setUploadProgress(progress);
                    }, 
                    reject, 
                    async () => {
                      const url = await getDownloadURL(uploadTask.snapshot.ref);
                      resolve(url);
                    }
                  );
                } else {
                  reject(new Error("No data"));
                }
              });

              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("Storage Timeout")), 20000)
              );

              try {
                finalFileUrl = await Promise.race([uploadPromise, timeoutPromise]);
                console.log("Storage upload successful.");
              } catch (storageErr: any) {
                console.warn("Storage failed or timed out, falling back to Firestore inline storage:", storageErr.message);
                // If it's a small enough image, we store it inline
                if (base64Data && base64Data.length < 800000) { // ~600KB limit
                  finalFileData = base64Data;
                  console.log("Using inline Base64 storage fallback.");
                } else {
                  console.error("File is too large for Firestore fallback and Storage failed.");
                  throw new Error("Unable to save document image. Firebase Storage is unresponsive and the file is too large for backup storage.");
                }
              }
            }
            
            setSaveStage('database');
            setUploadProgress(92);
            
            const firestorePromise = (async () => {
              try {
                const docRef = await addDoc(collection(db, "documents"), {
                  ...data,
                  userId: user.uid,
                  fileUrl: finalFileUrl,
                  fileData: finalFileData, // Backup storage
                  status: getStatus(data.expiryDate),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                setUploadProgress(100);
                return docRef;
              } catch (fsErr: any) {
                console.error("Firestore addDoc error:", fsErr);
                throw fsErr;
              }
            })();

            await firestorePromise;
            
            console.log("Save complete!");
            setIsUploadModalOpen(false);
            setScannedData(null);
            setSelectedFile(null);
            setManualFormData({
              title: "",
              category: "Other",
              expiryDate: "",
              issueDate: "",
              documentNumber: "",
              summary: ""
            });
          } catch (err: any) {
            console.error("Comprehensive Save Error:", err);
            setError(err.message || "Failed to save. Check your connection.");
          } finally {
            setIsSavingDoc(false);
            setSaveStage('idle');
            setTimeout(() => setUploadProgress(0), 1000);
          }
        }}
        isSaving={isSavingDoc}
        saveStage={saveStage}
        uploadProgress={uploadProgress}
        selectedFile={selectedFile}
        setIsCameraOpen={setIsCameraOpen}
        setScannedData={setScannedData}
        error={error}
        setError={setError}
      />

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <CameraModal 
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            webcamRef={webcamRef}
            onCapture={captureCamera}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {docToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Delete Document?</h2>
                <p className="text-gray-500">This action cannot be undone. Are you sure you want to delete this document?</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDocToDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteDocument(docToDelete)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {docToEdit && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Edit Document</h2>
                <button onClick={() => setDocToEdit(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    title: formData.get('title') as string,
                    category: formData.get('category') as string,
                    expiryDate: formData.get('expiryDate') as string,
                    issueDate: formData.get('issueDate') as string,
                    summary: formData.get('summary') as string,
                    documentNumber: formData.get('documentNumber') as string,
                    status: getStatus(formData.get('expiryDate') as string),
                  };
                  await updateDocument(docToEdit.id, data);
                }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Document Title</label>
                      <input name="title" defaultValue={docToEdit.title} required type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Category</label>
                      <select name="category" defaultValue={docToEdit.category} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none">
                        <option>Identity</option>
                        <option>License</option>
                        <option>Insurance</option>
                        <option>Invoice</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Document Number</label>
                      <input name="documentNumber" defaultValue={docToEdit.documentNumber} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Expiry Date</label>
                      <input name="expiryDate" defaultValue={docToEdit.expiryDate} required type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Issue Date (Optional)</label>
                      <input name="issueDate" defaultValue={docToEdit.issueDate} type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Summary</label>
                      <input name="summary" defaultValue={docToEdit.summary} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingDoc}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingDoc ? <Loader2 size={24} className="animate-spin" /> : "Update Document"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document View Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedDoc.title}</h2>
                  <p className="text-gray-500">{selectedDoc.category} • Expires {selectedDoc.expiryDate}</p>
                </div>
                <div className="flex items-center gap-4">
                  {selectedDoc.fileUrl && (
                    <a 
                      href={selectedDoc.fileUrl} 
                      download={`${selectedDoc.title.replace(/\s+/g, '_')}_document`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <Download size={18} />
                      Download
                    </a>
                  )}
                  <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 bg-gray-100 flex items-center justify-center">
                {selectedDoc.fileUrl || selectedDoc.fileData ? (
                  <img 
                    src={selectedDoc.fileUrl || `data:image/jpeg;base64,${selectedDoc.fileData}`} 
                    alt={selectedDoc.title} 
                    className="max-w-full h-auto rounded-lg shadow-lg" 
                  />
                ) : (
                  <div className="text-center space-y-4 text-gray-400">
                    <FileText size={64} className="mx-auto" />
                    <p>No preview available for this document.</p>
                  </div>
                )}
              </div>
              {selectedDoc.summary && (
                <div className="p-6 bg-white border-t border-gray-100">
                  <h3 className="font-bold mb-2">AI Summary</h3>
                  <p className="text-gray-600 text-sm">{selectedDoc.summary}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-all font-medium",
        active ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="activeNav" className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />}
    </button>
  );
}


