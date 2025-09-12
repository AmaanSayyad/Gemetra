import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchCryptoPrice, formatPriceResponse } from './priceService';
import { fixTypos } from './textProcessingService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('Gemini API key not found. AI features will use fallback responses.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface AIContext {
  employees: any[];
  payments: any[];
  companyName: string;
}

// Advanced memory and thinking system
interface ConversationMemory {
  message: string;
  response: string;
  type: string;
  timestamp: Date;
  topics: string[];
  entities: string[];
  intent: string;
  context: any;
}

interface ThinkingContext {
  currentTopic: string;
  primaryCrypto: string;
  userIntent: string;
  conversationPhase: 'initial' | 'exploring' | 'deep_dive' | 'comparative';
  establishedFacts: { [key: string]: any };
  userPreferences: string[];
  recentQuestions: string[];
}

let conversationMemory: ConversationMemory[] = [];
let thinkingContext: ThinkingContext = {
  currentTopic: 'algorand',
  primaryCrypto: 'algorand',
  userIntent: 'general',
  conversationPhase: 'initial',
  establishedFacts: {},
  userPreferences: [],
  recentQuestions: []
};

const analyzeMessage = (message: string): { topics: string[], entities: string[], intent: string } => {
  
  const topics = [];
  const entities = [];
  
  // Topic detection - expanded for comprehensive company intelligence
  if (/(price|cost|value|worth)/i.test(message)) topics.push('pricing');
  if (/(ath|all.?time.?high|highest|peak)/i.test(message)) topics.push('ath');
  if (/(atl|all.?time.?low|lowest|bottom)/i.test(message)) topics.push('atl');
  if (/(founder|create|start|who)/i.test(message)) topics.push('foundation');
  if (/(market|cap|rank|volume)/i.test(message)) topics.push('market_data');
  if (/(analysis|technical|trend)/i.test(message)) topics.push('analysis');
  if (/(compare|vs|versus)/i.test(message)) topics.push('comparison');
  
  // Company intelligence topics
  if (/(employee|staff|worker|team)/i.test(message)) topics.push('employees');
  if (/(salary|wage|pay|compensation|income)/i.test(message)) topics.push('salary');
  if (/(highest|top|maximum|most)/i.test(message)) topics.push('highest');
  if (/(lowest|bottom|minimum|least)/i.test(message)) topics.push('lowest');
  if (/(newest|latest|recent|new)/i.test(message)) topics.push('newest');
  if (/(oldest|first|original)/i.test(message)) topics.push('oldest');
  if (/(total|count|number|how many)/i.test(message)) topics.push('count');
  if (/(overview|summary|breakdown|list)/i.test(message)) topics.push('overview');
  if (/(company|business|organization)/i.test(message)) topics.push('company');
  if (/(payroll|payment|budget)/i.test(message)) topics.push('payroll');
  if (/(department|division|team)/i.test(message)) topics.push('department');
  if (/(average|mean|typical)/i.test(message)) topics.push('average');
  if (/(increase|growth|rise|percentage)/i.test(message)) topics.push('growth');
  if (/(name|called|title)/i.test(message)) topics.push('name');
  if (/(does|do|business|industry)/i.test(message)) topics.push('business_type');
  
  // Entity detection
  const cryptos = message.match(/(algorand|algo|bitcoin|btc|ethereum|eth|cardano|ada|solana|sol)/gi) || [];
  entities.push(...cryptos.map(c => c.toLowerCase()));
  
  const people = message.match(/(founder|creator|ceo|silvio|micali)/gi) || [];
  entities.push(...people.map(p => p.toLowerCase()));
  
  const departments = message.match(/(engineering|marketing|sales|hr|finance|operations|design|product)/gi) || [];
  entities.push(...departments.map(d => d.toLowerCase()));
  
  // Intent detection - expanded
  let intent = 'general';
  if (/(what|whats|tell me)/i.test(message)) intent = 'question';
  if (/(how|explain|why)/i.test(message)) intent = 'explanation';
  if (/(compare|difference|vs)/i.test(message)) intent = 'comparison';
  if (/(founder|who|create)/i.test(message)) intent = 'knowledge';
  if (/(list|show|give me)/i.test(message)) intent = 'data_request';
  if (/(overview|summary)/i.test(message)) intent = 'summary';
  
  return { topics, entities, intent };
};

