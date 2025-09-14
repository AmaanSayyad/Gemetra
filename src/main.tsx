import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { WagmiProvider } from "wagmi";
import { createAppKit } from '@reown/appkit/react'
import { somniaTestnet } from '@reown/appkit/networks'
// import { getConfig, mezoTestnet } from "@mezo-org/passport";
import App from "./App";
import "./index.css";
const queryClient = new QueryClient();
// const config = getConfig({ appName: "GEMETRA ON MEZO" });

const networks = [somniaTestnet]
const projectId = '684cdccc0de232f65a62603583571f5e'

const metadata = {
  name: 'GEMETRA',
  description: 'GEMETRA',
  url: 'https://example.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}
// 4. Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true
})
createAppKit({
  adapters: [wagmiAdapter],
  networks: [networks[0], ...networks.slice(1)],
  projectId,
  metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
