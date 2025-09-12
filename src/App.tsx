import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { connectWallet, disconnectWallet, isWalletConnected, getConnectedAccount, reconnectWallet } from './utils/algorand';

function App() {
  // Initialize activeTab from localStorage or default to 'landing'
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('algopay_active_tab');
    return savedTab || 'landing';
  });
  
  const [walletAddress, setWalletAddress] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('algopay_active_tab', activeTab);
  }, [activeTab]);

  // Check for wallet connection on load
  useEffect(() => {
    const checkWalletConnection = async () => {
      try {
        // Check if wallet is already connected
        if (isWalletConnected()) {
          const account = getConnectedAccount();
          if (account) {
            setWalletAddress(account);
            setWalletConnected(true);
          }
        } else {
          // Try to reconnect to previously connected wallet
          const reconnectResult = await reconnectWallet();
          if (reconnectResult) {
            setWalletAddress(reconnectResult.address);
            setWalletConnected(true);
          }
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      } finally {
        setLoading(false);
      }
    };

    checkWalletConnection();
  }, []);

  // Handle wallet connection state changes
  useEffect(() => {
    if (walletConnected && activeTab === 'landing') {
      // User has connected wallet and is on landing page, redirect to dashboard
      setActiveTab('dashboard');
    } else if (!walletConnected && !loading && !['landing'].includes(activeTab)) {
      // User has disconnected wallet and not on landing page, redirect to landing
      setActiveTab('landing');
    }
  }, [walletConnected, loading, activeTab]);

  const handleConnectWallet = async () => {
    try {
      const result = await connectWallet();
      setWalletAddress(result.address);
      setWalletConnected(true);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      setWalletAddress('');
      setWalletConnected(false);
      setActiveTab('landing');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const renderActiveComponent = () => {
    // Show loading while checking wallet connection
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-gray-900 font-medium">Loading...</div>
          </div>
        </div>
      );
    }

    // If wallet is connected, show dashboard layout for all dashboard tabs
    if (walletConnected && ['dashboard', 'employees', 'bulk-transfer', 'ai-assistant-chat', 'ai-assistant-history', 'settings'].includes(activeTab)) {
      return <DashboardLayout companyName={'My Company'} />;
    }

    // If wallet is not connected, show landing page
    return <LandingPage onConnectWallet={handleConnectWallet} />;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <div className="relative z-10">
        {/* Only show header when not on landing page and not wallet connected */}
        {!walletConnected && activeTab !== 'landing' && (
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isWalletConnected={walletConnected}
            walletAddress={walletAddress}
            onConnectWallet={handleConnectWallet}
            onDisconnectWallet={handleDisconnectWallet}
            onGetStarted={() => {}}
            user={null}
          />
        )}

        <main className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={walletConnected ? 'dashboard' : 'landing'}
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