const updateThinkingContext = (message: string, analysis: any) => {
  // Update primary crypto
  if (analysis.entities.includes('bitcoin') || analysis.entities.includes('btc')) {
    thinkingContext.primaryCrypto = 'bitcoin';
  } else if (analysis.entities.includes('ethereum') || analysis.entities.includes('eth')) {
    thinkingContext.primaryCrypto = 'ethereum';
  } else if (analysis.entities.includes('algorand') || analysis.entities.includes('algo') || analysis.topics.includes('ath') || analysis.topics.includes('atl')) {
    thinkingContext.primaryCrypto = 'algorand';
  }
  
  // Update topic
  if (analysis.topics.length > 0) {
    thinkingContext.currentTopic = analysis.topics[0];
  }
  
  // Update intent
  thinkingContext.userIntent = analysis.intent;
  
  // Update conversation phase
  const messageCount = conversationMemory.length;
  if (messageCount < 3) thinkingContext.conversationPhase = 'initial';
  else if (messageCount < 7) thinkingContext.conversationPhase = 'exploring';
  else thinkingContext.conversationPhase = 'deep_dive';
  
  // Track recent questions
  thinkingContext.recentQuestions.push(message);
  if (thinkingContext.recentQuestions.length > 5) {
    thinkingContext.recentQuestions = thinkingContext.recentQuestions.slice(-5);
  }
};

const addToMemory = (message: string, response: string, responseType: string) => {
  const analysis = analyzeMessage(message);
  
  conversationMemory.push({
    message,
    response,
    type: responseType,
    timestamp: new Date(),
    topics: analysis.topics,
    entities: analysis.entities,
    intent: analysis.intent,
    context: { ...thinkingContext }
  });
  
  // Keep last 20 exchanges for deep context
  if (conversationMemory.length > 20) {
    conversationMemory = conversationMemory.slice(-20);
  }
  
  updateThinkingContext(message, analysis);
};

const intelligentThinking = (message: string): { shouldAnswer: boolean, directAnswer?: string, reasoning: string } => {
  const analysis = analyzeMessage(message);
  
  console.log('🤔 AI Thinking:', {
    message,
    analysis,
    currentContext: thinkingContext,
    recentMemory: conversationMemory.slice(-3).map(m => ({ msg: m.message, topics: m.topics }))
  });
  
  // Intelligent reasoning based on context
  
  // ATH questions - always answer with Algorand unless another crypto explicitly mentioned
  if (analysis.topics.includes('ath')) {
    const targetCrypto = analysis.entities.find(e => ['bitcoin', 'ethereum', 'cardano', 'solana'].includes(e)) || 'algorand';
    return {
      shouldAnswer: true,
      directAnswer: 'ath',
      reasoning: `User asking about ATH. Context suggests ${targetCrypto}. This is an Algorand app, so default to Algorand unless specifically mentioned otherwise.`
    };
  }
  
  // ATL questions
  if (analysis.topics.includes('atl')) {
    const targetCrypto = analysis.entities.find(e => ['bitcoin', 'ethereum', 'cardano', 'solana'].includes(e)) || 'algorand';
    return {
      shouldAnswer: true,
      directAnswer: 'atl',
      reasoning: `User asking about ATL. Context suggests ${targetCrypto}.`
    };
  }
  
  // Founder questions
  if (analysis.topics.includes('foundation') || analysis.entities.includes('founder')) {
    return {
      shouldAnswer: true,
      directAnswer: 'founder',
      reasoning: `User asking about founder. In Algorand context, this means Silvio Micali.`
    };
  }
  
  // Price questions
  if (analysis.topics.includes('pricing')) {
    const targetCrypto = analysis.entities.find(e => ['bitcoin', 'ethereum', 'cardano', 'solana'].includes(e)) || thinkingContext.primaryCrypto;
    return {
      shouldAnswer: true,
      directAnswer: 'price',
      reasoning: `User asking about price. Target crypto: ${targetCrypto}`
    };
  }
  
  // If we've been in a conversation and user asks vague questions, use context
  if (conversationMemory.length > 2 && analysis.intent === 'question') {
    const recentTopics = conversationMemory.slice(-3).flatMap(m => m.topics);
    if (recentTopics.includes('ath') || recentTopics.includes('atl') || recentTopics.includes('pricing')) {
      return {
        shouldAnswer: true,
        directAnswer: 'contextual',
        reasoning: `Based on conversation history, user likely wants ${thinkingContext.primaryCrypto} data.`
      };
    }
  }
  
  return {
    shouldAnswer: false,
    reasoning: 'Need more context or should use Gemini for complex response.'
  };
};

