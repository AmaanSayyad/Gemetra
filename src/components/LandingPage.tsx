import React from 'react';
import AlgopayLandingPage from './AlgopayLandingPage';

interface LandingPageProps {
  onConnectWallet: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onConnectWallet }) => {
  return (
    <AlgopayLandingPage onConnectWallet={onConnectWallet} />
  );
};