import React, { useState } from 'react';
import { Upload, FileCheck, QrCode, CheckCircle, AlertCircle, Search, Clock, FileText, FileUp, FormInput, ExternalLink } from 'lucide-react';
import { peraWallet, getConnectedAccount, sendBulkPayment } from '../utils/algorand';
import { usePayments } from '../hooks/usePayments';

interface VATRefundPageProps {
  onBack?: () => void;
}

export const VATRefundPage: React.FC<VATRefundPageProps> = () => {
  const { createPayment, getAllPayments } = usePayments();
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [step, setStep] = useState<'upload' | 'review' | 'sign' | 'confirmation' | 'error'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [entryMode, setEntryMode] = useState<'upload' | 'manual'>('upload');
  const [selectedToken, setSelectedToken] = useState<'SOMI' | 'USDC'>('SOMI');
  const [transactionStatus, setTransactionStatus] = useState<'waiting' | 'confirmed' | 'rejected'>('waiting');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [refundHistory, setRefundHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Form fields for manual entry
  const [formData, setFormData] = useState({
    vatRegNo: '',
    receiptNo: '',
    billAmount: '',
    vatAmount: '',
    passportNo: '',
    flightNo: '',
    nationality: '',
    dob: '',
    purchaseDate: '',
    merchantName: '',
    merchantAddress: '',
    receiverWalletAddress: ''
  });
  
  // Fetch VAT refund history
  React.useEffect(() => {
    const fetchRefundHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const allPayments = await getAllPayments();
        
        // Filter payments that are VAT refunds (employee_id === 'vat-refund')
        const vatRefunds = allPayments
          .filter(payment => payment.employee_id === 'vat-refund')
          .map(payment => ({
            id: payment.id,
            date: payment.created_at,
            amount: payment.amount,
            status: payment.status,
            token: payment.token,
            transaction_hash: payment.transaction_hash,
            payment_date: payment.payment_date,
            document: payment.employee_id === 'vat-refund' ? 'VAT Refund' : ''
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setRefundHistory(vatRefunds);
      } catch (error) {
        console.error('Failed to fetch VAT refund history:', error);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    
    fetchRefundHistory();
  }, [getAllPayments, refreshKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      // Simulate VAT calculation based on file - range between 1-10 ALGO
      setRefundAmount(Math.floor(Math.random() * 9) + 1);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload');
      return;
    }
    
    if (!formData.receiverWalletAddress) {
      setErrorMessage('Please enter a receiver wallet address');
      return;
    }
    
    // Validate wallet address format (basic validation)
    if (formData.receiverWalletAddress.length !== 58) {
      setErrorMessage('Please enter a valid Algorand wallet address (58 characters)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Simulate document processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStep('review');
    } catch (error) {
      setErrorMessage('Failed to process document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Check if wallet is connected
      const connectedAccount = getConnectedAccount();
      
      // Always show the sign step with a message about mobile wallet popup
      setQrValue(`algorand://gemetra-vat-refund/${Date.now()}`);
      
      // Prepare recipient data for the payment
      const recipientAddress = entryMode === 'manual' ? formData.receiverWalletAddress : formData.receiverWalletAddress;
      
      if (!recipientAddress) {
        throw new Error('Recipient wallet address is required');
      }
      
      // Prepare payment data
      const recipientsData = [{
        address: recipientAddress,
        amount: refundAmount
      }];
      
      console.log('Processing VAT refund payment:', {
        recipients: recipientsData,
        token: selectedToken
      });
      
      // Show a message about the Pera mobile wallet transaction popup
      setStep('sign');
      
      // If wallet is connected, process the payment
      if (connectedAccount) {
        // Process the payment using sendBulkPayment
        const result = await sendBulkPayment(recipientsData, selectedToken);
        
        if (result.success) {
          setTransactionHash(result.txHash);
          
          // Record the payment
          try {
            await createPayment({
              employee_id: 'vat-refund', // Special ID for VAT refunds
              amount: refundAmount,
              token: selectedToken,
              transaction_hash: result.txHash,
              status: 'completed',
              payment_date: new Date().toISOString()
            });
          } catch (dbError) {
            console.error('Failed to record VAT refund payment in database:', dbError);
            // Continue with success flow even if database recording fails
          }
          
          // Set QR value to include transaction hash
          setQrValue(`algorand://tx/${result.txHash}`);
          setTransactionStatus('confirmed');
        } else {
          // Handle payment failure
          setErrorMessage(result.error || 'Payment failed');
          setTransactionStatus('rejected');
        }
      }
    } catch (error) {
      console.error('Error in handleApprove:', error);
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof Error) {
        if (error.message.includes('asset') && error.message.includes('missing from')) {
          errorMessage = 'Recipient has not opted-in to receive the selected token. They must opt-in first.';
        } else if (error.message.includes('Wallet not connected')) {
          errorMessage = 'Wallet is not connected. Please connect your wallet and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setErrorMessage(errorMessage);
      setTransactionStatus('rejected');
      setStep('sign');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    // If we already have a transaction status (from handleApprove), no need to process again
    if (transactionStatus !== 'waiting') {
      if (transactionStatus === 'confirmed') {
        setStep('confirmation');
      }
      return;
    }
    
    setIsLoading(true);
    try {
      // Connect wallet if not connected
      if (!getConnectedAccount()) {
        try {
          await peraWallet.connect();
        } catch (error) {
          throw new Error('Failed to connect wallet. Please try again.');
        }
      }

      // Prepare recipient data for the payment
      const recipientAddress = entryMode === 'manual' ? formData.receiverWalletAddress : 'XBYLS2E6YI6XXL5BWCAMOA4GTWHXWXWUB3OCJP72CH3V2VJRQBQ7K5REV4';
      
      if (!recipientAddress) {
        throw new Error('Recipient wallet address is required');
      }
      
      // Prepare payment data
      const recipientsData = [{
        address: recipientAddress,
        amount: refundAmount
      }];
      
      // Process the payment using sendBulkPayment
      const result = await sendBulkPayment(recipientsData, selectedToken);
      
      if (result.success) {
        setTransactionHash(result.txHash);
        
        // Record the payment
        try {
          await createPayment({
            employee_id: 'vat-refund', // Special ID for VAT refunds
            amount: refundAmount,
            token: selectedToken,
            transaction_hash: result.txHash,
            status: 'completed',
            payment_date: new Date().toISOString()
          });
        } catch (dbError) {
          console.error('Failed to record VAT refund payment in database:', dbError);
        }
        
        // Set transaction as confirmed
        setTransactionStatus('confirmed');
        setQrValue(`algorand://tx/${result.txHash}`);
      } else {
        // Handle payment failure
        setErrorMessage(result.error || 'Payment failed');
        setTransactionStatus('rejected');
      }
    } catch (error) {
      console.error('Error in handleSign:', error);
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof Error) {
        if (error.message.includes('asset') && error.message.includes('missing from')) {
          errorMessage = 'Recipient has not opted-in to receive the selected token. They must opt-in first.';
        } else if (error.message.includes('Wallet not connected')) {
          errorMessage = 'Wallet is not connected. Please connect your wallet and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setErrorMessage(errorMessage);
      setTransactionStatus('rejected');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setErrorMessage(null);
    setQrValue('');
    setTransactionStatus('waiting');
    setTransactionHash('');
    setRefundAmount(0);
    // Refresh history data
    setRefreshKey(prev => prev + 1);
    setFormData({
      vatRegNo: '',
      receiptNo: '',
      billAmount: '',
      vatAmount: '',
      passportNo: '',
      flightNo: '',
      nationality: '',
      dob: '',
      purchaseDate: '',
      merchantName: '',
      merchantAddress: '',
      receiverWalletAddress: ''
    });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If VAT amount is updated, update refund amount
    if (name === 'vatAmount' && value) {
      const vatAmount = parseFloat(value);
      if (!isNaN(vatAmount)) {
        setRefundAmount(vatAmount);
      }
    }
  };
  
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.vatRegNo || !formData.receiptNo || !formData.vatAmount || !formData.passportNo || !formData.receiverWalletAddress) {
      setErrorMessage('Please fill in all required fields');
      return;
    }
    
    // Validate wallet address format (basic validation)
    if (formData.receiverWalletAddress.length !== 58) {
      setErrorMessage('Please enter a valid Algorand wallet address (58 characters)');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Parse VAT amount
      const vatAmount = parseFloat(formData.vatAmount);
      if (!isNaN(vatAmount)) {
        setRefundAmount(vatAmount);
      }
      
      setStep('review');
    } catch (error) {
      setErrorMessage('Failed to process your request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  

  const renderUploadTab = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Submit VAT Refund</h2>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setEntryMode('upload')}
                  className={`flex items-center px-4 py-2 text-sm ${
                    entryMode === 'upload'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Upload Document
                </button>
                <button
                  onClick={() => setEntryMode('manual')}
                  className={`flex items-center px-4 py-2 text-sm ${
                    entryMode === 'manual'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FormInput className="w-4 h-4 mr-2" />
                  Manual Entry
                </button>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              {entryMode === 'upload' 
                ? 'Upload your VAT receipt document to process your refund. We support PDF, JPG, and PNG formats.'
                : 'Enter your VAT receipt details manually to process your refund.'}
            </p>
            
            {entryMode === 'upload' ? (
              <>
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center mb-6">
              <Upload className="w-12 h-12 text-blue-500 mb-4" />
              <p className="text-gray-700 mb-4 text-center">Drag and drop your document here or click to browse</p>
              <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200">
                Select File
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
              </label>
              {selectedFile && (
                <div className="mt-4 flex items-center text-sm text-gray-600">
                  <FileCheck className="w-5 h-5 mr-2 text-green-500" />
                  {selectedFile.name}
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Wallet Address <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="receiverWalletAddress"
                    value={formData.receiverWalletAddress}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 0xdAF0182De86F904918Db8d07c7340A1EfcDF8244"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="token"
                        value="ALGO"
                        checked={selectedToken === 'SOMI'}
                        onChange={() => setSelectedToken('SOMI')}
                        className="mr-2"
                      />
                      <span className="text-sm">Somnia (SOMI)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="token"
                        value="USDC"
                        checked={selectedToken === 'USDC'}
                        onChange={() => setSelectedToken('USDC')}
                        className="mr-2"
                      />
                      <span className="text-sm">USD Coin (USDC)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !formData.receiverWalletAddress || isLoading}
                className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${
                  !selectedFile || !formData.receiverWalletAddress || isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Processing...' : 'Upload Document'}
              </button>
            </div>
              </>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-6">
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {errorMessage}
                  </div>
                )}
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Receipt Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VAT Registration No. <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="vatRegNo"
                        value={formData.vatRegNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. GB123456789"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt/Invoice No. <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="receiptNo"
                        value={formData.receiptNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. INV-12345"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Bill Amount</label>
                      <input
                        type="number"
                        name="billAmount"
                        value={formData.billAmount}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 1000.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VAT Amount <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="vatAmount"
                        value={formData.vatAmount}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 200.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                      <input
                        type="date"
                        name="purchaseDate"
                        value={formData.purchaseDate}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Wallet Address <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="receiverWalletAddress"
                        value={formData.receiverWalletAddress}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. XBYLS2E6YI6XXL5BWCAMOA4GTWHXWXWUB3OCJP72CH3V2VJRQBQ7K5REV4"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="token"
                          value="ALGO"
                          checked={selectedToken === 'SOMI'}
                          onChange={() => setSelectedToken('SOMI')}
                          className="mr-2"
                        />
                        <span className="text-sm">Somnia (SOMI)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="token"
                          value="USDC"
                          checked={selectedToken === 'USDC'}
                          onChange={() => setSelectedToken('USDC')}
                          className="mr-2"
                        />
                        <span className="text-sm">USD Coin (USDC)</span>
                      </label>
                    </div>
                  </div>
                  
                  {formData.vatAmount && (
                    <div className="mt-4 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Calculated Refund Amount:</span>
                        <span className="text-lg font-bold text-green-600">
                          {selectedToken === 'SOMI' ? 'SOMI ' : 'USDC '}
                          {parseFloat(formData.vatAmount) > 0 ? parseFloat(formData.vatAmount).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="passportNo"
                        value={formData.passportNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. AB1234567"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Flight Number</label>
                      <input
                        type="text"
                        name="flightNo"
                        value={formData.flightNo}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. BA123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country of Nationality</label>
                      <input
                        type="text"
                        name="nationality"
                        value={formData.nationality}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. United Kingdom"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Merchant Information</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Name</label>
                      <input
                        type="text"
                        name="merchantName"
                        value={formData.merchantName}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. ABC Store Ltd."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Address</label>
                      <input
                        type="text"
                        name="merchantAddress"
                        value={formData.merchantAddress}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. 123 High Street, London, UK"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${
                      isLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isLoading ? 'Processing...' : 'Submit Details'}
                  </button>
                </div>
              </form>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Review VAT Refund Details</h2>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              {entryMode === 'upload' ? (
                <div className="flex items-start mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedFile?.name}</h3>
                    <p className="text-sm text-gray-600">Uploaded just now</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <FormInput className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Manual Entry</h3>
                    <p className="text-sm text-gray-600">Submitted just now</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {entryMode === 'manual' && (
                  <>
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">Receipt Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">VAT Registration No.</p>
                          <p className="text-sm font-medium text-gray-900">{formData.vatRegNo}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Receipt/Invoice No.</p>
                          <p className="text-sm font-medium text-gray-900">{formData.receiptNo}</p>
                        </div>
                        {formData.billAmount && (
                          <div>
                            <p className="text-sm text-gray-600">Total Bill Amount</p>
                            <p className="text-sm font-medium text-gray-900">${parseFloat(formData.billAmount).toFixed(2)}</p>
                          </div>
                        )}
                        {formData.purchaseDate && (
                          <div>
                            <p className="text-sm text-gray-600">Purchase Date</p>
                            <p className="text-sm font-medium text-gray-900">{formData.purchaseDate}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-600">Receiver Wallet Address</p>
                          <p className="text-sm font-medium text-gray-900 break-all">{formData.receiverWalletAddress}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Token</p>
                          <p className="text-sm font-medium text-gray-900">{selectedToken === 'SOMI' ? 'Somnia (SOMI)' : 'USD Coin (USDC)'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-b border-gray-200 pb-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">Personal Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">Passport Number</p>
                          <p className="text-sm font-medium text-gray-900">{formData.passportNo}</p>
                        </div>
                        {formData.flightNo && (
                          <div>
                            <p className="text-sm text-gray-600">Flight Number</p>
                            <p className="text-sm font-medium text-gray-900">{formData.flightNo}</p>
                          </div>
                        )}
                        {formData.nationality && (
                          <div>
                            <p className="text-sm text-gray-600">Country of Nationality</p>
                            <p className="text-sm font-medium text-gray-900">{formData.nationality}</p>
                          </div>
                        )}
                        {formData.dob && (
                          <div>
                            <p className="text-sm text-gray-600">Date of Birth</p>
                            <p className="text-sm font-medium text-gray-900">{formData.dob}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {(formData.merchantName || formData.merchantAddress) && (
                      <div className="border-b border-gray-200 pb-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-3">Merchant Information</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {formData.merchantName && (
                            <div>
                              <p className="text-sm text-gray-600">Merchant Name</p>
                              <p className="text-sm font-medium text-gray-900">{formData.merchantName}</p>
                            </div>
                          )}
                          {formData.merchantAddress && (
                            <div>
                              <p className="text-sm text-gray-600">Merchant Address</p>
                              <p className="text-sm font-medium text-gray-900">{formData.merchantAddress}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Document Type:</span>
                  <span className="text-gray-900 font-medium">VAT Receipt</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Receiver Address:</span>
                  <span className="text-gray-900 font-medium break-all">{formData.receiverWalletAddress}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Token Type:</span>
                  <span className="text-gray-900 font-medium">{selectedToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 font-semibold">Total Refund:</span>
                  <span className="text-green-600 font-bold">{refundAmount.toFixed(2)} {selectedToken}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleReset}
                className="border border-gray-300 text-gray-700 font-medium py-2 px-6 rounded-lg transition-all duration-200 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleApprove}
                disabled={isLoading}
                className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Processing...' : 'Approve & Continue'}
              </button>
            </div>
          </div>
        );

      case 'sign':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sign with Pera Wallet</h2>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center mb-6">
              {transactionStatus === 'waiting' ? (
                <>
                  <QrCode className="w-16 h-16 text-blue-500 mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Check Your Pera Mobile Wallet</h3>
                  <p className="text-gray-600 text-center mb-2">
                    A transaction popup should appear in your Pera mobile wallet app
                  </p>
                  <p className="text-gray-500 text-center text-sm mb-6">
                    If you don't see it, scan this QR code with your Pera Wallet app
                  </p>
                  
                  <div className="bg-white border-2 border-gray-300 rounded-lg p-6 w-[200px] h-[200px] flex items-center justify-center mb-4">
                    <div className="text-center">
                      <QrCode className="w-16 h-16 mx-auto mb-3 text-gray-700" />
                      <div className="text-sm text-gray-600">Scan QR Code</div>
                      <div className="text-xs text-gray-500 mt-1">ID: {qrValue.slice(-8)}</div>
                    </div>
                  </div>
                  
                  <div className="w-full max-w-md bg-blue-50 border border-blue-100 rounded-lg p-4 mt-2">
                    <h4 className="font-medium text-blue-800 mb-2">Transaction Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Amount:</span>
                        <span className="text-sm font-medium text-blue-900">{selectedToken} {refundAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Receiver:</span>
                        <span className="text-sm font-medium text-blue-900 break-all">{entryMode === 'manual' ? formData.receiverWalletAddress : 'Gemetra VAT Refund Service'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-700">Network Fee:</span>
                        <span className="text-sm font-medium text-blue-900">0.001 ALGO</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  {transactionStatus === 'confirmed' ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Transaction Confirmed!</h3>
                      <p className="text-gray-600 mb-4">
                        Your transaction has been confirmed on the Algorand blockchain
                      </p>
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-green-700">Transaction Hash:</span>
                          <a 
                            href={`https://testnet.explorer.perawallet.app/tx/${transactionHash || qrValue.slice(-16)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-900 font-mono flex items-center hover:text-blue-600 hover:underline"
                          >
                            <span className="truncate max-w-32">{(transactionHash || qrValue.slice(-16)).slice(0, 16)}...</span>
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Transaction Rejected</h3>
                      <p className="text-gray-600 mb-4">
                        The transaction was rejected or failed to complete
                      </p>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
                        <p className="text-sm text-red-700">
                          Please try again or contact support if the issue persists
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleReset}
                className="border border-gray-300 text-gray-700 font-medium py-2 px-6 rounded-lg transition-all duration-200 hover:bg-gray-50"
              >
                {transactionStatus !== 'waiting' ? 'Back' : 'Cancel'}
              </button>
              {transactionStatus === 'waiting' ? (
                <button
                  onClick={handleSign}
                  disabled={isLoading}
                  className={`bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200 ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Processing...' : 'I\'ve Scanned the QR Code'}
                </button>
              ) : (
                <button
                  onClick={() => transactionStatus === 'confirmed' ? setStep('confirmation') : handleReset()}
                  className={`${
                    transactionStatus === 'confirmed' 
                      ? 'bg-gray-900 hover:bg-gray-800 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  } font-medium py-2 px-6 rounded-lg transition-all duration-200`}
                >
                  {transactionStatus === 'confirmed' ? 'Continue' : 'Try Again'}
                </button>
              )}
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">VAT Refund Submitted Successfully</h2>
              <p className="text-gray-600">
                Your VAT refund request has been successfully submitted and is being processed
              </p>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
              <div className="space-y-4">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Refund ID:</span>
                  <span className="text-gray-900 font-medium">VAT-{Date.now().toString().slice(-7)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Submission Type:</span>
                  <span className="text-gray-900 font-medium">
                    {entryMode === 'upload' ? 'Document Upload' : 'Manual Entry'}
                  </span>
                </div>
                {entryMode === 'upload' && selectedFile && (
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-600">Document:</span>
                    <span className="text-gray-900 font-medium">{selectedFile.name}</span>
                  </div>
                )}
                {entryMode === 'manual' && (
                  <>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-600">VAT Registration No:</span>
                      <span className="text-gray-900 font-medium">{formData.vatRegNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Receipt No:</span>
                      <span className="text-gray-900 font-medium">{formData.receiptNo}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-600">Passport No:</span>
                      <span className="text-gray-900 font-medium">{formData.passportNo}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Refund Amount:</span>
                  <span className="text-green-600 font-semibold">{selectedToken} {refundAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-600">Submission Date:</span>
                  <span className="text-gray-900 font-medium">{new Date().toLocaleDateString()}</span>
                </div>
                {transactionHash && (
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-600">Transaction Hash:</span>
                    <a 
                      href={`https://testnet.explorer.perawallet.app/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 font-mono text-xs flex items-center hover:text-blue-600 hover:underline"
                    >
                      <span className="truncate max-w-32">{transactionHash.slice(0, 10)}...</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-medium">
                    Completed
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200"
              >
                Submit Another Refund
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600">
                {errorMessage || 'An unexpected error occurred. Please try again.'}
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-6 rounded-lg transition-all duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        );
    }
  };

  const renderHistoryTab = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">VAT Refund History</h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search refunds..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
        </div>

        {isHistoryLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading refund history...</span>
          </div>
        ) : refundHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">No VAT refund history found</div>
            <p className="text-gray-400 text-sm">
              Submit a VAT refund to see it in your history
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Amount</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Token</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {refundHistory.map((refund) => (
                  <tr key={refund.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">
                      {refund.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-gray-800">
                      {new Date(refund.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-800">
                      {refund.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-800">
                      {refund.token || 'ALGO'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        {refund.status === 'completed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {refund.transaction_hash ? (
                        <a 
                          href={`https://testnet.explorer.perawallet.app/tx/${refund.transaction_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-mono flex items-center justify-center space-x-1 hover:underline"
                        >
                          <span className="truncate max-w-28">{refund.transaction_hash.slice(0, 8)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
     

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Submit New Refund
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Refund History
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'upload' ? renderUploadTab() : renderHistoryTab()}
    </div>
  );
};