const createSystemPrompt = (context: AIContext) => {
  const employeeData = context.employees.length > 0 
    ? context.employees.map(emp => `- ${emp.name}: ${emp.designation} in ${emp.department}, Salary: $${emp.salary}`).join('\n')
    : '- No employees in system yet';

  const paymentData = context.payments.length > 0
    ? context.payments.slice(-5).map(payment => `- $${payment.amount} to ${payment.employee_name || 'Employee'} on ${payment.created_at || 'N/A'}`).join('\n')
    : '- No payments made yet';

  const memoryContext = conversationMemory.slice(-5).map(m => 
    `User: ${m.message} (Topics: ${m.topics.join(', ')}) -> AI: ${m.response.substring(0, 100)}...`
  ).join('\n');

  const factContext = Object.entries(thinkingContext.establishedFacts)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return `You are an EXTREMELY intelligent AI with advanced memory and contextual thinking capabilities. You are focused on Algorand but knowledgeable about all crypto.

🧠 ADVANCED COGNITIVE ABILITIES:
✅ Perfect memory of our entire conversation
✅ Contextual thinking and inference
✅ Pattern recognition across exchanges
✅ Intelligent assumption making
✅ Topic continuity awareness
✅ Entity relationship understanding

🏢 COMPANY CONTEXT:
- Company: ${context.companyName} (Algorand-based payroll)
- Employees: ${context.employees.length}
- Payments: ${context.payments.length}

👥 EMPLOYEE DATA:
${employeeData}

💰 RECENT PAYMENTS:
${paymentData}

🧠 CURRENT THINKING CONTEXT:
- Primary Focus: ${thinkingContext.primaryCrypto.toUpperCase()}
- Current Topic: ${thinkingContext.currentTopic}
- User Intent: ${thinkingContext.userIntent}
- Conversation Phase: ${thinkingContext.conversationPhase}
- Recent Questions: ${thinkingContext.recentQuestions.slice(-3).join(' | ')}

📚 CONVERSATION MEMORY:
${memoryContext}

💡 ESTABLISHED FACTS:
${factContext}

🎯 INTELLIGENT BEHAVIOR:
1. **Context Continuity**: When user asks follow-up questions, understand they're continuing the same topic
2. **Smart Defaults**: In an Algorand app, crypto questions default to Algorand unless specified
3. **Memory Integration**: Reference previous exchanges naturally
4. **Inference Making**: Make intelligent assumptions based on context
5. **Progressive Depth**: Provide deeper insights as conversation develops
6. **Entity Awareness**: Remember what we've discussed about specific topics

🚀 SPECIALIZED KNOWLEDGE:
- Algorand: Founded by Silvio Micali (MIT professor, Turing Award winner)
- Real-time market data with ATH/ATL tracking
- Technical analysis and market insights
- Business analytics and payroll optimization

CRITICAL: Think intelligently. Use context. Make inferences. Provide direct answers when context is clear. Be naturally conversational and remember everything we've discussed.`;
};

