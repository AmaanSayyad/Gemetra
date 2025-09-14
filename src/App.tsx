
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import DashboardLayout from "./components/DashboardLayout";
import { LandingPage } from "./components/LandingPage";
import { Header } from "./components/Header";


function App() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("algopay_active_tab") || "landing";
  });

  // persist active tab
  useEffect(() => {
    localStorage.setItem("algopay_active_tab", activeTab);
  }, [activeTab]);

  // handle redirects
  useEffect(() => {
    if (isConnected && activeTab === "landing") {
      setActiveTab("dashboard");
    } else if (!isConnected && !["landing"].includes(activeTab)) {
      setActiveTab("landing");
    }
  }, [isConnected, activeTab]);

  const renderActiveComponent = () => {
    if (isConnected && ["dashboard", "employees", "bulk-transfer", "ai-assistant-chat", "ai-assistant-history", "settings"].includes(activeTab)) {
      return <DashboardLayout companyName={"My Company"} />;
    }
    return <LandingPage />;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="relative z-10">
        {!isConnected && activeTab !== "landing" && (
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isWalletConnected={isConnected}
            walletAddress={address || ""}
            onGetStarted={() => {}}
            user={null}
          />
        )}

        <main className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={isConnected ? "dashboard" : "landing"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderActiveComponent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
   
    </div>
  );
}

export default App;
