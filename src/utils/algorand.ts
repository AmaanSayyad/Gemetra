import algosdk from 'algosdk';
import { PeraWalletConnect } from '@perawallet/connect';

// Algorand configuration
export const ALGORAND_CONFIG = {
  network: 'testnet',
  server: 'https://testnet-api.algonode.cloud',
  port: '',
  token: '',
  indexerServer: 'https://testnet-idx.algonode.cloud'
};

// Initialize Algorand client
export const algodClient = new algosdk.Algodv2(
  ALGORAND_CONFIG.token,
  ALGORAND_CONFIG.server,
  ALGORAND_CONFIG.port
);

// Initialize Indexer client
export const indexerClient = new algosdk.Indexer(
  ALGORAND_CONFIG.token,
  ALGORAND_CONFIG.indexerServer,
  ALGORAND_CONFIG.port
);

// Initialize Pera Wallet
export const peraWallet = new PeraWalletConnect({
  chainId: 416002, // Testnet chain ID
});

// Wallet state management
let connectedAccount: string | null = null;

// Generate a valid test Algorand address (for demo purposes only)
export const generateTestAddress = (): string => {
  // These are valid Algorand testnet addresses for demo purposes
  const testAddresses = [
    'XBYLS2E6YI6XXL5BWCAMOA4GTWHXWXWUB3OCJP72CH3V2VJRQBQ7K5REV4',
    'HEOQ3S6V47RFLU2RZ5GTQYJBEFRL54UWZ77PNUBWGH6WD5RRALD6J3LD5I',
    'IB3NJALXLDX5JLYCD4TMTMLVCKDRZNS4JONHMIWD6XM7DSKYR7MWHI6I7U',
    'MD73TROH6VGUXMMYXTNY2QZLQH6LGSI2XQVQKDWH7GDIXFWDQVFXS4CRMU',
    'NALGBMB2EGTPVTYQPKC4LLRTXOSGWXAWO33G7WY6FGURAKGWMQS7Z5QCEU'
  ];
  
  // Return a random test address
  return testAddresses[Math.floor(Math.random() * testAddresses.length)];
};

// Utility functions
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export const formatAlgo = (microAlgos: number): string => {
  return (microAlgos / 1000000).toFixed(6);
};

export const formatUSDC = (microUSDC: number): string => {
  return (microUSDC / 1000000).toFixed(2);
};

// Validate Algorand address
export const isValidAlgorandAddress = (address: string): boolean => {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    const trimmedAddress = address.trim();
    
    // Algorand addresses are exactly 58 characters
    if (trimmedAddress.length !== 58) {
      return false;
    }
    
    // Use Algorand SDK to validate the address
    algosdk.decodeAddress(trimmedAddress);
    return true;
  } catch (error) {
    return false;
  }
};

// Connect to Pera Wallet
export const connectWallet = async (): Promise<{ address: string; balance: number }> => {
  try {
    // Connect to Pera Wallet
    const accounts = await peraWallet.connect();
    
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const account = accounts[0];
    connectedAccount = account;

    // Get account information
    const accountInfo = await algodClient.accountInformation(account).do();
    const balance = Number(accountInfo.amount) / 1000000; // Convert microAlgos to Algos with explicit Number conversion

    // Set up disconnect event listener
    peraWallet.connector?.on('disconnect', handleDisconnect);

    return {
      address: account,
      balance: balance
    };
  } catch (error) {
    console.error('Failed to connect to Pera Wallet:', error);
    throw error;
  }
};

// Disconnect wallet
export const disconnectWallet = async (): Promise<void> => {
  try {
    await peraWallet.disconnect();
    connectedAccount = null;
  } catch (error) {
    console.error('Failed to disconnect wallet:', error);
    throw error;
  }
};

// Handle disconnect event
const handleDisconnect = () => {
  connectedAccount = null;
  // You can add additional cleanup logic here
  console.log('Wallet disconnected');
};

// Check if wallet is connected
export const isWalletConnected = (): boolean => {
  // Check both our stored account and the Pera wallet connector
  if (connectedAccount !== null) {
    return true;
  }
  
  // Also check if Pera wallet has accounts
  if (peraWallet.connector && peraWallet.connector.accounts && peraWallet.connector.accounts.length > 0) {
    // Update our stored account
    connectedAccount = peraWallet.connector.accounts[0];
    return true;
  }
  
  return false;
};