const handleIntelligentQueries = async (message: string, context: AIContext): Promise<string | null> => {
  const thinking = intelligentThinking(message);
  
  console.log('🧠 Intelligent Analysis:', thinking);
  
  // First check for company intelligence questions
  const companyResponse = handleCompanyIntelligence(message, context);
  if (companyResponse) {
    addToMemory(message, companyResponse, 'company_intelligence');
    return companyResponse;
  }
  
  if (!thinking.shouldAnswer) return null;
  
  try {
    switch (thinking.directAnswer) {
      case 'ath':
        const athCrypto = thinkingContext.primaryCrypto;
        const athData = await fetchCryptoPrice(athCrypto);
        if (athData?.ath) {
          const athDate = new Date(athData.athDate || '').toLocaleDateString();
          const distanceFromATH = athData.athChangePercentage || 0;
          
          const response = `📈 **${athCrypto.toUpperCase()} All-Time High**

🎯 **ATH:** $${athData.ath.toFixed(4)} (${athDate})
📍 **Current:** $${athData.price.toFixed(4)}
📉 **From ATH:** ${distanceFromATH.toFixed(1)}% below peak

${distanceFromATH > -50 ? '💡 Still within reasonable distance of peak levels!' : '🔍 Significant discount from peak - interesting for long-term perspective.'}`;

          thinkingContext.establishedFacts[`${athCrypto}_ath`] = athData.ath;
          addToMemory(message, response, 'ath_intelligent');
          return response;
        }
        break;
        
      case 'atl':
        const atlCrypto = thinkingContext.primaryCrypto;
        const atlData = await fetchCryptoPrice(atlCrypto);
        if (atlData?.atl) {
          const atlDate = new Date(atlData.atlDate || '').toLocaleDateString();
          const gainFromATL = atlData.atlChangePercentage || 0;
          
          const response = `📉 **${atlCrypto.toUpperCase()} All-Time Low**

🔻 **ATL:** $${atlData.atl.toFixed(6)} (${atlDate})
📍 **Current:** $${atlData.price.toFixed(4)}  
📈 **From ATL:** +${gainFromATL.toFixed(1)}% above bottom

🚀 Amazing ${gainFromATL.toFixed(0)}% recovery from the absolute lows!`;

          thinkingContext.establishedFacts[`${atlCrypto}_atl`] = atlData.atl;
          addToMemory(message, response, 'atl_intelligent');
          return response;
        }
        break;
        
      case 'founder':
        const founderResponse = `👨‍🎓 **Algorand Founder: Silvio Micali**

🏆 **Credentials:**
• MIT Professor (Computer Science)
• Turing Award Winner (2012) - "Nobel Prize of Computing"
• Pioneer of cryptographic protocols and zero-knowledge proofs
• Co-inventor of probabilistic encryption

🚀 **Algorand Vision:**
Created Algorand to solve the "blockchain trilemma" - achieving security, scalability, and decentralization simultaneously through Pure Proof-of-Stake consensus.

💡 **Why It Matters:** Having a Turing Award winner behind Algorand gives serious academic and technical credibility to the project.`;

        thinkingContext.establishedFacts['algorand_founder'] = 'Silvio Micali';
        addToMemory(message, founderResponse, 'founder_intelligent');
        return founderResponse;
        
      case 'price':
        const priceCrypto = thinkingContext.primaryCrypto;
        const priceData = await fetchCryptoPrice(priceCrypto);
        if (priceData) {
          const response = formatPriceResponse(priceData, priceCrypto);
          thinkingContext.establishedFacts[`${priceCrypto}_price`] = priceData.price;
          addToMemory(message, response, 'price_intelligent');
          return response;
        }
        break;
    }
  } catch (error) {
    console.error('Error in intelligent query handling:', error);
  }
  
  return null;
};

const fallbackResponses = {
  greeting: [
    "Hello! I'm your smart AI assistant for My Company with deep knowledge about your company data, payroll operations, and Algorand blockchain technology. I can analyze your employee data, provide payment insights, explain blockchain concepts, and have natural conversations. What would you like to know?",
    "Hi there! I'm your AI assistant with access to live Algorand market data, your company analytics, and blockchain expertise. I can help with employee insights, payment analysis, crypto prices, and answer questions about your business. How can I help?",
    "Hey! I'm your intelligent assistant for My Company. I know your employees, payments, Algorand prices, market data, and can dive deep into blockchain topics. Ready to explore your data or discuss crypto? What's on your mind?"
  ],
  clarification: [
    "I want to give you the most accurate information! Could you clarify which specific aspect you're interested in? 🤔",
    "I'd love to help! Just to make sure I understand correctly - which particular data point or cryptocurrency are you asking about? 📊",
    "Great question! To give you the perfect answer, could you specify which cryptocurrency or metric you're most interested in? 🎯"
  ],
  intelligent: [
    "I'm analyzing multiple data points to give you the most comprehensive answer. Let me break this down with real insights... 🧠",
    "Based on our conversation and current market conditions, here's what I'm seeing... 📈",
    "Interesting question! Let me provide some intelligent analysis on this... 🔍"
  ]
};

