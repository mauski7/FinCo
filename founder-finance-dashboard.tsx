import React, { useState, useMemo } from 'react';
import { Upload, Download, Save, X, TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle, CheckCircle, Split } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Papa from 'papaparse';

const INCOME_CATEGORIES = [
  'SaaS/Subscription Revenue',
  'Service Revenue',
  'Consulting Revenue',
  'One-time Sales',
  'Other Income'
];

const COGS_CATEGORIES = [
  'Hosting & Infrastructure',
  'Third-party Software/APIs',
  'Payment Processing Fees',
  'Direct Labor',
  'Materials & Supplies'
];

const OPEX_CATEGORIES = [
  'Sales & Marketing',
  'Salaries & Payroll',
  'Rent & Leasing',
  'Office & Facilities',
  'Professional Services',
  'Software & Subscriptions',
  'Travel & Entertainment',
  'Insurance',
  'Utilities & Telecommunications',
  'Other Operating Expenses'
];

const FUNDING_CATEGORIES = [
  'Equity Investment',
  'Loan/Debt Received',
  'Grant Funding',
  'Other Funding'
];

const FINANCING_CATEGORIES = [
  'Loan Principal Repayment',
  'Interest Payments',
  'Dividend Payments'
];

const INTEREST_INCOME_CATEGORY = 'Interest Income';

const COLORS = ['#7EB6FF', '#000033', '#B0B7C0', '#4A90E2', '#5C6BC0', '#7E57C2', '#AB47BC', '#EC407A'];

const FinancialDashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [newCustomers, setNewCustomers] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [view, setView] = useState('review'); // 'review' or 'dashboard'
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTransaction, setManualTransaction] = useState({
    date: '',
    description: '',
    amount: ''
  });
  const [customCategories, setCustomCategories] = useState({
    income: [],
    cogs: [],
    opex: [],
    funding: [],
    financing: []
  });
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('income');
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [categorizationRules, setCategorizationRules] = useState({});
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splittingTransaction, setSplittingTransaction] = useState(null);
  const [splits, setSplits] = useState([{ category: '', amount: '' }]);
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'merchant', 'category'

  const allIncomeCategories = [...INCOME_CATEGORIES, INTEREST_INCOME_CATEGORY, ...customCategories.income];
  const allCogsCategories = [...COGS_CATEGORIES, ...customCategories.cogs];
  const allOpexCategories = [...OPEX_CATEGORIES, ...customCategories.opex];
  const allFundingCategories = [...FUNDING_CATEGORIES, ...(customCategories.funding || [])];
  const allFinancingCategories = [...FINANCING_CATEGORIES, ...(customCategories.financing || [])];
  const allCategories = [...allIncomeCategories, ...allCogsCategories, ...allOpexCategories, ...allFundingCategories, ...allFinancingCategories];

  const normalizeMerchant = (description) => {
    const desc = description.toLowerCase();
    // Common normalizations
    if (desc.includes('amzn') || desc.includes('amazon aws')) return 'Amazon AWS';
    if (desc.includes('stripe')) return 'Stripe';
    if (desc.includes('google')) return 'Google';
    if (desc.includes('microsoft')) return 'Microsoft';
    if (desc.includes('salesforce')) return 'Salesforce';
    if (desc.includes('zoom')) return 'Zoom';
    if (desc.includes('slack')) return 'Slack';
    if (desc.includes('hubspot')) return 'HubSpot';
    // Return cleaned up version
    return description.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
  };

  const getConfidence = (description, amount, suggestedCategory) => {
    const merchant = normalizeMerchant(description);
    // High confidence if we have a rule for this merchant
    if (categorizationRules[merchant]) return 'high';
    
    const desc = description.toLowerCase();
    // High confidence keywords
    const highConfidenceKeywords = ['subscription', 'payroll', 'rent', 'aws', 'stripe', 'hosting'];
    if (highConfidenceKeywords.some(kw => desc.includes(kw))) return 'high';
    
    // Medium confidence for partially matching
    if (desc.length > 5) return 'medium';
    
    return 'low';
  };

  const autoCategorize = (description, amount) => {
    const merchant = normalizeMerchant(description);
    
    // Check if we have a rule for this merchant
    if (categorizationRules[merchant]) {
      return categorizationRules[merchant];
    }
    
    const desc = description.toLowerCase();
    
    if (amount > 0) {
      if (desc.includes('equity') || desc.includes('investment') || desc.includes('investor')) return 'Equity Investment';
      if (desc.includes('loan') || desc.includes('borrowed') || desc.includes('debt received')) return 'Loan/Debt Received';
      if (desc.includes('grant')) return 'Grant Funding';
      if (desc.includes('interest income') || desc.includes('interest earned')) return 'Interest Income';
      if (desc.includes('subscription') || desc.includes('recurring')) return 'SaaS/Subscription Revenue';
      if (desc.includes('consulting')) return 'Consulting Revenue';
      if (desc.includes('service')) return 'Service Revenue';
      return 'Other Income';
    } else {
      if (desc.includes('loan payment') || desc.includes('principal') || desc.includes('loan repayment')) return 'Loan Principal Repayment';
      if (desc.includes('interest payment') || desc.includes('interest expense')) return 'Interest Payments';
      if (desc.includes('dividend')) return 'Dividend Payments';
      if (desc.includes('aws') || desc.includes('hosting') || desc.includes('server')) return 'Hosting & Infrastructure';
      if (desc.includes('stripe') || desc.includes('payment')) return 'Payment Processing Fees';
      if (desc.includes('api') || desc.includes('software')) return 'Third-party Software/APIs';
      if (desc.includes('salary') || desc.includes('payroll')) return 'Salaries & Payroll';
      if (desc.includes('marketing') || desc.includes('ads') || desc.includes('advertising')) return 'Sales & Marketing';
      if (desc.includes('rent') || desc.includes('lease')) return 'Rent & Leasing';
      if (desc.includes('office')) return 'Office & Facilities';
      if (desc.includes('legal') || desc.includes('accounting')) return 'Professional Services';
      if (desc.includes('insurance')) return 'Insurance';
      if (desc.includes('travel')) return 'Travel & Entertainment';
      return 'Other Operating Expenses';
    }
  };

  const learnFromCorrection = (transaction, newCategory) => {
    const merchant = normalizeMerchant(transaction.description);
    setCategorizationRules(prev => ({
      ...prev,
      [merchant]: newCategory
    }));
  };

  const handleCategoryChange = (id, newCategory) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction && transaction.category !== newCategory) {
      learnFromCorrection(transaction, newCategory);
    }
    
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, category: newCategory } : t
    ));
    setEditingId(null);
  };

  const approveTransaction = (id) => {
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, approved: true } : t
    ));
  };

  const approveAllInGroup = (merchant) => {
    const groupTransactions = transactions.filter(t => 
      normalizeMerchant(t.description) === merchant && !t.approved
    );
    
    if (groupTransactions.length > 0) {
      const category = groupTransactions[0].category;
      setTransactions(transactions.map(t => 
        normalizeMerchant(t.description) === merchant && !t.approved
          ? { ...t, approved: true, category }
          : t
      ));
    }
  };

  const bulkCategorize = (merchant, category) => {
    setTransactions(transactions.map(t => 
      normalizeMerchant(t.description) === merchant && !t.approved
        ? { ...t, category }
        : t
    ));
    learnFromCorrection({ description: merchant }, category);
  };

  const toggleExcluded = (id) => {
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, excluded: !t.excluded } : t
    ));
  };

  const deleteTransaction = (id) => {
    if (window.confirm('Are you sure you want to permanently delete this transaction?')) {
      setTransactions(transactions.filter(t => t.id !== id));
      setUploadMessage('Transaction deleted successfully!');
      setTimeout(() => setUploadMessage(''), 3000);
    }
  };

  const addCustomCategory = () => {
    if (!newCategoryName.trim()) {
      setUploadMessage('Please enter a category name.');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }

    const categoryExists = allCategories.includes(newCategoryName);

    if (categoryExists) {
      setUploadMessage('This category already exists.');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }

    setCustomCategories(prev => ({
      ...prev,
      [newCategoryType]: [...(prev[newCategoryType] || []), newCategoryName]
    }));

    setUploadMessage(`Category "${newCategoryName}" added successfully!`);
    setTimeout(() => setUploadMessage(''), 3000);
    
    setEditCategory(newCategoryName);
    setNewCategoryName('');
    setShowCategoryDialog(false);
    
    if (editingTransactionId) {
      setEditingId(editingTransactionId);
      setEditingTransactionId(null);
    }
  };

  const splitTransaction = () => {
    if (!splittingTransaction) return;
    
    const totalSplit = splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const transactionTotal = Math.abs(splittingTransaction.amount);
    const difference = transactionTotal - totalSplit;
    
    // If there's a difference, add it as a third split
    let finalSplits = [...splits];
    if (Math.abs(difference) > 0.01) {
      finalSplits.push({
        category: 'Other Operating Expenses',
        amount: difference.toFixed(2)
      });
    }

    // Remove original transaction
    const filtered = transactions.filter(t => t.id !== splittingTransaction.id);
    
    // Add split transactions
    const newTransactions = finalSplits.map((split, idx) => ({
      ...splittingTransaction,
      id: Date.now() + idx + Math.random(),
      amount: splittingTransaction.amount > 0 ? parseFloat(split.amount) : -parseFloat(split.amount),
      category: split.category,
      description: `${splittingTransaction.description} (Split ${idx + 1}/${finalSplits.length})`,
      isSplit: true,
      approved: true // Auto-approve split transactions
    }));

    setTransactions([...filtered, ...newTransactions]);
    setShowSplitDialog(false);
    setSplittingTransaction(null);
    setSplits([{ category: '', amount: '' }]);
    setUploadMessage('Transaction split and approved successfully!');
    setTimeout(() => setUploadMessage(''), 3000);
  };

  const addManualTransaction = () => {
    if (!manualTransaction.date || !manualTransaction.description || !manualTransaction.amount) {
      setUploadMessage('Please fill in all fields for manual entry.');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }

    const amount = parseFloat(manualTransaction.amount);
    if (isNaN(amount)) {
      setUploadMessage('Please enter a valid amount.');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }

    const category = autoCategorize(manualTransaction.description, amount);
    const newTransaction = {
      id: Date.now() + Math.random(),
      date: manualTransaction.date,
      description: manualTransaction.description,
      amount: amount,
      category: category,
      confidence: getConfidence(manualTransaction.description, amount, category),
      excluded: false,
      approved: false
    };

    setTransactions([newTransaction, ...transactions]);
    setManualTransaction({ date: '', description: '', amount: '' });
    setShowManualEntry(false);
    setUploadMessage('Transaction added successfully!');
    setTimeout(() => setUploadMessage(''), 3000);
  };

  const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          let text = '';
          let inTextBlock = false;
          
          for (let i = 0; i < typedArray.length - 1; i++) {
            const byte = typedArray[i];
            const nextByte = typedArray[i + 1];
            
            if (byte === 66 && nextByte === 84) {
              inTextBlock = true;
            }
            if (byte === 69 && nextByte === 84) {
              inTextBlock = false;
            }
            
            if (inTextBlock || byte === 10 || byte === 13) {
              const char = String.fromCharCode(byte);
              if (char.match(/[\x20-\x7E\n\r\t]/)) {
                text += char;
              }
            }
          }
          
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read PDF file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parsePDFTransactions = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const transactions = [];
    
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/,
      /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/
    ];
    
    const amountPatterns = [
      /\$?\s*(\-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
      /\((\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\)/g
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 10) continue;
      
      let dateMatch = null;
      for (const pattern of datePatterns) {
        dateMatch = line.match(pattern);
        if (dateMatch) break;
      }
      
      if (!dateMatch) continue;
      
      const amounts = [];
      for (const pattern of amountPatterns) {
        const matches = [...line.matchAll(pattern)];
        matches.forEach(m => {
          const value = m[1].replace(/[\$\,\s]/g, '');
          const num = parseFloat(value);
          if (!isNaN(num)) {
            amounts.push(pattern.toString().includes('\\(') ? -num : num);
          }
        });
      }
      
      if (amounts.length === 0) continue;
      
      const datePos = line.indexOf(dateMatch[0]);
      let description = line.substring(datePos + dateMatch[0].length).trim();
      
      amounts.forEach(amt => {
        description = description.replace(new RegExp(amt.toString().replace(/\./g, '\\.')), '').trim();
        description = description.replace(/[\$\,]/g, '').trim();
      });
      
      const amount = amounts[amounts.length - 1];
      
      if (description.length > 0 && !isNaN(amount) && amount !== 0) {
        const category = autoCategorize(description, amount);
        transactions.push({
          id: Date.now() + i + Math.random(),
          date: dateMatch[0],
          description: description.substring(0, 100),
          amount: amount,
          category: category,
          confidence: getConfidence(description, amount, category),
          excluded: false,
          approved: false
        });
      }
    }
    
    return transactions;
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadMessage(`Processing ${files.length} file${files.length > 1 ? 's' : ''}...`);
    
    let totalTransactions = 0;
    let successCount = 0;
    let failedFiles = [];

    for (const file of files) {
      const fileName = file.name.toLowerCase();

      try {
        if (fileName.endsWith('.csv')) {
          await new Promise((resolve, reject) => {
            Papa.parse(file, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                try {
                  const findColumn = (possibleNames) => {
                    for (const name of possibleNames) {
                      const found = results.meta.fields.find(field => 
                        field && field.toLowerCase().trim().includes(name.toLowerCase())
                      );
                      if (found) return found;
                    }
                    return null;
                  };
                  
                  const dateCol = findColumn(['date', 'transaction date', 'posted date', 'trans date', 'posting date']);
                  const descCol = findColumn(['description', 'memo', 'transaction description', 'details', 'payee']);
                  const amountCol = findColumn(['amount', 'transaction amount']);
                  const debitCol = findColumn(['debit', 'withdrawal', 'withdrawals']);
                  const creditCol = findColumn(['credit', 'deposit', 'deposits']);
                  
                  if (!dateCol || !descCol) {
                    failedFiles.push({ name: file.name, reason: 'Missing date or description column' });
                    resolve();
                    return;
                  }
                  
                  const parsed = results.data.map((row, index) => {
                    const date = row[dateCol] || '';
                    const description = row[descCol] || '';
                    
                    let amount = 0;
                    if (amountCol && row[amountCol]) {
                      const amountStr = String(row[amountCol]).replace(/[$,\s]/g, '');
                      amount = parseFloat(amountStr);
                    } else if (debitCol && creditCol) {
                      const debit = row[debitCol] ? parseFloat(String(row[debitCol]).replace(/[$,\s]/g, '')) : 0;
                      const credit = row[creditCol] ? parseFloat(String(row[creditCol]).replace(/[$,\s]/g, '')) : 0;
                      amount = credit - debit;
                    }
                    
                    const category = autoCategorize(description, amount);
                    return {
                      id: Date.now() + index + Math.random(),
                      date: date,
                      description: description,
                      amount: amount,
                      category: category,
                      confidence: getConfidence(description, amount, category),
                      excluded: false,
                      approved: false
                    };
                  }).filter(t => t.date && !isNaN(t.amount) && t.amount !== 0);
                  
                  if (parsed.length > 0) {
                    setTransactions(prev => [...parsed, ...prev]);
                    totalTransactions += parsed.length;
                    successCount++;
                  } else {
                    failedFiles.push({ name: file.name, reason: 'No valid transactions found' });
                  }
                  resolve();
                } catch (error) {
                  failedFiles.push({ name: file.name, reason: error.message });
                  reject(error);
                }
              },
              error: (error) => {
                failedFiles.push({ name: file.name, reason: error.message });
                reject(error);
              }
            });
          });
        } else if (fileName.endsWith('.pdf')) {
          try {
            const text = await extractTextFromPDF(file);
            const parsed = parsePDFTransactions(text);
            
            if (parsed.length > 0) {
              setTransactions(prev => [...parsed, ...prev]);
              totalTransactions += parsed.length;
              successCount++;
            } else {
              failedFiles.push({ name: file.name, reason: 'Could not extract transactions from PDF' });
            }
          } catch (error) {
            failedFiles.push({ name: file.name, reason: 'PDF parsing failed' });
          }
        } else {
          failedFiles.push({ name: file.name, reason: 'Unsupported file type' });
        }
      } catch (error) {
        failedFiles.push({ name: file.name, reason: 'Processing error' });
      }
    }

    let message = '';
    if (successCount > 0 && failedFiles.length === 0) {
      message = `Successfully imported ${totalTransactions} transactions from ${successCount} file${successCount > 1 ? 's' : ''}!`;
    } else if (successCount > 0 && failedFiles.length > 0) {
      message = `Imported ${totalTransactions} transactions from ${successCount} file${successCount > 1 ? 's' : ''}. ${failedFiles.length} file${failedFiles.length > 1 ? 's' : ''} failed: ${failedFiles.map(f => f.name).join(', ')}`;
    } else {
      message = `Could not import transactions. Failed files: ${failedFiles.map(f => `${f.name} (${f.reason})`).join(', ')}`;
    }
    
    setUploadMessage(message);
    setUploading(false);
    setTimeout(() => setUploadMessage(''), 7000);
    event.target.value = '';
  };

  const pendingTransactions = useMemo(() => 
    transactions.filter(t => !t.approved && !t.excluded)
  , [transactions]);

  const approvedTransactions = useMemo(() => 
    transactions.filter(t => t.approved && !t.excluded)
  , [transactions]);

  const excludedTransactions = useMemo(() => 
    transactions.filter(t => t.excluded)
  , [transactions]);

  const merchantGroups = useMemo(() => {
    const groups = {};
    pendingTransactions.forEach(t => {
      const merchant = normalizeMerchant(t.description);
      if (!groups[merchant]) {
        groups[merchant] = [];
      }
      groups[merchant].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [pendingTransactions]);

  const categoryGroups = useMemo(() => {
    const groups = {};
    pendingTransactions.forEach(t => {
      if (!groups[t.category]) {
        groups[t.category] = [];
      }
      groups[t.category].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [pendingTransactions]);

  const monthlyData = useMemo(() => {
    const grouped = {};
    
    const activeTransactions = approvedTransactions;
    
    activeTransactions.forEach(t => {
      const date = new Date(t.date);
      if (isNaN(date)) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          month: monthKey,
          income: 0,
          cogs: 0,
          opex: 0,
          funding: 0,
          financing: 0,
          transactions: []
        };
      }
      
      grouped[monthKey].transactions.push(t);
      
      if (allIncomeCategories.includes(t.category)) {
        grouped[monthKey].income += Math.abs(t.amount);
      } else if (allCogsCategories.includes(t.category)) {
        grouped[monthKey].cogs += Math.abs(t.amount);
      } else if (allOpexCategories.includes(t.category)) {
        grouped[monthKey].opex += Math.abs(t.amount);
      } else if (allFundingCategories.includes(t.category)) {
        grouped[monthKey].funding += Math.abs(t.amount);
      } else if (allFinancingCategories.includes(t.category)) {
        grouped[monthKey].financing += Math.abs(t.amount);
      }
    });
    
    const sorted = Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
    
    let runningBalance = 0;
    return sorted.map(m => {
      const netCashFlow = m.income + m.funding - m.cogs - m.opex - m.financing;
      runningBalance += netCashFlow;
      return {
        ...m,
        netCashFlow,
        cashBalance: runningBalance
      };
    });
  }, [approvedTransactions, allIncomeCategories, allCogsCategories, allOpexCategories, allFundingCategories, allFinancingCategories]);

  const kpis = useMemo(() => {
    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const totalCOGS = monthlyData.reduce((sum, m) => sum + m.cogs, 0);
    const totalOpEx = monthlyData.reduce((sum, m) => sum + m.opex, 0);
    const totalFunding = monthlyData.reduce((sum, m) => sum + m.funding, 0);
    const totalFinancing = monthlyData.reduce((sum, m) => sum + m.financing, 0);
    
    const avgMonthlyIncome = monthlyData.length > 0 ? totalIncome / monthlyData.length : 0;
    const avgMonthlyCOGS = monthlyData.length > 0 ? totalCOGS / monthlyData.length : 0;
    const avgMonthlyOpEx = monthlyData.length > 0 ? totalOpEx / monthlyData.length : 0;
    const avgMonthlyFinancing = monthlyData.length > 0 ? totalFinancing / monthlyData.length : 0;
    
    const grossBurn = avgMonthlyCOGS + avgMonthlyOpEx + avgMonthlyFinancing;
    const netBurn = grossBurn - avgMonthlyIncome;
    const currentBalance = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].cashBalance : 0;
    const runway = netBurn > 0 ? currentBalance / netBurn : Infinity;
    
    const grossMargin = totalIncome > 0 ? ((totalIncome - totalCOGS) / totalIncome) * 100 : 0;
    const operatingMargin = totalIncome > 0 ? ((totalIncome - totalCOGS - totalOpEx) / totalIncome) * 100 : 0;
    
    const marketingSpend = monthlyData.reduce((sum, m) => {
      const marketing = m.transactions
        .filter(t => t.category === 'Sales & Marketing')
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return sum + marketing;
    }, 0);
    
    const customers = parseInt(newCustomers) || 0;
    const cac = customers > 0 ? marketingSpend / customers : 0;
    
    return {
      cac,
      grossBurn,
      netBurn,
      runway,
      grossMargin,
      operatingMargin,
      currentBalance,
      totalFunding
    };
  }, [monthlyData, newCustomers]);

  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    
    approvedTransactions.forEach(t => {
      if (!breakdown[t.category]) {
        breakdown[t.category] = 0;
      }
      breakdown[t.category] += Math.abs(t.amount);
    });
    
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  }, [approvedTransactions]);

  const exportData = () => {
    const csv = Papa.unparse(transactions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financial_data.csv';
    a.click();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      high: { bg: '#D1FAE5', text: '#065F46', label: 'High' },
      medium: { bg: '#FEF3C7', text: '#92400E', label: 'Med' },
      low: { bg: '#FEE2E2', text: '#991B1B', label: 'Low' }
    };
    const c = colors[confidence] || colors.low;
    return (
      <span style={{
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600',
        backgroundColor: c.bg,
        color: c.text
      }}>
        {c.label}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: '#F5F5F5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ backgroundColor: '#000033', color: '#FFFFFF', padding: '30px', borderRadius: '12px', marginBottom: '20px' }}>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0 0 10px 0', fontSize: '32px' }}>
            Financial Dashboard
          </h1>
          <p style={{ margin: '0', opacity: '0.9' }}>Review, categorize, and track your cash flow</p>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ 
              backgroundColor: uploading ? '#B0B7C0' : '#7EB6FF', 
              color: '#FFFFFF', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500'
            }}>
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Upload Bank Statements'}
              <input 
                type="file" 
                accept=".csv,.pdf" 
                multiple
                onChange={handleFileUpload} 
                disabled={uploading}
                style={{ display: 'none' }} 
              />
            </label>
            
            <button onClick={exportData} disabled={transactions.length === 0} style={{
              backgroundColor: transactions.length === 0 ? '#B0B7C0' : '#000033',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500'
            }}>
              <Download size={20} />
              Export Data
            </button>

            <button onClick={() => setView(view === 'dashboard' ? 'review' : 'dashboard')} style={{
              backgroundColor: '#FFFFFF',
              color: '#000033',
              padding: '12px 24px',
              borderRadius: '8px',
              border: '2px solid #000033',
              cursor: 'pointer',
              fontWeight: '500'
            }}>
              {view === 'dashboard' ? 'Review Transactions' : 'View Dashboard'}
            </button>

            <button onClick={() => setShowManualEntry(!showManualEntry)} style={{
              backgroundColor: showManualEntry ? '#B0B7C0' : '#000033',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}>
              {showManualEntry ? 'Cancel Manual Entry' : 'Add Transaction Manually'}
            </button>

            <button onClick={() => {
              const csvContent = 'Date,Description,Amount\n2024-01-15,Sample Income Transaction,1000.00\n2024-01-16,Sample Expense Transaction,-250.00';
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sample_template.csv';
              a.click();
            }} style={{
              backgroundColor: '#FFFFFF',
              color: '#7EB6FF',
              padding: '12px 24px',
              borderRadius: '8px',
              border: '2px solid #7EB6FF',
              cursor: 'pointer',
              fontWeight: '500'
            }}>
              Download CSV Template
            </button>
          </div>
          
          {uploadMessage && (
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              backgroundColor: uploadMessage.includes('Error') || uploadMessage.includes('No valid') || uploadMessage.includes('Could not') ? '#FEE2E2' : '#D1FAE5',
              color: uploadMessage.includes('Error') || uploadMessage.includes('No valid') || uploadMessage.includes('Could not') ? '#991B1B' : '#065F46',
              borderRadius: '8px',
              fontWeight: '500'
            }}>
              {uploadMessage}
            </div>
          )}
          
          {transactions.length > 0 && !uploadMessage && (
            <div style={{ marginTop: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ color: '#EF4444', fontWeight: '600' }}>
                <AlertCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />
                {pendingTransactions.length} Pending Review
              </div>
              <div style={{ color: '#10B981', fontWeight: '600' }}>
                <CheckCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />
                {approvedTransactions.length} Approved
              </div>
              <div style={{ color: '#B0B7C0' }}>
                {transactions.filter(t => t.excluded).length} Excluded
              </div>
            </div>
          )}
        </div>

        {showManualEntry && (
          <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '20px' }}>
              Add Transaction Manually
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000033', fontSize: '14px' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={manualTransaction.date}
                  onChange={(e) => setManualTransaction({ ...manualTransaction, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #B0B7C0',
                    fontSize: '16px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000033', fontSize: '14px' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={manualTransaction.description}
                  onChange={(e) => setManualTransaction({ ...manualTransaction, description: e.target.value })}
                  placeholder="e.g., Office Rent, Client Payment"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #B0B7C0',
                    fontSize: '16px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000033', fontSize: '14px' }}>
                  Amount (positive for income, negative for expense)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={manualTransaction.amount}
                  onChange={(e) => setManualTransaction({ ...manualTransaction, amount: e.target.value })}
                  placeholder="e.g., 1000.00 or -250.00"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #B0B7C0',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>
            <button onClick={addManualTransaction} style={{
              backgroundColor: '#7EB6FF',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '16px'
            }}>
              Add Transaction
            </button>
          </div>
        )}

        {showCategoryDialog && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ 
              backgroundColor: '#FFFFFF', 
              padding: '30px', 
              borderRadius: '12px', 
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '20px' }}>
                Create New Category
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000033', fontSize: '14px' }}>
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Marketing Software, Legal Fees"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #B0B7C0',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000033', fontSize: '14px' }}>
                  Category Type
                </label>
                <select
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #B0B7C0',
                    fontSize: '16px',
                    color: '#000033'
                  }}
                >
                  <option value="income">Income (Revenue)</option>
                  <option value="cogs">COGS (Cost of Goods Sold)</option>
                  <option value="opex">Operating Expenses</option>
                  <option value="funding">Funding (Cash In - Equity, Loans, Grants)</option>
                  <option value="financing">Funding (Cash Out - Debt Payments, Interest)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setShowCategoryDialog(false);
                    setNewCategoryName('');
                    if (editingTransactionId) {
                      setEditingId(editingTransactionId);
                      setEditingTransactionId(null);
                    }
                  }}
                  style={{
                    backgroundColor: '#B0B7C0',
                    color: '#FFFFFF',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={addCustomCategory}
                  style={{
                    backgroundColor: '#7EB6FF',
                    color: '#FFFFFF',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Create Category
                </button>
              </div>
            </div>
          </div>
        )}

        {showSplitDialog && splittingTransaction && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ 
              backgroundColor: '#FFFFFF', 
              padding: '30px', 
              borderRadius: '12px', 
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '10px' }}>
                Split Transaction
              </h3>
              <p style={{ color: '#B0B7C0', marginBottom: '20px' }}>
                {splittingTransaction.description} - {formatCurrency(Math.abs(splittingTransaction.amount))}
              </p>
              
              <style>
                {`
                  input[type="number"]::-webkit-inner-spin-button,
                  input[type="number"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                  }
                  input[type="number"] {
                    -moz-appearance: textfield;
                  }
                `}
              </style>
              
              {splits.map((split, idx) => (
                <div key={idx} style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#F5F5F5', borderRadius: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Category</label>
                      <select
                        value={split.category}
                        onChange={(e) => {
                          const newSplits = [...splits];
                          newSplits[idx].category = e.target.value;
                          setSplits(newSplits);
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #B0B7C0' }}
                      >
                        <option value="">Select category...</option>
                        <optgroup label="Income">
                          {allIncomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </optgroup>
                        <optgroup label="COGS">
                          {allCogsCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </optgroup>
                        <optgroup label="Operating Expenses">
                          {allOpexCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </optgroup>
                        <optgroup label="Funding (Cash In)">
                          {allFundingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </optgroup>
                        <optgroup label="Funding (Cash Out)">
                          {allFinancingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => {
                          const newSplits = [...splits];
                          newSplits[idx].amount = e.target.value;
                          setSplits(newSplits);
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #B0B7C0' }}
                      />
                    </div>
                    {splits.length > 1 && (
                      <button
                        onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                        style={{ padding: '8px', backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button
                onClick={() => setSplits([...splits, { category: '', amount: '' }])}
                style={{ marginBottom: '20px', padding: '8px 16px', backgroundColor: '#7EB6FF', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                + Add Split
              </button>

              {(() => {
                const totalSplit = splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
                const transactionTotal = Math.abs(splittingTransaction.amount);
                const difference = transactionTotal - totalSplit;
                
                return (
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    backgroundColor: Math.abs(difference) > 0.01 ? '#FEF3C7' : '#D1FAE5',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500' }}>Transaction Total:</span>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(transactionTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500' }}>Split Total:</span>
                      <span style={{ fontWeight: '600' }}>{formatCurrency(totalSplit)}</span>
                    </div>
                    {Math.abs(difference) > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #92400E' }}>
                        <span style={{ fontWeight: '600', color: '#92400E' }}>Difference (will be auto-added):</span>
                        <span style={{ fontWeight: '700', color: '#92400E' }}>{formatCurrency(Math.abs(difference))}</span>
                      </div>
                    )}
                    {Math.abs(difference) > 0.01 && (
                      <p style={{ fontSize: '13px', color: '#92400E', marginTop: '10px', marginBottom: '0' }}>
                        ℹ️ A third split will be automatically created for the difference and assigned to "Other Operating Expenses". You can edit this after approval.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setShowSplitDialog(false);
                    setSplittingTransaction(null);
                    setSplits([{ category: '', amount: '' }]);
                  }}
                  style={{
                    backgroundColor: '#B0B7C0',
                    color: '#FFFFFF',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={splitTransaction}
                  disabled={splits.some(s => !s.category || !s.amount)}
                  style={{
                    backgroundColor: splits.some(s => !s.category || !s.amount) ? '#B0B7C0' : '#10B981',
                    color: '#FFFFFF',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: splits.some(s => !s.category || !s.amount) ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Split and Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div style={{ 
            backgroundColor: '#FFFFFF', 
            padding: '60px', 
            borderRadius: '12px', 
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <Upload size={64} color="#B0B7C0" style={{ margin: '0 auto 20px' }} />
            <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '10px' }}>
              Get Started
            </h3>
            <p style={{ color: '#B0B7C0', marginBottom: '20px' }}>Upload your bank statements (multiple files supported) to begin tracking your finances</p>
            <div style={{ 
              backgroundColor: '#F5F5F5', 
              padding: '20px', 
              borderRadius: '8px', 
              maxWidth: '500px', 
              margin: '0 auto',
              textAlign: 'left'
            }}>
              <p style={{ color: '#000033', fontWeight: '600', marginBottom: '10px' }}>📋 Features:</p>
              <ul style={{ color: '#B0B7C0', fontSize: '14px', lineHeight: '1.6', paddingLeft: '20px' }}>
                <li>Smart auto-categorization with confidence indicators</li>
                <li>Bulk editing by merchant or category</li>
                <li>Transaction splitting for shared expenses</li>
                <li>Learning rules engine - gets smarter with each correction</li>
                <li>Approval workflow to ensure data accuracy</li>
              </ul>
            </div>
          </div>
        ) : view === 'review' ? (
          <>
            {pendingTransactions.length > 0 && (
              <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', margin: '0' }}>
                    <AlertCircle size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    Pending Review ({pendingTransactions.length})
                  </h2>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#B0B7C0' }}>Group by:</span>
                    <select 
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #B0B7C0', fontSize: '14px' }}
                    >
                      <option value="none">None</option>
                      <option value="merchant">Merchant</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                </div>

                {groupBy === 'merchant' ? (
                  merchantGroups.map(([merchant, txns]) => (
                    <div key={merchant} style={{ marginBottom: '25px', border: '2px solid #F5F5F5', borderRadius: '8px', padding: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 5px 0', color: '#000033', fontSize: '18px' }}>{merchant}</h3>
                          <p style={{ margin: '0', color: '#B0B7C0', fontSize: '14px' }}>{txns.length} transactions - {formatCurrency(txns.reduce((sum, t) => sum + Math.abs(t.amount), 0))}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <select
                            onChange={(e) => bulkCategorize(merchant, e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #B0B7C0' }}
                          >
                            <option value="">Change category for all...</option>
                            <optgroup label="Income">
                              {allIncomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </optgroup>
                            <optgroup label="COGS">
                              {allCogsCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </optgroup>
                            <optgroup label="Operating Expenses">
                              {allOpexCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </optgroup>
                            <optgroup label="Funding (Cash In)">
                              {allFundingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </optgroup>
                            <optgroup label="Funding (Cash Out)">
                              {allFinancingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </optgroup>
                          </select>
                          <button
                            onClick={() => approveAllInGroup(merchant)}
                            style={{ padding: '8px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                          >
                            <CheckCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />
                            Approve All
                          </button>
                        </div>
                      </div>
                      {txns.slice(0, 3).map(t => (
                        <div key={t.id} style={{ padding: '10px', backgroundColor: '#F5F5F5', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', color: '#000033' }}>{t.date} - {t.description}</div>
                            <div style={{ fontSize: '12px', color: '#B0B7C0', marginTop: '4px' }}>
                              {getConfidenceBadge(t.confidence)} {t.category}
                            </div>
                          </div>
                          <div style={{ fontWeight: '600', color: t.amount > 0 ? '#10B981' : '#EF4444', marginLeft: '15px' }}>
                            {formatCurrency(t.amount)}
                          </div>
                        </div>
                      ))}
                      {txns.length > 3 && (
                        <div style={{ fontSize: '14px', color: '#B0B7C0', marginTop: '8px' }}>
                          + {txns.length - 3} more transactions
                        </div>
                      )}
                    </div>
                  ))
                ) : groupBy === 'category' ? (
                  categoryGroups.map(([category, txns]) => (
                    <div key={category} style={{ marginBottom: '25px', border: '2px solid #F5F5F5', borderRadius: '8px', padding: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 5px 0', color: '#000033', fontSize: '18px' }}>{category}</h3>
                          <p style={{ margin: '0', color: '#B0B7C0', fontSize: '14px' }}>{txns.length} transactions - {formatCurrency(txns.reduce((sum, t) => sum + Math.abs(t.amount), 0))}</p>
                        </div>
                        <button
                          onClick={() => {
                            txns.forEach(t => approveTransaction(t.id));
                          }}
                          style={{ padding: '8px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                        >
                          <CheckCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />
                          Approve All
                        </button>
                      </div>
                      {txns.slice(0, 5).map(t => (
                        <div key={t.id} style={{ padding: '10px', backgroundColor: '#F5F5F5', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', color: '#000033' }}>{t.date} - {t.description}</div>
                            <div style={{ fontSize: '12px', color: '#B0B7C0', marginTop: '4px' }}>
                              {getConfidenceBadge(t.confidence)}
                            </div>
                          </div>
                          <div style={{ fontWeight: '600', color: t.amount > 0 ? '#10B981' : '#EF4444', marginLeft: '15px' }}>
                            {formatCurrency(t.amount)}
                          </div>
                        </div>
                      ))}
                      {txns.length > 5 && (
                        <div style={{ fontSize: '14px', color: '#B0B7C0', marginTop: '8px' }}>
                          + {txns.length - 5} more transactions
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #F5F5F5' }}>
                          <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600', width: '100px' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Description</th>
                          <th style={{ padding: '12px', textAlign: 'right', color: '#000033', fontWeight: '600', width: '120px' }}>Amount</th>
                          <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600', width: '200px' }}>Category</th>
                          <th style={{ padding: '12px', textAlign: 'center', color: '#000033', fontWeight: '600', width: '200px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTransactions.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                            <td style={{ padding: '12px' }}>{t.date}</td>
                            <td style={{ padding: '12px' }}>{t.description}</td>
                            <td style={{ 
                              padding: '12px', 
                              textAlign: 'right',
                              color: t.amount > 0 ? '#10B981' : '#EF4444',
                              fontWeight: '500'
                            }}>
                              {formatCurrency(t.amount)}
                            </td>
                            <td style={{ padding: '12px' }}>
                              {editingId === t.id ? (
                                <div>
                                  <select 
                                    value={editCategory} 
                                    onChange={(e) => {
                                      if (e.target.value === '__CREATE_NEW__') {
                                        setEditingTransactionId(t.id);
                                        setShowCategoryDialog(true);
                                      } else {
                                        setEditCategory(e.target.value);
                                      }
                                    }}
                                    style={{ 
                                      padding: '8px', 
                                      borderRadius: '6px', 
                                      border: '2px solid #7EB6FF',
                                      width: '100%',
                                      fontSize: '14px',
                                      marginBottom: '8px'
                                    }}
                                  >
                                    <optgroup label="Income">
                                      {allIncomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </optgroup>
                                    <optgroup label="COGS">
                                      {allCogsCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </optgroup>
                                    <optgroup label="Operating Expenses">
                                      {allOpexCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </optgroup>
                                    <optgroup label="Funding (Cash In)">
                                      {allFundingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </optgroup>
                                    <optgroup label="Funding (Cash Out)">
                                      {allFinancingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </optgroup>
                                    <option value="__CREATE_NEW__" style={{ color: '#7EB6FF', fontWeight: '600' }}>+ Create New...</option>
                                  </select>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button 
                                      onClick={() => handleCategoryChange(t.id, editCategory)}
                                      style={{ 
                                        backgroundColor: '#10B981', 
                                        color: '#FFFFFF',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        flex: 1
                                      }}
                                    >
                                      <Save size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSplittingTransaction(t);
                                        setSplits([{ category: editCategory, amount: (Math.abs(t.amount) / 2).toFixed(2) }, { category: '', amount: (Math.abs(t.amount) / 2).toFixed(2) }]);
                                        setShowSplitDialog(true);
                                        setEditingId(null);
                                      }}
                                      style={{ 
                                        backgroundColor: '#7EB6FF', 
                                        color: '#FFFFFF',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                      }}
                                    >
                                      <Split size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                      Split
                                    </button>
                                    <button 
                                      onClick={() => setEditingId(null)}
                                      style={{ 
                                        backgroundColor: '#EF4444', 
                                        color: '#FFFFFF',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        flex: 1
                                      }}
                                    >
                                      <X size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span 
                                    onClick={() => {
                                      setEditingId(t.id);
                                      setEditCategory(t.category);
                                    }}
                                    style={{ 
                                      padding: '6px 12px', 
                                      backgroundColor: '#F5F5F5', 
                                      borderRadius: '6px',
                                      fontSize: '14px',
                                      cursor: 'pointer',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {t.category}
                                  </span>
                                  <div style={{ marginTop: '4px' }}>{getConfidenceBadge(t.confidence)}</div>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => approveTransaction(t.id)}
                                  style={{ padding: '6px 12px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                  Approve
                                </button>
                                <button
                                  onClick={() => toggleExcluded(t.id)}
                                  style={{ padding: '6px 12px', backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Exclude
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {approvedTransactions.length > 0 && (
              <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '20px' }}>
                  <CheckCircle size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#10B981' }} />
                  Approved Transactions ({approvedTransactions.length})
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F5F5F5' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Description</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#000033', fontWeight: '600' }}>Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedTransactions.slice(0, 50).map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #F5F5F5', opacity: 0.7 }}>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{t.date}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{t.description}</td>
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'right',
                            color: t.amount > 0 ? '#10B981' : '#EF4444',
                            fontWeight: '500',
                            fontSize: '14px'
                          }}>
                            {formatCurrency(t.amount)}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            <span style={{ padding: '4px 10px', backgroundColor: '#F5F5F5', borderRadius: '6px' }}>
                              {t.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {approvedTransactions.length > 50 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#B0B7C0' }}>
                      Showing first 50 of {approvedTransactions.length} approved transactions
                    </div>
                  )}
                </div>
              </div>
            )}

            {excludedTransactions.length > 0 && (
              <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '10px' }}>
                  <X size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#EF4444' }} />
                  Excluded Transactions ({excludedTransactions.length})
                </h2>
                <p style={{ color: '#B0B7C0', marginBottom: '20px', fontSize: '14px' }}>
                  These transactions are excluded from all calculations. You can re-include them or delete them permanently.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #F5F5F5' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Description</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#000033', fontWeight: '600' }}>Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#000033', fontWeight: '600' }}>Category</th>
                        <th style={{ padding: '12px', textAlign: 'center', color: '#000033', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excludedTransactions.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #F5F5F5', opacity: 0.6 }}>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{t.date}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{t.description}</td>
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'right',
                            color: t.amount > 0 ? '#10B981' : '#EF4444',
                            fontWeight: '500',
                            fontSize: '14px'
                          }}>
                            {formatCurrency(t.amount)}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            <span style={{ padding: '4px 10px', backgroundColor: '#F5F5F5', borderRadius: '6px' }}>
                              {t.category}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => toggleExcluded(t.id)}
                                style={{ 
                                  padding: '6px 12px', 
                                  backgroundColor: '#10B981', 
                                  color: '#FFFFFF', 
                                  border: 'none', 
                                  borderRadius: '6px', 
                                  cursor: 'pointer', 
                                  fontSize: '13px',
                                  fontWeight: '500'
                                }}
                              >
                                <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Re-include
                              </button>
                              <button
                                onClick={() => deleteTransaction(t.id)}
                                style={{ 
                                  padding: '6px 12px', 
                                  backgroundColor: '#EF4444', 
                                  color: '#FFFFFF', 
                                  border: 'none', 
                                  borderRadius: '6px', 
                                  cursor: 'pointer', 
                                  fontSize: '13px',
                                  fontWeight: '500'
                                }}
                              >
                                <X size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#000033' }}>
                New Customers Acquired (for CAC calculation):
              </label>
              <input 
                type="number" 
                value={newCustomers}
                onChange={(e) => setNewCustomers(e.target.value)}
                placeholder="Enter number of new customers"
                style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #B0B7C0',
                  width: '300px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <DollarSign size={24} color="#7EB6FF" />
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0', fontSize: '16px', color: '#B0B7C0' }}>CAC</h3>
                </div>
                <p style={{ fontSize: '28px', fontWeight: '600', color: '#000033', margin: '0' }}>
                  {formatCurrency(kpis.cac)}
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <TrendingDown size={24} color="#EF4444" />
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0', fontSize: '16px', color: '#B0B7C0' }}>Gross Burn</h3>
                </div>
                <p style={{ fontSize: '28px', fontWeight: '600', color: '#000033', margin: '0' }}>
                  {formatCurrency(kpis.grossBurn)}/mo
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <TrendingDown size={24} color="#EF4444" />
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0', fontSize: '16px', color: '#B0B7C0' }}>Net Burn</h3>
                </div>
                <p style={{ fontSize: '28px', fontWeight: '600', color: '#000033', margin: '0' }}>
                  {formatCurrency(kpis.netBurn)}/mo
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Calendar size={24} color="#7EB6FF" />
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0', fontSize: '16px', color: '#B0B7C0' }}>Runway</h3>
                </div>
                <p style={{ fontSize: '28px', fontWeight: '600', color: '#000033', margin: '0' }}>
                  {kpis.runway === Infinity ? '∞' : `${kpis.runway.toFixed(1)} mo`}
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <TrendingUp size={24} color="#10B981" />
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0', fontSize: '16px', color: '#B0B7C0' }}>Gross Margin</h3>
                </div>
                <p style={{ fontSize: '28px', fontWeight: '600', color: '#000033', margin: '0' }}>
                  {kpis.grossMargin.toFixed(1)}%
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <TrendingUp size={24} color="#10B981" />
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', margin: '0', fontSize: '16px', color: '#B0B7C0' }}>Operating Margin</h3>
                </div>
                <p style={{ fontSize: '28px', fontWeight: '600', color: '#000033', margin: '0' }}>
                  {kpis.operatingMargin.toFixed(1)}%
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '20px' }}>
                  Monthly Cash Balance
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#B0B7C0" />
                    <YAxis stroke="#B0B7C0" />
                    <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatMonth} />
                    <Line type="monotone" dataKey="cashBalance" stroke="#7EB6FF" strokeWidth={3} dot={{ fill: '#7EB6FF', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '20px' }}>
                  Income vs Expenses
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#B0B7C0" />
                    <YAxis stroke="#B0B7C0" />
                    <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatMonth} />
                    <Legend />
                    <Bar dataKey="income" fill="#10B981" name="Income" />
                    <Bar dataKey="cogs" fill="#EF4444" name="COGS" />
                    <Bar dataKey="opex" fill="#F59E0B" name="OpEx" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#000033', marginBottom: '20px' }}>
                Spending by Category
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;