// Get connected account
export const getConnectedAccount = (): string | null => {
  // First check our stored account
  if (connectedAccount) {
    return connectedAccount;
  }
  
  // If not stored, check Pera wallet
  if (peraWallet.connector && peraWallet.connector.accounts && peraWallet.connector.accounts.length > 0) {
    connectedAccount = peraWallet.connector.accounts[0];
    return connectedAccount;
  }
  
  return null;
};

// Reconnect to previously connected wallet
export const reconnectWallet = async (): Promise<{ address: string; balance: number } | null> => {
  try {
    const accounts = await peraWallet.reconnectSession();
    
    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    connectedAccount = account;

    // Get account information
    const accountInfo = await algodClient.accountInformation(account).do();
    const balance = Number(accountInfo.amount) / 1000000; // Convert with explicit Number conversion

    // Set up disconnect event listener
    peraWallet.connector?.on('disconnect', handleDisconnect);

    return {
      address: account,
      balance: balance
    };
  } catch (error) {
    console.error('Failed to reconnect wallet:', error);
    return null;
  }
};

// Send payment transaction
export const sendPayment = async (
  recipient: string,
  amount: number,
  token: string = 'ALGO'
): Promise<{ txHash: string; success: boolean; error?: string }> => {
  try {
    let senderAccount = connectedAccount;
    
    if (!senderAccount && peraWallet.connector) {
      const accounts = peraWallet.connector.accounts;
      if (accounts && accounts.length > 0) {
        senderAccount = accounts[0];
        connectedAccount = senderAccount;
      }
    }
    
    if (!senderAccount) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.');
    }

    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient address is required');
    }

    const trimmedRecipient = recipient.trim();
    if (!isValidAlgorandAddress(trimmedRecipient)) {
      throw new Error('Invalid recipient address format');
    }

    if (!amount || amount <= 0 || isNaN(amount)) {
      throw new Error('Invalid amount');
    }

    console.log('Sending payment with addresses:', {
      from: senderAccount,
      to: trimmedRecipient,
      amount: amount,
      token: token
    });

    const suggestedParams = await algodClient.getTransactionParams().do();

    let txn;

    if (token === 'ALGO') {
      if (!senderAccount || !trimmedRecipient) {
        throw new Error(`Address validation failed - from: ${senderAccount}, to: ${trimmedRecipient}`);
      }
      
      txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: senderAccount,
        receiver: trimmedRecipient,
        amount: Math.floor(amount * 1000000),
        suggestedParams: suggestedParams,
      });
    } else {
      // Using Algorand Testnet USDC asset ID
      // Note: This should be updated to the correct asset ID for your environment
      // Testnet asset IDs change periodically, so this needs to be kept current
      const assetId = token === 'USDC' ? 10458941 : 0;
      
      console.log(`Using asset ID ${assetId} for ${token}`);
      
      // Check if recipient is opted in to the asset
      try {
        console.log(`Checking if recipient ${trimmedRecipient} is opted in to asset ID ${assetId}`);
        const recipientInfo = await algodClient.accountInformation(trimmedRecipient).do();
        
        // More robust opt-in check
        let isOptedIn = false;
        if (recipientInfo.assets && Array.isArray(recipientInfo.assets)) {
          console.log(`Recipient has ${recipientInfo.assets.length} assets`);
          
          // Log all assets for debugging
          recipientInfo.assets.forEach((asset: any) => {
            const currentAssetId = asset['asset-id'] || asset.assetId || asset['assetId'];
            console.log(`Recipient has asset ID: ${currentAssetId}`);
          });
          
          isOptedIn = recipientInfo.assets.some((asset: any) => {
            const currentAssetId = asset['asset-id'] || asset.assetId || asset['assetId'];
            const matches = Number(currentAssetId) === Number(assetId);
            if (matches) {
              console.log(`Found matching asset ID ${currentAssetId}`);
            }
            return matches;
          });
        }
        
        if (!isOptedIn) {
          console.error(`Recipient is not opted in to ${token} (Asset ID: ${assetId})`);
          throw new Error(`Recipient must opt-in to ${token} (Asset ID: ${assetId}) before receiving payments. Please ask them to opt-in first.`);
        } else {
          console.log(`Recipient is opted in to ${token} (Asset ID: ${assetId})`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('account does not exist')) {
          console.error(`Recipient address does not exist or has no balance`);
          throw new Error(`Recipient address does not exist or has no balance. They need to fund their account first.`);
        }
        console.error(`Error checking opt-in status:`, error);
        throw error;
      }
      
      txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: senderAccount,
        receiver: trimmedRecipient,
        amount: Math.floor(amount * 1000000),
        assetIndex: assetId,
        suggestedParams: suggestedParams,
      });
    }

    // Sign transaction with Pera Wallet
    const signedTxns = await peraWallet.signTransaction([
      [{ txn: txn, signers: [senderAccount] }]
    ]);

    // Send transaction
    const response = await algodClient.sendRawTransaction(signedTxns).do();

    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, response.txid, 4);

    return {
      txHash: response.txid,
      success: true
    };
  } catch (error) {
    console.error('Payment failed:', error);
    
    // Return specific error message instead of generic success: false
    let errorMessage = 'An unexpected error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      txHash: '',
      success: false,
      error: errorMessage
    };
  }
};