const getContextualFallback = (message: string): string => {
  const messageCount = conversationMemory.length;
  
  if (/(hi|hello|hey)/i.test(message)) {
    return fallbackResponses.greeting[Math.floor(Math.random() * fallbackResponses.greeting.length)];
  }
  
  if (messageCount > 3) {
    return fallbackResponses.intelligent[Math.floor(Math.random() * fallbackResponses.intelligent.length)];
  }
  
  return fallbackResponses.clarification[Math.floor(Math.random() * fallbackResponses.clarification.length)];
};

export const generateAIResponse = async (
  message: string, 
  context: AIContext
): Promise<string> => {
  console.log('🧠 Generating ultra-intelligent response for:', message);
  console.log('📊 Full context:', { 
    employees: context.employees.length, 
    payments: context.payments.length, 
    company: context.companyName,
    conversationMemory: conversationMemory.length,
    thinkingContext
  });

  // First, try intelligent contextual handling
  const intelligentResponse = await handleIntelligentQueries(message, context);
  if (intelligentResponse) {
    console.log('🎯 Returning contextually intelligent response');
    return intelligentResponse;
  }

  // Fix typos in the message
  const correctedMessage = fixTypos(message);
  if (correctedMessage !== message) {
    console.log('✏️ Fixed typos:', message, '->', correctedMessage);
  }

  if (!genAI) {
    console.log('🔄 Using contextual fallback');
    const response = getContextualFallback(correctedMessage);
    addToMemory(correctedMessage, response, 'contextual_fallback');
    return response;
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      generationConfig: {
        temperature: 0.95,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1200,
      }
    });
    
    const systemPrompt = createSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser Question: ${correctedMessage}\n\nRespond with perfect contextual understanding and human-level intelligence. If the question is ambiguous, ask for clarification. If it's specific, provide exact data. Be naturally conversational and build on our conversation history:`;
    
    console.log('🚀 Calling Gemini with ultra-smart prompt...');
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Ultra-intelligent response received:', text?.substring(0, 100) + '...');
    
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from AI');
    }
    
    addToMemory(correctedMessage, text.trim(), 'gemini_intelligent');
    return text.trim();
    
  } catch (error) {
    console.error('❌ AI service error:', error);
    console.log('🔄 Falling back to contextual response');
    
    const response = getContextualFallback(correctedMessage);
    addToMemory(correctedMessage, response, 'error_fallback');
    return response;
  }
};

export const generateCompanyInsights = (context: AIContext) => {
  const { employees, payments } = context;
  
  const totalPayroll = employees.reduce((sum, emp) => sum + emp.salary, 0);
  const avgSalary = employees.length > 0 ? totalPayroll / employees.length : 0;
  
  const departmentCounts: { [key: string]: number } = {};
  employees.forEach(emp => {
    departmentCounts[emp.department] = (departmentCounts[emp.department] || 0) + 1;
  });
  
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  
  return {
    totalEmployees: employees.length,
    totalPayroll,
    avgSalary,
    departmentCounts,
    totalPaid,
    completedPayments: completedPayments.length,
    pendingPayments: payments.filter(p => p.status === 'pending').length
  };
};

