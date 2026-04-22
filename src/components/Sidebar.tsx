import React from "react";
import { 
  LayoutDashboard, 
  FileText, 
  Calendar, 
  Bell,
  CreditCard, 
  Settings, 
  LogOut, 
  X,
  Shield,
  BarChart3,
  Share2
} from "lucide-react";
import { motion } from "motion/react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  handleLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  handleLogout 
}) => {
  const [isDesktop, setIsDesktop] = React.useState(typeof window !== 'undefined' && window.innerWidth >= 1024);

  React.useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "My Documents", icon: FileText },
    { id: "calendar", label: "Expiry Calendar", icon: Calendar },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "reports", label: "Status Reports", icon: BarChart3 },
    { id: "invite", label: "Invite Friends", icon: Share2 },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <motion.aside 
        initial={false}
        animate={{ 
          x: isDesktop ? 0 : (isSidebarOpen ? 0 : -300) 
        }}
        className={`fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-gray-100 z-50 transition-transform duration-300 ease-in-out flex flex-col`}
      >
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Shield className="text-white" size={24} />
            </div>
            <span className="text-xl font-black tracking-tight text-gray-900">AI Tracker</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${
                activeTab === item.id 
                  ? "bg-blue-50 text-blue-600 shadow-sm" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-50">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-4 text-gray-500 font-bold hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </motion.aside>
    </>
  );
};