// Send bulk payment transaction
export const sendBulkPayment = async (
  recipients: Array<{ address: string; amount: number }>,
  token: string = 'ALGO'
): Promise<{ txHash: string; success: boolean; processed: number; error?: string }> => {
  try {
    // Get the current connected account - check both the variable and Pera wallet state
    let senderAccount = connectedAccount;
    
    // If connectedAccount is null, try to get it from Pera wallet
    if (!senderAccount && peraWallet.connector) {
      const accounts = peraWallet.connector.accounts;
      if (accounts && accounts.length > 0) {
        senderAccount = accounts[0];
        connectedAccount = senderAccount; // Update the module variable
      }
    }
    
    if (!senderAccount) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.');
    }

    // Comprehensive validation and filtering of recipients
    const validRecipients = [];
    
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      // Check if recipient object exists and has required properties
      if (!recipient || typeof recipient !== 'object') {
        console.warn(`Skipping recipient ${i}: Invalid recipient object`, recipient);
        continue;
      }

      // Validate address
      if (!recipient.address || typeof recipient.address !== 'string') {
        console.warn(`Skipping recipient ${i}: Address is not a string`, recipient);
        continue;
      }

      const trimmedAddress = recipient.address.trim();
      if (!isValidAlgorandAddress(trimmedAddress)) {
        console.warn(`Skipping recipient ${i}: Invalid Algorand address format`, recipient);
        continue;
      }

      // Validate amount
      if (!recipient.amount || typeof recipient.amount !== 'number' || recipient.amount <= 0 || isNaN(recipient.amount)) {
        console.warn(`Skipping recipient ${i}: Invalid amount`, recipient);
        continue;
      }

      // Add to valid recipients
      validRecipients.push({
        address: trimmedAddress,
        amount: recipient.amount
      });
    }

    console.log(`Processing ${validRecipients.length} valid recipients out of ${recipients.length} total`);

    if (validRecipients.length === 0) {
      return {
        txHash: '',
        success: false,
        processed: 0,
        error: 'No valid recipients found'
      };
    }

    // Get suggested transaction parameters
    const suggestedParams = await algodClient.getTransactionParams().do();

    const txns = [];

    for (const recipient of validRecipients) {
      let txn;

      console.log('Creating transaction for:', {
        from: senderAccount,
        to: recipient.address,
        amount: recipient.amount,
        token: token
      });

      // Double-check address is still valid right before creating transaction
      if (!recipient.address || !isValidAlgorandAddress(recipient.address)) {
        console.error(`Address became invalid for recipient:`, recipient);
        continue;
      }

      if (token === 'ALGO') {
        txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: senderAccount,
          receiver: recipient.address,
          amount: Math.floor(recipient.amount * 1000000),
          suggestedParams: suggestedParams,
        });
      } else {
        // Using Algorand Testnet USDC asset ID
        // Note: This should be updated to the correct asset ID for your environment
        // Testnet asset IDs change periodically, so this needs to be kept current
        const assetId = token === 'USDC' ? 10458941 : 0;
        
        console.log(`Using asset ID ${assetId} for ${token} in bulk payment`);
        
        // Check if recipient is opted in to the asset
        try {
          console.log(`Checking if recipient ${recipient.address} is opted in to asset ID ${assetId}`);
          const recipientInfo = await algodClient.accountInformation(recipient.address).do();
          
          // More robust opt-in check
          let isOptedIn = false;
          if (recipientInfo.assets && Array.isArray(recipientInfo.assets)) {
            console.log(`Recipient has ${recipientInfo.assets.length} assets`);
            
            isOptedIn = recipientInfo.assets.some((asset: any) => {
              const currentAssetId = asset['asset-id'] || asset.assetId || asset['assetId'];
              return Number(currentAssetId) === Number(assetId);
            });
          }
          
          if (!isOptedIn) {
            console.error(`Recipient ${recipient.address} is not opted in to ${token} (Asset ID: ${assetId})`);
            throw new Error(`Recipient must opt-in to ${token} (Asset ID: ${assetId}) before receiving payments. Please ask them to opt-in first.`);
          } else {
            console.log(`Recipient ${recipient.address} is opted in to ${token} (Asset ID: ${assetId})`);
          }
        } catch (error) {
          console.error(`Error checking opt-in status for ${recipient.address}:`, error);
          throw error;
        }
        
        txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: senderAccount,
          receiver: recipient.address,
          amount: Math.floor(recipient.amount * 1000000),
          assetIndex: assetId,
          suggestedParams: suggestedParams,
        });
      }

      txns.push({ txn: txn, signers: [senderAccount] });
    }

    if (txns.length === 0) {
      return {
        txHash: '',
        success: false,
        processed: 0,
        error: 'No valid transactions created'
      };
    }

    // For single transaction, don't group. For multiple, group them.
    let signedTxns;
    if (txns.length === 1) {
      // Single transaction - sign without grouping
      signedTxns = await peraWallet.signTransaction([txns]);
    } else {
      // Multiple transactions - group them first
      const txnArray = txns.map(t => t.txn);
      const groupedTxns = algosdk.assignGroupID(txnArray);
      const groupedWithSigners = groupedTxns.map((txn) => ({
        txn: txn,
        signers: [senderAccount]
      }));
      signedTxns = await peraWallet.signTransaction([groupedWithSigners]);
    }

    // Send transactions
    const response = await algodClient.sendRawTransaction(signedTxns).do();

    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, response.txid, 4);

    return {
      txHash: response.txid,
      success: true,
      processed: txns.length
    };
  } catch (error) {
    console.error('Bulk payment failed:', error);
    return {
      txHash: '',
      success: false,
      processed: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Simulate token swap (placeholder for actual DEX integration)
export const swapTokens = async (
  fromToken: string,
  toToken: string,
  amount: number
): Promise<{ txHash: string; success: boolean; outputAmount: number }> => {
  // This would integrate with a DEX like Tinyman or Pact
  // For now, return a simulated response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const txHash = `SWAP_${Math.random().toString(36).substring(7).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
  
  // Simulate exchange rate (with slippage)
  const exchangeRate = fromToken === 'ALGO' && toToken === 'USDC' ? 0.24 : 2.38;
  const slippage = 0.003; // 0.3% slippage
  const outputAmount = amount * exchangeRate * (1 - slippage);
  
  return {
    txHash,
    success: Math.random() > 0.02, // 98% success rate for swaps
    outputAmount
  };
};

// Helper function to find USDC asset on testnet
export const findUSDCAssetId = async (): Promise<number | null> => {
  try {
    console.log('Attempting to find USDC asset ID on testnet...');
    
    // Common USDC asset IDs to try
    const possibleUSDCAssetIds = [
      10458941, // The current one in the code
      10458942,
      37074699, // Another possible testnet USDC ID
      31566704, // Another possible testnet USDC ID
      312769  // Another possible testnet USDC ID
    ];
    
    // Check each asset ID
    for (const assetId of possibleUSDCAssetIds) {
      try {
        console.log(`Checking asset ID ${assetId}...`);
        const assetInfo = await algodClient.getAssetByID(assetId).do();
        
        // Check if this looks like USDC
        if (
          assetInfo && 
          assetInfo.params && 
          (
            (assetInfo.params.name && assetInfo.params.name.toUpperCase().includes('USDC')) ||
            (assetInfo.params.unitName && assetInfo.params.unitName.toUpperCase().includes('USDC'))
          )
        ) {
          console.log(`Found USDC asset with ID ${assetId}:`, assetInfo.params);
          return assetId;
        }
      } catch (error) {
        console.log(`Asset ID ${assetId} not found or error:`, error);
      }
    }
    
    console.log('No USDC asset found on testnet');
    return null;
  } catch (error) {
    console.error('Error finding USDC asset ID:', error);
    return null;
  }
};

// Get detailed asset information
export const getAssetInfo = async (assetId: number): Promise<{
  name: string;
  unitName: string;
  decimals: number;
} | null> => {
  try {
    // Validate assetId before making the API call
    if (assetId === undefined || assetId === null || !Number.isInteger(assetId) || assetId < 0) {
      console.warn(`Invalid asset ID provided: ${assetId}`);
      return null;
    }

    const assetInfo = await algodClient.getAssetByID(assetId).do();
    return {
      name: assetInfo.params.name || `Asset ${assetId}`,
      unitName: assetInfo.params.unitName || 'UNKNOWN',
      decimals: assetInfo.params.decimals || 0
    };
  } catch (error) {
    console.error(`Failed to get asset info for ${assetId}:`, error);
    return null;
  }
};

// Get account balance with detailed asset information
export const getAccountBalance = async (address?: string): Promise<{
  algo: number;
  assets: Array<{ 
    assetId: number; 
    amount: number; 
    name: string; 
    unitName: string; 
    decimals: number;
  }>
}> => {
  try {
    const accountAddress = address || connectedAccount;
    
    if (!accountAddress) {
      throw new Error('No account address provided');
    }

    const accountInfo = await algodClient.accountInformation(accountAddress).do();
    
    const algoBalance = Number(accountInfo.amount) / 1000000; // Convert with explicit Number conversion
    
    // Get asset balances with detailed information
    const assets = [];
    
    if (accountInfo.assets && accountInfo.assets.length > 0) {
      for (const asset of accountInfo.assets) {
        const assetId = Number(asset.assetId);
        
        if (!assetId || !Number.isInteger(assetId) || assetId < 0) {
          console.warn(`Skipping invalid asset ID: ${assetId}`);
          continue;
        }

        const assetInfo = await getAssetInfo(assetId);
        
        if (assetInfo) {
          const amount = Number(asset.amount) / Math.pow(10, assetInfo.decimals); // Convert with explicit Number conversion
          
          // Only include assets with positive balance
          if (amount > 0) {
            assets.push({
              assetId,
              amount,
              name: assetInfo.name,
              unitName: assetInfo.unitName,
              decimals: assetInfo.decimals
            });
          }
        }
      }
    }

    return {
      algo: algoBalance,
      assets: assets
    };
  } catch (error) {
    console.error('Failed to get account balance:', error);
    // Return fallback data
    return {
      algo: 0,
      assets: []
    };
  }
};

// AI payroll optimization (placeholder)
export const getAIRecommendations = async (): Promise<{
  recommendations: Array<{
    type: 'cost_optimization' | 'timing' | 'token_selection';
    title: string;
    description: string;
    potentialSavings?: number;
  }>
}> => {
  // Simulate AI processing
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    recommendations: [
      {
        type: 'cost_optimization',
        title: 'Optimize Payment Timing',
        description: 'Schedule payments during low network congestion to reduce fees by 15%',
        potentialSavings: 23.45
      },
      {
        type: 'token_selection',
        title: 'Token Preference Analysis',
        description: 'Most employees prefer USDC payments - consider bulk ALGO->USDC swaps',
        potentialSavings: 45.67
      },
      {
        type: 'timing',
        title: 'Payroll Frequency Optimization',
        description: 'Bi-weekly payments could improve employee satisfaction by 12%'
      }
    ]
  };
};

// Opt into an asset (required before receiving ASAs)
export const optInToAsset = async (assetId: number): Promise<{ success: boolean; txHash?: string }> => {
  try {
    // Capture the sender account at the beginning to prevent race conditions
    const senderAccount = connectedAccount;
    
    if (!senderAccount) {
      throw new Error('Wallet not connected');
    }

    const suggestedParams = await algodClient.getTransactionParams().do();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: senderAccount,
      receiver: senderAccount,
      amount: 0,
      assetIndex: assetId,
      suggestedParams: suggestedParams,
    });

    const signedTxns = await peraWallet.signTransaction([
      [{ txn: txn, signers: [senderAccount] }]
    ]);

    const response = await algodClient.sendRawTransaction(signedTxns).do();
    await algosdk.waitForConfirmation(algodClient, response.txid, 4);

    return {
      success: true,
      txHash: response.txid
    };
  } catch (error) {
    console.error('Asset opt-in failed:', error);
    return {
      success: false
    };
  }
};