const generateCompanyAnalytics = (context: AIContext) => {
  const { employees, payments, companyName } = context;
  
  if (employees.length === 0) {
    return {
      totalEmployees: 0,
      totalPayroll: 0,
      avgSalary: 0,
      highestPaid: null,
      lowestPaid: null,
      newestEmployee: null,
      oldestEmployee: null,
      departmentBreakdown: {},
      salaryRange: { min: 0, max: 0 },
      payrollGrowth: 0,
      totalPaid: 0,
      lastPayment: null,
      companyDescription: `${companyName} is an innovative blockchain-based payroll company using Algorand technology for secure, fast, and transparent employee payments.`
    };
  }
  
  const totalPayroll = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
  const avgSalary = totalPayroll / employees.length;
  
  const sortedBySalary = [...employees].sort((a, b) => (b.salary || 0) - (a.salary || 0));
  const highestPaid = sortedBySalary[0];
  const lowestPaid = sortedBySalary[sortedBySalary.length - 1];
  
  // Department breakdown
  const departmentBreakdown: { [key: string]: { count: number, totalSalary: number, avgSalary: number } } = {};
  employees.forEach(emp => {
    const dept = emp.department || 'Unassigned';
    if (!departmentBreakdown[dept]) {
      departmentBreakdown[dept] = { count: 0, totalSalary: 0, avgSalary: 0 };
    }
    departmentBreakdown[dept].count++;
    departmentBreakdown[dept].totalSalary += emp.salary || 0;
    departmentBreakdown[dept].avgSalary = departmentBreakdown[dept].totalSalary / departmentBreakdown[dept].count;
  });
  
  // Salary range
  const salaryRange = {
    min: Math.min(...employees.map(emp => emp.salary || 0)),
    max: Math.max(...employees.map(emp => emp.salary || 0))
  };
  
  // Payment analytics
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
  
  // Sort by hire date (assuming created_at or hire_date field)
  const sortedByDate = [...employees].sort((a, b) => {
    const dateA = new Date(a.created_at || a.hire_date || '1970-01-01');
    const dateB = new Date(b.created_at || b.hire_date || '1970-01-01');
    return dateB.getTime() - dateA.getTime();
  });
  
  const newestEmployee = sortedByDate[0];
  const oldestEmployee = sortedByDate[sortedByDate.length - 1];
  
  return {
    totalEmployees: employees.length,
    totalPayroll,
    avgSalary,
    highestPaid,
    lowestPaid,
    newestEmployee,
    oldestEmployee,
    departmentBreakdown,
    salaryRange,
    totalPaid,
    lastPayment,
    completedPayments: completedPayments.length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    companyDescription: `${companyName} is an innovative blockchain-based payroll company using Algorand technology for secure, fast, and transparent employee payments. We leverage cutting-edge blockchain infrastructure to revolutionize how businesses handle payroll operations.`
  };
};

const handleCompanyIntelligence = (message: string, context: AIContext): string | null => {
  const analysis = analyzeMessage(message);
  const analytics = generateCompanyAnalytics(context);
  
  console.log('🏢 Company Intelligence Analysis:', { analysis, analytics });
  
  // Basic conversational responses
  if (/(thank you|thanks|thx|appreciate|great|awesome|perfect|excellent)/i.test(message) && message.length < 50) {
    const responses = [
      "You're welcome! Happy to help with your business intelligence needs. Anything else you'd like to know about your company or Algorand?",
      "Glad I could help! I'm here whenever you need insights about your employees, payroll, or crypto market data.",
      "My pleasure! Feel free to ask me anything about your business operations or Algorand blockchain.",
      "You're welcome! I'm always ready to dive into your company data or provide market analysis."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Simple greetings
  if (/(^hi$|^hello$|^hey$|good morning|good afternoon|good evening)/i.test(message.trim())) {
    return "Hello! I'm your smart AI assistant with deep knowledge about your company data, payroll operations, and Algorand blockchain technology. I can analyze your employee data, provide payment insights, explain blockchain concepts, and have natural conversations. What would you like to know?";
  }
  
  // Salary overview questions - catch various forms
  if (/overview.*(salary|salaries|pay|compensation)/i.test(message) || 
      /salary.*(overview|breakdown|summary)/i.test(message) ||
      /(salary|salaries).*(overview|breakdown|list)/i.test(message)) {
    
    const employeeList = context.employees
      .sort((a, b) => (b.salary || 0) - (a.salary || 0))
      .map((emp, index) => 
        `${index + 1}. **${emp.name}** - ${emp.designation} (${emp.department}) - $${emp.salary?.toLocaleString()}`
      )
      .join('\n');
    
    return `💰 **Salary Overview**

**Company Salary Stats:**
• Total Employees: ${analytics.totalEmployees}
• Total Monthly Payroll: $${analytics.totalPayroll.toLocaleString()}
• Average Salary: $${analytics.avgSalary.toLocaleString()}
• Salary Range: $${analytics.salaryRange.min.toLocaleString()} - $${analytics.salaryRange.max.toLocaleString()}
• Salary Spread: $${(analytics.salaryRange.max - analytics.salaryRange.min).toLocaleString()}

**Employee List (by salary):**
${employeeList}

**Department Salary Breakdown:**
${Object.entries(analytics.departmentBreakdown)
  .map(([dept, data]) => `• **${dept}**: ${data.count} employees, avg $${data.avgSalary.toLocaleString()}, total $${data.totalSalary.toLocaleString()}`)
  .join('\n')}

**Key Insights:**
• Highest earner makes ${((analytics.highestPaid?.salary || 0) / (analytics.lowestPaid?.salary || 1) * 100).toFixed(0)}% more than lowest earner
• ${Object.keys(analytics.departmentBreakdown).length} departments represented`;
  }
  
  // Company name questions
  if (analysis.topics.includes('name') || /what.*(company|business).*name/i.test(message)) {
    return `🏢 **Company Name:** ${context.companyName}

${analytics.companyDescription}

We currently have ${analytics.totalEmployees} employees and have processed ${analytics.completedPayments} successful payments using Algorand blockchain technology.`;
  }
  
  // What does the company do
  if (analysis.topics.includes('business_type') || /what.*(company|business).*(do|does)/i.test(message)) {
    return `# 🚀 What ${context.companyName} Does:

${analytics.companyDescription}

## Key Services:

- Blockchain-based payroll processing
- Algorand-powered employee payments
- Secure & transparent salary distribution
- Real-time payment tracking
- Crypto payroll solutions

## Current Operations:

- ${analytics.totalEmployees} active employees
- $${analytics.totalPayroll.toLocaleString()} total monthly payroll
- ${analytics.completedPayments} payments processed
- ${Object.keys(analytics.departmentBreakdown).length} departments`;
  }
  
  // Employee count
  if (analysis.topics.includes('count') && analysis.topics.includes('employees')) {
    return `👥 **Employee Count:** ${analytics.totalEmployees} employees

**Department Breakdown:**
${Object.entries(analytics.departmentBreakdown)
  .map(([dept, data]) => `• ${dept}: ${data.count} employees (avg salary: $${data.avgSalary.toLocaleString()})`)
  .join('\n')}

**Payroll Overview:**
• Total monthly payroll: $${analytics.totalPayroll.toLocaleString()}
• Average salary: $${analytics.avgSalary.toLocaleString()}`;
  }
  
  // Highest paid employee
  if (analysis.topics.includes('highest') && analysis.topics.includes('paid')) {
    if (!analytics.highestPaid) {
      return "I don't have information about employee salaries at the moment.";
    }
    
    return `# 💰 Highest Paid Employee: ${analytics.highestPaid.name}

## Position: ${analytics.highestPaid.designation}
## Department: ${analytics.highestPaid.department}
## Salary: $${analytics.highestPaid.salary?.toLocaleString()}
## Percentage of total payroll: ${((analytics.highestPaid.salary || 0) / analytics.totalPayroll * 100).toFixed(1)}%

This represents our top compensation tier, ${(((analytics.highestPaid.salary || 0) / analytics.avgSalary - 1) * 100).toFixed(0)}% above average salary.`;
  }
  
  // Lowest paid employee
  if ((analysis.topics.includes('lowest') && analysis.topics.includes('employees')) || 
      /lowest.*(paid|salary|employee)/i.test(message)) {
    if (!analytics.lowestPaid) {
      return "No employee data available yet.";
    }
    return `📊 **Lowest Paid Employee:** ${analytics.lowestPaid.name}

• **Position:** ${analytics.lowestPaid.designation}
• **Department:** ${analytics.lowestPaid.department}
• **Salary:** $${analytics.lowestPaid.salary?.toLocaleString()}
• **Percentage of total payroll:** ${((analytics.lowestPaid.salary / analytics.totalPayroll) * 100).toFixed(1)}%

This represents our entry-level compensation, ${((1 - analytics.lowestPaid.salary / analytics.avgSalary) * 100).toFixed(0)}% below average salary.`;
  }
  
  // Newest employee
  if (analysis.topics.includes('newest') && analysis.topics.includes('employees')) {
    if (!analytics.newestEmployee) {
      return "No employee data available yet.";
    }
    return `🆕 **Newest Employee:** ${analytics.newestEmployee.name}

• **Position:** ${analytics.newestEmployee.designation}
• **Department:** ${analytics.newestEmployee.department}
• **Salary:** $${analytics.newestEmployee.salary?.toLocaleString()}
• **Joined:** ${new Date(analytics.newestEmployee.created_at || analytics.newestEmployee.hire_date || '').toLocaleDateString()}

Welcome to our growing team! They're earning ${analytics.newestEmployee.salary > analytics.avgSalary ? 'above' : 'below'} average salary.`;
  }
  
  // Employee list/overview
  if ((analysis.topics.includes('overview') && analysis.topics.includes('employees')) || 
      /list.*(employee|staff)/i.test(message) ||
      /(employee|salary).*(breakdown|overview)/i.test(message)) {
    
    const employeeList = context.employees
      .sort((a, b) => (b.salary || 0) - (a.salary || 0))
      .map((emp, index) => 
        `${index + 1}. **${emp.name}** - ${emp.designation} (${emp.department}) - $${emp.salary?.toLocaleString()}`
      )
      .join('\n');
    
    return `👥 **Complete Employee Overview**

**Company Stats:**
• Total Employees: ${analytics.totalEmployees}
• Total Payroll: $${analytics.totalPayroll.toLocaleString()}/month
• Average Salary: $${analytics.avgSalary.toLocaleString()}
• Salary Range: $${analytics.salaryRange.min.toLocaleString()} - $${analytics.salaryRange.max.toLocaleString()}

**Employee List (by salary):**
${employeeList}

**Department Summary:**
${Object.entries(analytics.departmentBreakdown)
  .map(([dept, data]) => `• ${dept}: ${data.count} employees, $${data.totalSalary.toLocaleString()} total`)
  .join('\n')}`;
  }
  
  // Last payment info
  if (/last.*(payment|paid)/i.test(message) || analysis.topics.includes('payroll')) {
    if (!analytics.lastPayment) {
      return "No payments have been made yet.";
    }
    return `💳 **Last Payment Information:**

• **Amount:** $${analytics.lastPayment.amount?.toLocaleString()}
• **Employee:** ${analytics.lastPayment.employee_name || 'N/A'}
• **Date:** ${new Date(analytics.lastPayment.created_at || '').toLocaleDateString()}
• **Status:** ${analytics.lastPayment.status}
• **Transaction ID:** ${analytics.lastPayment.transaction_id || 'N/A'}

**Payment Summary:**
• Total Payments Completed: ${analytics.completedPayments}
• Total Amount Paid: $${analytics.totalPaid.toLocaleString()}
• Pending Payments: ${analytics.pendingPayments}`;
  }
  
  // Average salary
  if (analysis.topics.includes('average') && analysis.topics.includes('salary')) {
    return `📊 **Average Salary Analysis:**

• **Company Average:** $${analytics.avgSalary.toLocaleString()}
• **Salary Range:** $${analytics.salaryRange.min.toLocaleString()} - $${analytics.salaryRange.max.toLocaleString()}
• **Spread:** $${(analytics.salaryRange.max - analytics.salaryRange.min).toLocaleString()}

**Department Averages:**
${Object.entries(analytics.departmentBreakdown)
  .map(([dept, data]) => `• ${dept}: $${data.avgSalary.toLocaleString()} (${data.count} employees)`)
  .join('\n')}`;
  }
  
  return null;
}; 