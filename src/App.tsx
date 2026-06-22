/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import Fuse from 'fuse.js';
import Markdown from 'react-markdown';
import { 
  MessageSquare, 
  Copy, 
  Check, 
  Loader2, 
  Sparkles,
  ShoppingBag,
  Info,
  Save,
  FolderOpen,
  Trash2,
  Plus,
  X,
  Pencil,
  MessageCircle,
  Send,
  User,
  Bot,
  RefreshCw,
  Search,
  Filter,
  Tag,
  Image as ImageIcon,
  Download,
  Undo,
  Redo,
  Mail,
  Columns,
  Layout,
  Zap,
  Scale,
  TrendingUp,
  BookOpen,
  DollarSign,
  Calculator,
  HelpCircle,
  Globe,
  Percent,
  Star,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type Mode = 'home' | 'reply' | 'listing' | 'chat';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface ReplyInputs {
  message: string;
  customerName: string;
  customerEmail: string;
  orderId: string;
  marketplace: string;
  country: string;
  customCountry?: string;
  issueType: string;
  removalReason?: string;
  fulfillmentType?: 'FBA' | 'FBM' | 'Vendor Central';
  deliveryStatus?: string;
}

interface ListingInputs {
  productType: string;
  size: string;
  colour: string;
  fabric: string;
  vendorDepartment: string;
  features: string;
  customerReviews: string;
  marketplace: string;
  country: string;
  customCountry?: string;
  imagePrompt: string;
  keywords: string;
  category?: string;
  primaryKeyword?: string;
}

interface Template {
  id: string;
  name: string;
  content: string;
  issueType: string;
  tags: string[];
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'def-1',
    name: 'Damaged Item - Replacement',
    issueType: 'Damaged Item',
    tags: ['damaged', 'replacement', 'support'],
    content: "Dear [Customer Name],\n\nI am so sorry to hear that your order [Order ID] arrived damaged. This is certainly not the standard we strive for.\n\nI have arranged for a replacement to be sent out to you immediately via tracked delivery. You should receive a new tracking number shortly.\n\nThere is no need to return the damaged item. Please feel free to dispose of it safely.\n\nThank you for your patience.\n\nBest regards,\nMerchant Support Team"
  },
  {
    id: 'def-2',
    name: 'Delivery Delay - Courier Check',
    issueType: 'Delivery Delay',
    tags: ['delay', 'courier', 'shipping'],
    content: "Dear [Customer Name],\n\nThank you for getting in touch regarding your order [Order ID]. I can see that there has been a slight delay with the courier.\n\nI have contacted the delivery team to prioritise your parcel and will update you as soon as I have more information. Usually, these delays are resolved within 24-48 hours.\n\nWe appreciate your understanding.\n\nKind regards,\nMerchant Support Team"
  },
  {
    id: 'def-3',
    name: 'Wrong Item Received - Return & Resend',
    issueType: 'Wrong Item Received',
    tags: ['wrong-item', 'return', 'exchange'],
    content: "Dear [Customer Name],\n\nI am very sorry to hear that you received the wrong item for your order [Order ID]. We clearly made a mistake during the packing process.\n\nI have already dispatched the correct item to you today. Regarding the incorrect item you received, I have attached a pre-paid return label to this message. Please drop it off at your nearest post office at your convenience.\n\nApologies for the inconvenience caused.\n\nBest regards,\nMerchant Support Team"
  },
  {
    id: 'def-4',
    name: 'Return Request - Within 30 Days',
    issueType: 'Return Request',
    tags: ['return', 'refund', 'policy'],
    content: "Dear [Customer Name],\n\nThank you for your message. We are happy to accept returns within 30 days of purchase, provided the items are in their original packaging and unused condition.\n\nPlease send the item back to our warehouse at the following address:\n\nMerchantAI Returns Dept\nUnit 4, Industrial Way\nLondon, UK\n\nPlease include a note with your Order ID [Order ID] inside the package so we can process your refund quickly once it arrives.\n\nKind regards,\nMerchant Support Team"
  },
  {
    id: 'def-5',
    name: 'General Inquiry - Product Care',
    issueType: 'General Inquiry',
    tags: ['care', 'product-info', 'maintenance'],
    content: "Dear [Customer Name],\n\nThank you for your interest in our products!\n\nTo keep your products looking their best, we recommend washing at 40°C with a mild detergent. For any cotton products, tumble drying on a low heat is perfectly fine, but line drying will help maintain the fabric's crispness for longer.\n\nIf you have any other questions about our products, please don't hesitate to ask.\n\nBest regards,\nMerchant Support Team"
  }
];

const MARKETPLACE_STYLES: Record<string, { 
  primary: string, 
  secondary: string, 
  bg: string, 
  text: string,
  logo: string 
}> = {
  'Amazon Retail': {
    primary: '#FF9900', // Amazon Orange
    secondary: '#232F3E', // Amazon Dark
    bg: 'bg-[#FF9900]/5',
    text: 'text-[#232F3E]',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg'
  },
  'Amazon Vendor': {
    primary: '#00A8E1', // Amazon Blue (Vendor/Prime)
    secondary: '#232F3E',
    bg: 'bg-[#00A8E1]/5',
    text: 'text-[#232F3E]',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg'
  },
  'eBay': {
    primary: '#0064D2', // eBay Blue
    secondary: '#E53238', // eBay Red
    bg: 'bg-[#0064D2]/5',
    text: 'text-[#0064D2]',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg'
  },
  'Direct Website': {
    primary: '#5A5A40', // Brand Olive
    secondary: '#1a1a1a',
    bg: 'bg-[#5A5A40]/5',
    text: 'text-[#5A5A40]',
    logo: ''
  }
};

const MARKETPLACE_DEFAULTS: Record<string, {
  titleLimit: number,
  bulletLimit: number,
  descLimit: number,
  commonKeywords: string
}> = {
  'Amazon Retail': {
    titleLimit: 200,
    bulletLimit: 500,
    descLimit: 2000,
    commonKeywords: 'bedding, duvet cover, pillowcase, soft, luxury, cotton, bedroom decor'
  },
  'Amazon Vendor': {
    titleLimit: 200,
    bulletLimit: 500,
    descLimit: 2000,
    commonKeywords: 'bedding, duvet cover, pillowcase, soft, luxury, cotton, bedroom decor'
  },
  'eBay': {
    titleLimit: 80,
    bulletLimit: 1000,
    descLimit: 4000,
    commonKeywords: 'quilt cover, bed set, home textiles, clearance, brand new'
  },
  'Direct Website': {
    titleLimit: 150,
    bulletLimit: 800,
    descLimit: 5000,
    commonKeywords: 'merchantai, premium quality, top rated, best seller'
  }
};

const MARKETPLACE_TIPS: Record<string, string[]> = {
  'Amazon Retail': [
    'Use all 5 bullet points to highlight key benefits.',
    'Include relevant keywords in the title but keep it readable.',
    'Focus on "A+ Content" style descriptions for better conversion.',
    'Ensure your main image has a pure white background.'
  ],
  'Amazon Vendor': [
    'Vendor Central allows for more detailed A+ Content.',
    'Ensure your "Brand Story" is consistent across all listings.',
    'Monitor "Vine" reviews to build initial social proof.',
    'Use high-resolution images that meet Amazon Vendor requirements.'
  ],
  'eBay': [
    'Keep titles punchy and keyword-rich (max 80 chars).',
    'Use "Item Specifics" to help buyers find your products.',
    'Highlight fast, reliable delivery and top feedback indicators.',
    'Include multiple high-quality photos from different angles.'
  ],
  'Direct Website': [
    'Use storytelling to build an emotional connection with your brand.',
    'Optimize for mobile users with clear, concise headings.',
    'Include social proof like customer testimonials prominently.',
    'Use high-quality lifestyle imagery to showcase products in use.'
  ]
};

const getCountryString = (country: string, customCountry?: string) => {
  return country === 'Other...' ? (customCountry || 'International') : country;
};

// Original, substantial niche articles for e-commerce SEO and customer support
const NICHE_ARTICLES = [
  {
    id: 1,
    title: "How to Perfect Amazon & eBay Keyword Density for Maximum SEO Visibility",
    category: "SEO & Traffic Guide",
    readTime: "6 min read",
    date: "June 18, 2026",
    excerpt: "Learn how to optimize search rankings by carefully placing high-impact product keywords in your headers, titles, and bullet points without triggering search-engine penalties.",
    content: `### Introduction to Keyword Density in Modern E-Commerce

Search Engine Optimization (SEO) for platforms like Amazon and eBay depends on a balance between search visibility algorithms and human conversion metrics. A common mistake is **keyword stuffing**—repeating "Egyptian cotton queen bedding, luxury cotton bedsheets" endlessly in listings. Modern marketplace algorithms penalize this behavior, classifying it as search manipulation and decreasing your rank.

---

### Key Areas for Strategic Term Placement

To maximize coverage without degrading readability, allocate high-impact keywords according to this priority checklist:

1. **The Product Title (First 80 Characters)**
   Our analysis shows that terms in the initial 80 characters of your product title hold the highest SEO weight. Place your master search keyword here, separated cleanly by a pipe (|) or hyphen (-).
   *Example:* \`MerchantAI Premium Cotton Sheet Set - 4-Piece Breathable Queen Bedding\`
   
2. **The First Two Bullet Points (Above the Fold)**
   Most buyers do not read long descriptions. Focus your primary benefits and helper keywords in bullet points 1 and 2. Use uppercase start parameters for visual structure.
   
3. **Product Backend Search Terms**
   Never repeat keywords that are already in your visible listing. Use backend keywords for synonyms, common misspellings, and alternative regional terms (e.g., "duvet cover" vs. "quilt cover").

---

### Calculating Safe Keyword Density

To maintain a clean, high-ranking listing:
- **Master Phrase Density:** Limit primary focus phrases to **1.5% to 2%** of the total text volume.
- **Secondary Terms:** Limit synonyms to **0.5%** density.
- **Natural Language Flows:** Ensure each keyword fits naturally within an active-voice, customer-centric benefit sentence.

By leveraging **MerchantAI's Listing Generator**, the tool automatically handles target constraints and optimizes formatting limits safely for Amazon Retail, Amazon Vendor, eBay, and direct Shopify portals.`
  },
  {
    id: 2,
    title: "Empathy-First Customer Support: Resolving Disputes & Retaining Seller Rating",
    category: "Customer Success",
    readTime: "8 min read",
    date: "June 19, 2026",
    excerpt: "Disputes and damaged arrivals don't have to lead to negative reviews. Explore the cognitive psychology of customer recovery with copyable email templates.",
    content: `### The High Cost of Poor Customer Support

In the thin-margin world of e-commerce, retaining a customer is **5x cheaper** than acquiring a new one. More importantly, negative feedback on Amazon and eBay directly decreases your chances of winning the Buy Box. A single 1-star review can drop list-ranking conversions by up to **22%**.

---

### The Anatomy of an Empathetic Support Reply

When writing a dispute reply (whether for FBA transit damage or general complaints), structure your response using our **three-pillar recovery model**:

| Pillar | Focus Area | Objective |
| :--- | :--- | :--- |
| **1. Validation** | Direct, unreserved apology | Validate the customer's frustration immediately. Do not say "We apologize *if* you feel this way." |
| **2. Active Action** | Instant concrete resolution | State exactly what you are doing. Present tracking details for replacements or outline refund timelines. |
| **3. Trust Reinforcement** | Long-term warranty or goodwill | Offer an exclusive store coupon or friendly check-in to prove satisfaction is your absolute priority. |

---

### Localization: Spelling, Currency, and Regional Terms

If you cross-sell internationally, standardizing your tone is not enough. You must localize:
- **Language Nuance:** For the UK market, reference "Colour" and "Duvet Cover". For the US market, reference "Color" and "Comforter".
- **Currency Compliance:** Always list accurate regional currencies (£, $, €) and reference courier terms (e.g., "Royal Mail" for UK, "USPS/FedEx" for USA).

Using the **MerchantAI Customer Support Assistant**, you can dynamically tailor spelling rules and currencies based on fifteen target countries, guaranteeing seamless customer dispute communications every single time.`
  },
  {
    id: 3,
    title: "Mastering Competitor Auditing: Analyzing Listing Strengths & Conversion Rates",
    category: "Competitor Strategy",
    readTime: "5 min read",
    date: "June 15, 2026",
    excerpt: "Uncover how to dissect competitor product listings, extract high-converting search keywords, and find gap opportunities that drive organic traffic.",
    content: `### The Competitive Advantage of Listing Benchmarking

To survive on competitive marketplaces, you must understand your competitors better than they understand themselves. When standard listings stall in traffic, it is typically because a competitor has matched your key search terms and layered on a more persuasive brand story.

---

### Dissecting Competitor Performance Metrics

When auditing a competitor, score their listing across three critical vectors:

* **Keyword Coverage & Reach (SEO)**
  Are they indexing for terms you have completely left out? Check their titles and bullet structures for recurring material keywords.
  
* **Storytelling & Conversion (CRO)**
  Do they rely on generic laundry-list specifications, or do they establish an emotional, benefits-oriented connection with the buyer?
  
* **Clarity & Readability**
  Is their listing clean, formatted properly, and easy to skim on mobile screens?

---

### Strategic Gap Action Plan

1. **Pinch high-converting synonyms** from their positive customer review patterns.
2. **Address pain points** mentioned in their *negative* reviews directly in your own bullet points.
3. **Incorporate long-tail keywords** they have neglected due to rigid title limitations.

By pasting competitor titles and descriptions into **MerchantAI's Benchmark Grid**, you gain an instant AI-powered comparison, complete with overlapping keyword maps, comparative performance scoring, and strategic performance directives.`
  }
];

// Beautiful responsive AdSense placeholder layout for monetization layout
const AdSensePlaceholder = ({ size }: { size: 'billboard' | 'rectangle' | 'sidebar' | 'footer' }) => {
  const sizeClasses = {
    billboard: 'w-full max-w-7xl min-h-[90px] md:min-h-[110px] p-4 my-6',
    rectangle: 'w-full max-w-sm min-h-[250px] p-6 my-6 mx-auto',
    sidebar: 'w-full min-h-[300px] p-5 my-4',
    footer: 'fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-xl min-h-[60px] px-6 py-3 z-40 shadow-xl border-t border-black/10',
  };

  const labels = {
    billboard: '728x90 Billboard Banner • High-Performing Core Unit',
    rectangle: '300x250 Medium Rectangle • Contextual Grid Sponsor',
    sidebar: '300x600 Half-Page Companion • High CTR Inventory Match',
    footer: 'Mobile Anchor Banner • Non-Intrusive Dismissible Tray',
  };

  const [dismissed, setDismissed] = useState(false);

  if (dismissed && size === 'footer') return null;

  return (
    <div className={`bg-[#F9F8F3] border-2 border-dashed border-[#A39B81]/35 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300 hover:border-[#5A5A40]/50 hover:bg-[#F2F1EA] group ${size === 'footer' ? 'bg-white/95 backdrop-blur-md' : ''} ${sizeClasses[size]}`}>
      {size === 'footer' && (
        <button 
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="absolute top-2 right-2 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2 py-0.5 rounded"
        >
          [dismiss ad]
        </button>
      )}
      <span className="absolute top-1.5 right-3 text-[8px] font-mono uppercase tracking-[0.15em] text-[#8E9299]">Sponsored Placement</span>
      
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]/60 animate-pulse" />
        <span className="text-[9px] font-mono text-[#8E9299] tracking-wider uppercase font-semibold">{labels[size]}</span>
      </div>
      
      <p className="text-xs font-serif italic text-[#5A5A40] leading-relaxed max-w-2xl px-6">
        {size === 'billboard' && "Grow your merchant brand with custom inventory control & real-time VAT calculation modules. 30-Day Free Demo."}
        {size === 'rectangle' && "Amazon Tax compliance simplified. Instant multi-region reports & pre-vetted legal integrations in 1 click."}
        {size === 'sidebar' && "E-Commerce warehousing & bulk distribution solutions. Save 25% on shipping containers today."}
        {size === 'footer' && "Eco-friendly retail packaging supplies. Custom logo corrugated boxes from direct manufacturers."}
      </p>
      
      <div className="mt-2 text-[9px] font-mono uppercase tracking-widest text-[#5A5A40] underline decoration-[#5A5A40]/30 underline-offset-2 hover:decoration-[#5A5A40] cursor-pointer">
        AdSense Ads by Google
      </div>
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useState<Mode>('home');
  
  // Home Screen State Variables for SEO Content & Analytics
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [calcSearchVolume, setCalcSearchVolume] = useState<number>(12500);
  const [calcCTR, setCalcCTR] = useState<number>(4.2);
  const [calcConversion, setCalcConversion] = useState<number>(2.8);
  const [calcPrice, setCalcPrice] = useState<number>(29.99);
  const [showMockAds, setShowMockAds] = useState<boolean>(true);
  
  // Modal State Variables for Footer Nav / Static Links
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [showContact, setShowContact] = useState<boolean>(false);
  const [showPrivacy, setShowPrivacy] = useState<boolean>(false);
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const [embeddedToolTab, setEmbeddedToolTab] = useState<'reply' | 'listing' | 'chat'>('reply');
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('vhl_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch (e) {
        console.error("Failed to parse chat history", e);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('vhl_chat_history', JSON.stringify(chatMessages));
  }, [chatMessages]);

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const history = chatMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          ...history,
          { role: 'user', parts: [{ text: chatInput }] }
        ],
        config: {
          systemInstruction: "You are the MerchantAI Assistant. You help customer support agents and online sellers with product listings, customer communication, brand guidelines, and support queries. Your tone is professional, warm, helpful, polite, and reassuring. Use clear and persuasive language."
        }
      });

      const modelMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I'm sorry, I couldn't generate a response.",
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I encountered an error while processing your request. Please try again.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm("Are you sure you want to clear your chat history?")) {
      setChatMessages([]);
      localStorage.removeItem('vhl_chat_history');
    }
  };
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateModalView, setTemplateModalView] = useState<'list' | 'form'>('list');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState<Omit<Template, 'id'>>({
    name: '',
    content: '',
    issueType: '',
    tags: []
  });

  // Reply Mode State
  const [replyInputs, setReplyInputs] = useState<ReplyInputs>({
    message: '',
    customerName: '',
    customerEmail: '',
    orderId: '',
    marketplace: 'Amazon Retail',
    country: 'United Kingdom',
    customCountry: '',
    issueType: 'General Inquiry',
    removalReason: '',
    fulfillmentType: 'FBA',
    deliveryStatus: 'Shipped (In transit)'
  });
  const [suggestedReply, setSuggestedReply] = useState('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoRef = useRef(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [emailDraft, setEmailDraft] = useState({ to: '', subject: '', body: '' });

  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    if (suggestedReply !== history[historyIndex]) {
      const timer = setTimeout(() => {
        setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(suggestedReply);
          if (newHistory.length > 50) {
            newHistory.shift();
          }
          return newHistory;
        });
        setHistoryIndex(prev => {
          if (history.length >= 50 && prev === 49) return 49;
          return prev + 1;
        });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [suggestedReply]);

  const undo = () => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const prevValue = history[historyIndex - 1];
      setSuggestedReply(prevValue);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextValue = history[historyIndex + 1];
      setSuggestedReply(nextValue);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Listing Mode State
  const [userMarketplaceDefaults, setUserMarketplaceDefaults] = useState<Record<string, { vendorDepartment: string, features: string, keywords: string }>>(() => {
    const saved = localStorage.getItem('vhl_listing_defaults');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('vhl_listing_defaults', JSON.stringify(userMarketplaceDefaults));
  }, [userMarketplaceDefaults]);

  const saveCurrentAsDefault = () => {
    setUserMarketplaceDefaults(prev => ({
      ...prev,
      [listingInputs.marketplace]: {
        vendorDepartment: listingInputs.vendorDepartment,
        features: listingInputs.features,
        keywords: listingInputs.keywords
      }
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [listingInputs, setListingInputs] = useState<ListingInputs>({
    productType: '',
    size: '',
    colour: '',
    fabric: '',
    vendorDepartment: userMarketplaceDefaults['Amazon Retail']?.vendorDepartment || '',
    features: userMarketplaceDefaults['Amazon Retail']?.features || '',
    customerReviews: '',
    marketplace: 'Amazon Retail',
    country: 'United Kingdom',
    customCountry: '',
    imagePrompt: '',
    keywords: userMarketplaceDefaults['Amazon Retail']?.keywords || MARKETPLACE_DEFAULTS['Amazon Retail'].commonKeywords,
    category: 'Electronics & Tech Accessories',
    primaryKeyword: ''
  });
  const [listingErrors, setListingErrors] = useState<Partial<Record<keyof ListingInputs, string>>>({});
  const [listingOutput, setListingOutput] = useState<{
    title: string;
    bullets: string[];
    shortDesc: string;
    longDesc: string;
    reviewSummary: string;
    keywords: string[];
    suggestedImagePrompt?: string;
    generatedImage?: string;
  } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [savedListings, setSavedListings] = useState<(typeof listingOutput & { id: string; timestamp: number })[]>(() => {
    const saved = localStorage.getItem('vhl_saved_listings');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('vhl_saved_listings', JSON.stringify(savedListings));
  }, [savedListings]);

  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [listingAnalysis, setListingAnalysis] = useState<{
    seoImprovements: string;
    reviewIntegration: string;
    suggestedKeywords: string[];
  } | null>(null);
  const [isAnalyzingListing, setIsAnalyzingListing] = useState(false);

  const [competitorTitle, setCompetitorTitle] = useState('');
  const [competitorDesc, setCompetitorDesc] = useState('');
  const [competitorAnalysis, setCompetitorAnalysis] = useState<{
    keywordComparison?: {
      matched: string[];
      onlyOurs: string[];
      onlyCompetitor: string[];
      missedHighValue: string[];
    };
    toneAndStyle?: {
      oursTone: string;
      competitorTone: string;
      comparisonSummary: string;
      ourScores?: { seo: number; conversion: number; clarity: number };
      competitorScores?: { seo: number; conversion: number; clarity: number };
    };
    strategicSuggestions?: string[];
  } | null>(null);
  const [isAnalyzingCompetitor, setIsAnalyzingCompetitor] = useState(false);

  const allIssueTypes = useMemo(() => {
    const types = new Set(templates.map(t => t.issueType));
    return Array.from(types).filter(Boolean).sort();
  }, [templates]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    templates.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let result = templates;

    // 1. Filter by Issue Types (Multi-select)
    if (selectedIssueTypes.length > 0) {
      result = result.filter(t => selectedIssueTypes.includes(t.issueType));
    }

    // 2. Filter by Tags (Multi-select)
    if (selectedTags.length > 0) {
      result = result.filter(t => t.tags?.some(tag => selectedTags.includes(tag)));
    }

    // 3. Apply Fuzzy Search
    if (templateSearch.trim()) {
      const fuse = new Fuse(result, {
        keys: [
          { name: 'name', weight: 0.8 },
          { name: 'issueType', weight: 0.5 },
          { name: 'tags', weight: 0.5 },
          { name: 'content', weight: 0.3 }
        ],
        threshold: 0.3, // More precise
        distance: 100,
        ignoreLocation: true,
        minMatchCharLength: 2,
        findAllMatches: true
      });
      result = fuse.search(templateSearch).map(r => r.item);
    }

    return result;
  }, [templates, templateSearch, selectedIssueTypes, selectedTags]);

  // Helper to highlight search terms
  const highlightText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    
    // Simple regex highlighting (for exact matches within fuzzy results)
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <mark key={i} className="bg-[#FF9900]/30 text-inherit rounded-sm px-0.5">{part}</mark> 
            : part
        )}
      </span>
    );
  };

  // Load templates on mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('vhl_templates');
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    } else {
      setTemplates(DEFAULT_TEMPLATES);
    }
  }, []);

  // Save templates whenever they change
  useEffect(() => {
    if (templates.length > 0) {
      localStorage.setItem('vhl_templates', JSON.stringify(templates));
    }
  }, [templates]);

  const restoreDefaultTemplates = () => {
    if (confirm("This will replace all your current templates with the default ones. Are you sure?")) {
      setTemplates(DEFAULT_TEMPLATES);
      localStorage.setItem('vhl_templates', JSON.stringify(DEFAULT_TEMPLATES));
    }
  };

  const deleteSelectedListings = () => {
    setSavedListings(prev => prev.filter(l => !selectedListingIds.includes(l.id)));
    setSelectedListingIds([]);
  };

  useEffect(() => {
    if (showComparison && selectedListingIds.length === 0) {
      setShowComparison(false);
    }
  }, [selectedListingIds, showComparison]);

  const toggleSelectAll = () => {
    if (selectedListingIds.length === savedListings.length) {
      setSelectedListingIds([]);
    } else {
      setSelectedListingIds(savedListings.map(l => l.id));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveAsTemplate = () => {
    if (!suggestedReply) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newTemplate: Template = {
      id: Date.now().toString(),
      name: `${replyInputs.issueType} Template (${timestamp})`,
      content: suggestedReply,
      issueType: replyInputs.issueType,
      tags: [replyInputs.issueType.toLowerCase().replace(/\s+/g, '-')]
    };
    
    setTemplates(prev => [...prev, newTemplate]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this template?")) {
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  const resetReplyForm = () => {
    setReplyInputs({
      message: '',
      customerName: '',
      customerEmail: '',
      orderId: '',
      marketplace: 'Amazon Retail',
      country: 'United Kingdom',
      customCountry: '',
      issueType: 'General Inquiry',
      removalReason: ''
    });
    setSuggestedReply('');
    setHistory(['']);
    setHistoryIndex(0);
  };

  const resetListingForm = () => {
    const userDefaults = userMarketplaceDefaults['Amazon Retail'];
    setListingInputs({
      productType: '',
      size: '',
      colour: '',
      fabric: '',
      vendorDepartment: userDefaults?.vendorDepartment || '',
      features: userDefaults?.features || '',
      customerReviews: '',
      marketplace: 'Amazon Retail',
      country: 'United Kingdom',
      customCountry: '',
      imagePrompt: '',
      keywords: userDefaults?.keywords || MARKETPLACE_DEFAULTS['Amazon Retail'].commonKeywords
    });
    setListingOutput(null);
    setSavedListings([]);
    setSelectedListingIds([]);
    setListingErrors({});
    setCompetitorTitle('');
    setCompetitorDesc('');
    setCompetitorAnalysis(null);
  };

  const createNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      content: '',
      issueType: 'General Inquiry',
      tags: []
    });
    setTemplateModalView('form');
  };

  const startEditing = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      content: template.content,
      issueType: template.issueType,
      tags: template.tags || []
    });
    setTemplateModalView('form');
  };

  const saveTemplate = () => {
    if (!templateForm.name || !templateForm.content) {
      alert("Please fill in both name and content.");
      return;
    }

    if (editingTemplate) {
      // Update existing
      setTemplates(templates.map(t => 
        t.id === editingTemplate.id 
          ? { ...t, ...templateForm } 
          : t
      ));
    } else {
      // Create new
      const newTemplate: Template = {
        id: Date.now().toString(),
        ...templateForm
      };
      setTemplates([...templates, newTemplate]);
    }
    
    setEditingTemplate(null);
    // Reset form
    setTemplateForm({ name: '', content: '', issueType: '', tags: [] });
    setTemplateModalView('list');
  };

  const loadTemplate = (template: Template) => {
    let content = template.content;
    // Simple placeholder replacement
    if (replyInputs.customerName) content = content.replace(/\[Customer Name\]/g, replyInputs.customerName);
    if (replyInputs.customerEmail) content = content.replace(/\[Customer Email\]/g, replyInputs.customerEmail);
    if (replyInputs.orderId) content = content.replace(/\[Order ID\]/g, replyInputs.orderId);
    
    setSuggestedReply(content);
    setShowTemplates(false);
  };

  const generateReply = async () => {
    if (!replyInputs.message) return;
    setLoading(true);
    try {
      const model = (replyInputs.issueType.includes('Appeal') || replyInputs.issueType.includes('Support')) 
        ? "gemini-3.1-pro-preview" 
        : "gemini-3-flash-preview";

      const replyCountry = getCountryString(replyInputs.country, replyInputs.customCountry);

      const prompt = `
        System: You are a helpful and empathetic customer support assistant for "MerchantAI", a professional e-commerce merchant. 
        
        Brand Voice & Localization Guidelines:
        - Target Country/Region: ${replyCountry}
        - Tone: Warm, trustworthy, polite, and reassuring.
        - Style: Extremely helpful, polite, professional, and fully localized.
        - Language: Professional spelling and language style adjusted natively to ${replyCountry} (e.g., use US English/spelling for USA, British English/spelling for UK, German translation for Germany, French translation for France, etc. Translate the message into the local language of ${replyCountry} if it is non-English, unless the client message is in English).
        - Currency: Use appropriate regional currency symbols (e.g., $ for USA/Canada, £ for UK, € for Germany/France/Europe, $ or A$ for Australia, etc.).
        - Goal: Build trust while showing genuine service orientation and warmth. Focus on resolving issues smoothly and retaining clients.
        
        Context:
        - Customer Message / Feedback: "${replyInputs.message}"
        - Customer Name: ${replyInputs.customerName || 'Customer'}
        - Customer Email: ${replyInputs.customerEmail || 'Not provided'}
        - Order ID: ${replyInputs.orderId || 'Not provided'}
        - Marketplace: ${replyInputs.marketplace}
        - Target Country: ${replyCountry}
        - Fulfillment Type: ${replyInputs.fulfillmentType || 'Not specified'}
        - Issue Type: ${replyInputs.issueType}
        ${(replyInputs.issueType.includes('Appeal') || replyInputs.issueType.includes('Support')) ? `
        System Instruction Override: This is a formal request/appeal to Amazon Support. 
        Instead of a reply to the customer, generate a professional, evidence-based message to Amazon Seller/Vendor Support.
        - Tone: Professional, concise, and firm.
        - Goal: Persuade the Amazon Support agent to remove the feedback by clearly demonstrating a policy violation.
        - Cite the specific details/reason: ${replyInputs.removalReason || 'Not specified'}.
        - Reference the Order ID (if applicable): ${replyInputs.orderId || 'Not provided'}.
        - Context: This is an ${replyInputs.fulfillmentType} order on ${replyInputs.marketplace}. 
        - IMPORTANT: Explicitly quote the buyer's feedback/message: "${replyInputs.message}".
        
        Structure your message as follows:
        1. State the purpose of the appeal clearly (e.g., "Request for removal of negative feedback for Order ID: ${replyInputs.orderId}").
        2. Reference the specific Amazon policy that has been violated.
        3. Quote the buyer's feedback as evidence.
        4. Provide a logical and persuasive argument for why the quoted feedback violates the policy.
        5. Formally request the removal of the feedback.

        ${replyInputs.issueType === 'Amazon - Negative Feedback Appeal (FBA/Vendor Delivery)' ? `
        - Specific Focus: This is an appeal for feedback removal based on fulfillment/delivery issues.
        - Reference Policy: According to Amazon policy (Fulfillment by Amazon), "Amazon will remove feedback when the feedback is 100% regarding fulfillment or customer service for an order fulfilled by Amazon (FBA)."
        - Argument: Persuasively argue that the quoted feedback "${replyInputs.message}" is entirely about the delivery experience (e.g., late delivery, damaged in transit, carrier issues), which was handled by Amazon, not the seller.
        - Persuasion Tactic: Emphasize that the seller had no control over the logistics and that the feedback negatively impacts the seller's performance metrics unfairly for an Amazon-managed service.
        ` : ''}
        
        ${replyInputs.issueType === 'Amazon - Negative Feedback Appeal (Product Review)' ? `
        - Specific Focus: This is an appeal for feedback removal because it is a product review.
        - Reference Policy: Amazon's feedback removal policy states: "Amazon will remove feedback when the entire feedback is a product review."
        - Argument: Persuasively argue that the quoted feedback "${replyInputs.message}" focuses solely on the product's attributes, quality, or performance (e.g., "the fabric is thin", "the color is different") rather than the seller's service or shipping.
        - Persuasion Tactic: Point out that the feedback does not mention anything about the seller's communication, shipping speed, or packaging, making it a 100% product review.
        ` : ''}
        
        ${replyInputs.issueType === 'Amazon - Negative Feedback Appeal (Other Policy)' ? `
        - Specific Focus: This is an appeal for feedback removal based on other policy violations (e.g., profanity, PII, promotional content).
        - Reference Policy: Reference the relevant Amazon policy (e.g., use of obscene language, inclusion of personal information like phone numbers or emails, or promotional links).
        - Argument: Explain clearly and firmly how the quoted feedback "${replyInputs.message}" violates these specific Amazon policies.
        - Persuasion Tactic: Highlight the specific words or information that violate the policy and explain why they are prohibited (e.g., "The feedback contains personal contact information, which is a direct violation of Amazon's privacy policy").
        ` : ''}

        - If it's a Policy Violation Appeal: Explain the corrective actions taken and why the violation should be removed.
        - If it's a Listing/Account Issue: Clearly state the problem and the desired resolution.
        ` : ''}
        ${(replyInputs.issueType.includes('Buyer Message')) ? `
        System Instruction Override: This is a message to the Buyer regarding negative feedback.
        - Be extremely polite, empathetic, and professional.
        - Do NOT explicitly ask for feedback removal (Amazon policy). Instead, offer a full resolution (refund/replacement) to ensure they are happy.
        - Once the issue is resolved, mention that we value their feedback and hope they might reconsider their rating if they are satisfied with our service.
        ` : ''}
        
        Guidelines:
        - Acknowledge the issue with genuine empathy.
        - Use the Customer Name or Email to personalize the greeting if available.
        - Explain next steps clearly (e.g., refund, replacement, asking for photos).
        - Keep it concise but radiate warmth.
        - Use a professional yet approachable sign-off suitable for ${replyInputs.marketplace}.
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      setSuggestedReply(response.text || '');
    } catch (error) {
      console.error("Error generating reply:", error);
      setSuggestedReply("Sorry, I encountered an error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const modifyReply = async (action: 'salutation' | 'closing' | 'shorter' | 'formal') => {
    if (!suggestedReply) return;
    
    if (action === 'salutation') {
      let salutation = "Dear Customer,\n\n";
      if (replyInputs.customerName) {
        salutation = `Dear ${replyInputs.customerName},\n\n`;
      } else if (replyInputs.customerEmail) {
        salutation = `Dear ${replyInputs.customerEmail},\n\n`;
      }
      
      if (!suggestedReply.toLowerCase().startsWith('dear') && !suggestedReply.toLowerCase().startsWith('hi')) {
        setSuggestedReply(salutation + suggestedReply);
      }
      return;
    }
    
    if (action === 'closing') {
      const closing = "\n\nKind regards,\nMerchant Support Team";
      if (!suggestedReply.toLowerCase().includes('kind regards') && !suggestedReply.toLowerCase().includes('best regards') && !suggestedReply.toLowerCase().includes('yours sincerely')) {
        setSuggestedReply(suggestedReply + closing);
      }
      return;
    }

    setLoading(true);
    try {
      const prompt = `
        System: You are a brand-aligned customer service assistant for "MerchantAI".
        Modify the following customer service reply based on the instruction: "${action === 'shorter' ? 'Make it shorter and more concise while keeping the warmth/professionalism' : 'Make it more formal and professional while remaining approachable and friendly'}".
        Maintain our signature high-quality customer service standard.
        
        Original Reply:
        ${suggestedReply}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setSuggestedReply(response.text || suggestedReply);
    } catch (error) {
      console.error(`Error modifying reply (${action}):`, error);
    } finally {
      setLoading(false);
    }
  };

  const generateProductImage = async () => {
    if (!listingInputs.imagePrompt) return;
    setIsGeneratingImage(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `High-quality professional product photography. ${listingInputs.imagePrompt}. The style should be clean, modern, and inviting, featuring soft lighting and an elegant background.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${base64EncodeString}`;
          setListingOutput(prev => prev ? { ...prev, generatedImage: imageUrl } : null);
          break;
        }
      }
    } catch (error) {
      console.error("Error generating product image:", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const generateListing = async () => {
    // Validate inputs
    const errors: Partial<Record<keyof ListingInputs, string>> = {};
    if (!listingInputs.productType.trim()) errors.productType = 'Product type is required';
    if (!listingInputs.size.trim()) errors.size = 'Size is required';
    if (!listingInputs.colour.trim()) errors.colour = 'Colour/Pattern is required';
    if (!listingInputs.fabric.trim()) errors.fabric = 'Fabric/Material is required';
    if (!listingInputs.vendorDepartment.trim()) errors.vendorDepartment = 'Vendor department is required';

    setListingErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const listingCountry = getCountryString(listingInputs.country, listingInputs.customCountry);

      const prompt = `
        System: You are the lead brand storyteller for "MerchantAI", assisting merchants to construct exceptional, high-converting product listings that attract shoppers and boost search rankings. 
        
        Brand Voice & Localization Guidelines:
        - Target Country/Region: ${listingCountry}
        - Tone: Warm, professional, trustworthy, and descriptive.
        - Core Focus: Exceptional quality description, showcasing clear product benefits, value proposition, and user experience.
        - Style: Clear, persuasive, and custom tailored to the chosen marketplace: ${listingInputs.marketplace} in ${listingCountry}.
        - Language & Spelling: Use spellings, terms, and conventions appropriate for ${listingCountry} (e.g., use US English/spelling for USA, British English/spelling for UK, translate all fields into German if country is Germany, into French if country is France, etc. matching local marketplace expectations).
        - Currency: Ensure any reference to pricing or monetary values uses local e-commerce units / symbols native to ${listingCountry}.
        - Emotional Hook: Connect with the reader's needs, visualizing the comfort, reliability, and utility they gain from owning this specific item.
        - Language: Use engaging, sensory, and clear descriptors suited physically or functionally to the product. Avoid overly generic filler or hyper-aggressive sales pitches.
        
        Product Details:
        - Marketplace: ${listingInputs.marketplace}
        - Target Country: ${listingCountry}
        - Vendor Department: ${listingInputs.vendorDepartment}
        - Type: ${listingInputs.productType}
        - Size: ${listingInputs.size}
        - Colour/Pattern: ${listingInputs.colour}
        - Fabric/Material: ${listingInputs.fabric}
        - Key Features: ${listingInputs.features}
        - Customer Reviews: ${listingInputs.customerReviews}
        - Target Keywords: ${listingInputs.keywords}
        
        Marketplace Constraints:
        - Title Limit: ${MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.titleLimit || 200} characters
        - Bullet Limit: ${MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.bulletLimit || 500} characters per bullet
        - Description Limit: ${MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.descLimit || 2000} characters
        
        Output Format (JSON):
        {
          "title": "A warm, inviting, and SEO-friendly title that highlights the main comfort benefit (obey character limit)",
          "bullets": [
            "5 benefit-driven bullet points. Each should start with a warm, emotive benefit followed by the technical spec. Focus on how it improves sleep quality. Obey character limit."
          ],
          "shortDesc": "A brief, punchy summary that captures the 'simple joy' of this specific product.",
          "longDesc": "A detailed, storytelling-style product description. Use paragraphs to paint a picture of comfort and quality. Mention the value and durability to build trust.",
          "reviewSummary": "A heartwarming summary of what customers love, written in a friendly, community-focused tone that reinforces trust.",
          "keywords": ["10-15 relevant SEO keywords/tags for Amazon and eBay search optimization"],
          "suggestedImagePrompt": "A descriptive prompt for an AI image generator to create a professional product photo that matches the brand's cosy and warm aesthetic."
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      // The GenAI SDK may return the JSON in different shapes (response.text or nested candidates).
      // Attempt several strategies to extract a JSON string, then parse safely.
      let raw: any = response?.text;
      if (!raw) {
        const cand = response?.candidates?.[0]?.content;
        if (cand?.parts && Array.isArray(cand.parts)) {
          raw = cand.parts.map((p: any) => p.text || '').join('');
        } else if (cand?.text) {
          raw = cand.text;
        }
      }
      if (!raw) raw = JSON.stringify(response || {});

      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        // Try to extract a JSON object substring if the model prepended/appended extra text
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            data = JSON.parse(raw.slice(start, end + 1));
          } catch (err2) {
            console.error('Failed to parse JSON from AI response substring', err2);
          }
        } else {
          console.error('Failed to parse JSON from AI response', err);
        }
      }

      if (data) {
        setListingOutput(data);
        if (data.suggestedImagePrompt && !listingInputs.imagePrompt) {
          setListingInputs(prev => ({ ...prev, imagePrompt: data.suggestedImagePrompt }));
        }
      } else {
        console.error('Listing generation returned unparsable response:', raw);
      }
    } catch (error) {
      console.error("Error generating listing:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeListingSEO = async () => {
    if (!listingOutput) return;
    setIsAnalyzingListing(true);
    try {
      const listingCountry = getCountryString(listingInputs.country, listingInputs.customCountry);

      const prompt = `
        System: You are an expert e-commerce SEO Specialist and Conversion Rate Optimization (CRO) consultant.
        
        Task: Analyze the following product listing and customer reviews to suggest improvements for search visibility and conversion, specifically optimized for the target platform: ${listingInputs.marketplace} in ${listingCountry}.
        
        Product Listing Details:
        - Target Marketplace: ${listingInputs.marketplace}
        - Target Country: ${listingCountry}
        - Title: ${listingOutput.title}
        - Bullets: ${listingOutput.bullets.join('\n')}
        - Description: ${listingOutput.longDesc}
        - Current Keywords: ${listingOutput.keywords.join(', ')}
        
        Customer Reviews:
        ${listingInputs.customerReviews || 'No reviews provided.'}
        
        Analysis Requirements:
        1. SEO Analysis: Identify missing platform-specific high-volume keywords for ${listingCountry} and suggest where to incorporate them (Title, Bullets, or Description). Analyze keyword density and suggest optimizations suitable to localized search behavior.
        2. Review Integration: Analyze customer feedback. Identify positive themes, specific phrases, or common questions addressed in reviews. Suggest how to weave these into the listing to build trust and address objections. Ensure suggestions match spellings/conventions for ${listingCountry}.
        3. Suggested Keywords: Provide a list of 10-15 additional high-impact keywords suitable for e-commerce search in ${listingCountry}.
        
        Output Format (JSON):
        {
          "seoImprovements": "Detailed SEO analysis and specific placement suggestions.",
          "reviewIntegration": "Analysis of reviews and specific suggestions for incorporating feedback.",
          "suggestedKeywords": ["keyword1", "keyword2", ...]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setListingAnalysis(data);
    } catch (error) {
      console.error("Error analyzing listing:", error);
    } finally {
      setIsAnalyzingListing(false);
    }
  };

  const analyzeCompetitor = async () => {
    if (!listingOutput) return;
    setIsAnalyzingCompetitor(true);
    try {
      const listingCountry = getCountryString(listingInputs.country, listingInputs.customCountry);
      const prompt = `
        System: You are an elite e-commerce listing optimizer and CRO competitor analyst. Your job is to perform a detailed comparison between our generated product listing and a competitor's pasted listing details (title and description/bullets), specifically for ${listingInputs.marketplace} in ${listingCountry}.
        
        Our Generated Listing:
        - Title: ${listingOutput.title}
        - Bullets: ${listingOutput.bullets.join('\n')}
        - Description: ${listingOutput.longDesc}
        - Our Keywords: ${listingOutput.keywords.join(', ')}
        
        Competitor's Listing Details:
        - Title: ${competitorTitle || 'Not provided'}
        - Description/Bullets: ${competitorDesc || 'Not provided'}
        
        Task:
        1. Keyword Comparison: Compare the keywords and phrases utilized. Identify:
           - "matched": High-impact e-commerce keywords present in both listings. Keep it to 5-10 items.
           - "onlyOurs": Strong keywords present strictly in our listing. Keep it to 5-10 items.
           - "onlyCompetitor": Strong keywords present strictly in the competitor's listing that we might have missed of high-relevance. Keep it to 5-10 items.
           - "missedHighValue": Additional high-impact search keywords neither has, but would give us a massive SEO boost in ${listingCountry}. Keep it to 5-10 items.
        2. Tone & Style Comparison: Match the psychological hook, readability, and brand voice. Assess both listings across 3 key metrics from 0 to 100: SEO, Conversion Rate Power, and Clarity. Deliver the specific tones used in both e-commerce listings.
        3. Strategic Suggestions: Provide 3-5 concrete, actionable bullet points explaining exactly how to adjust or refine our listing to outperform this competitor (e.g., highlighting specific guarantees, addressing customer pain points better, or restructuring bullets).
        
        Output Format MUST be strict JSON as defined below, no extra text:
        {
          "keywordComparison": {
            "matched": ["keyword1", "keyword2", ...],
            "onlyOurs": ["keyword1", "keyword2", ...],
            "onlyCompetitor": ["keyword1", "keyword2", ...],
            "missedHighValue": ["keyword1", "keyword2", ...]
          },
          "toneAndStyle": {
            "oursTone": "Concise summary of our listing's voice/tone",
            "competitorTone": "Concise summary of competitor's voice/tone",
            "comparisonSummary": "Overview/analysis comparing both approaches, emphasizing competitive advantages.",
            "ourScores": { "seo": 85, "conversion": 90, "clarity": 88 },
            "competitorScores": { "seo": 75, "conversion": 80, "clarity": 82 }
          },
          "strategicSuggestions": [
            "Actionable improvement point 1",
            "Actionable improvement point 2",
            ...
          ]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setCompetitorAnalysis(data);
    } catch (error) {
      console.error("Error analyzing competitor:", error);
    } finally {
      setIsAnalyzingCompetitor(false);
    }
  };

  const saveListingForComparison = () => {
    if (!listingOutput) return;
    const newListing = {
      ...listingOutput,
      id: Date.now().toString(),
      timestamp: Date.now()
    };
    setSavedListings(prev => [newListing, ...prev]);
    // Automatically select it
    setSelectedListingIds(prev => [...prev, newListing.id]);
  };

  const handleMarketplaceChange = (m: string) => {
    const isCurrentKeywordsDefault = Object.values(MARKETPLACE_DEFAULTS).some(d => d.commonKeywords === listingInputs.keywords);
    const userDefaults = userMarketplaceDefaults[m];

    setListingInputs(prev => ({
      ...prev,
      marketplace: m,
      vendorDepartment: userDefaults?.vendorDepartment || '',
      features: userDefaults?.features || '',
      keywords: userDefaults?.keywords || ((!prev.keywords || isCurrentKeywordsDefault) ? MARKETPLACE_DEFAULTS[m]?.commonKeywords || '' : prev.keywords)
    }));
  };

  const generateEmailDraft = async () => {
    if (!suggestedReply) return;
    
    setLoading(true);
    try {
      const replyCountry = getCountryString(replyInputs.country, replyInputs.customCountry);

      const prompt = `
        Generate a professional, warm, and highly persuasive email subject line for a customer support reply from a store assistant at "MerchantAI".
        Context:
        - Target Country: ${replyCountry}
        - Issue: ${replyInputs.issueType}
        - Order ID: ${replyInputs.orderId || 'N/A'}
        - Customer Name: ${replyInputs.customerName || 'Customer'}
        - Marketplace: ${replyInputs.marketplace}
        - Message Snippet: "${replyInputs.message.substring(0, 100)}..."
        
        Guidelines:
        - Keep it concise (under 60 characters).
        - Include the Order ID if provided.
        - Style and language should adapt to ${replyCountry} expectations or language.
        - Tone: Warm and helpful.
        
        Return ONLY the subject line text.
      `;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      const subject = response.text?.trim() || `Re: ${replyInputs.issueType} - Order ${replyInputs.orderId || 'Inquiry'}`;
      
      setEmailDraft({
        to: replyInputs.customerEmail || '',
        subject: subject,
        body: suggestedReply
      });
      setShowEmailDraft(true);
    } catch (e) {
      console.error("Failed to generate email draft", e);
      // Fallback
      setEmailDraft({
        to: replyInputs.customerEmail || '',
        subject: `Re: ${replyInputs.issueType} - Order ${replyInputs.orderId || 'Inquiry'}`,
        body: suggestedReply
      });
      setShowEmailDraft(true);
    } finally {
      setLoading(false);
    }
  };

  const currentMarketplace = mode === 'reply' ? replyInputs.marketplace : listingInputs.marketplace;
  const activeStyle = MARKETPLACE_STYLES[currentMarketplace] || MARKETPLACE_STYLES['Direct Website'];

  return (
    <div className="min-h-screen font-sans bg-[#f5f5f0] text-[#1a1a1a] transition-all duration-500 flex flex-col justify-between">
      {/* Real-time Sticky Navigation Header */}
      <nav className="bg-white border-b border-black/5 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Brand Logo and Identity */}
            <div className="flex items-center gap-3 cursor-pointer select-none group" onClick={() => setMode('home')}>
              <div className="bg-[#5A5A40] text-white p-2.5 rounded-2xl shadow-md group-hover:scale-105 transition-transform">
                <Sparkles size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-serif text-2xl font-bold tracking-tight text-[#5A5A40]">MerchantAI</span>
                  <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded-full font-mono font-bold tracking-wide">v1.4</span>
                </div>
                <span className="text-[9px] uppercase tracking-[0.22em] block font-mono text-[#8E9299] font-bold -mt-0.5">Customer Support & Seller Hub</span>
              </div>
            </div>

            {/* Main Interactive Links */}
            <div className="hidden lg:flex items-center gap-5">
              <button 
                onClick={() => { setMode('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                className={`text-xs uppercase font-extrabold tracking-widest transition-all pb-1 hover:text-[#5A5A40] ${mode === 'home' ? 'text-[#5A5A40] border-b-2 border-[#5A5A40]' : 'text-[#8E9299]'}`}
              >
                Home
              </button>
              <button 
                onClick={() => {
                  setMode('home');
                  setTimeout(() => {
                    document.getElementById('merchant-tools')?.scrollIntoView({ behavior: 'smooth' });
                  }, 120);
                }} 
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1"
              >
                Tool
              </button>
              <a 
                href="#original-articles" 
                onClick={(e) => {
                  setMode('home');
                  setTimeout(() => {
                    document.getElementById('original-articles')?.scrollIntoView({ behavior: 'smooth' });
                  }, 120);
                }}
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1"
              >
                Guides
              </a>
              <a 
                href="#faqs-hub" 
                onClick={(e) => {
                  setMode('home');
                  setTimeout(() => {
                    document.getElementById('faqs-hub')?.scrollIntoView({ behavior: 'smooth' });
                  }, 120);
                }}
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1"
              >
                FAQ
              </a>
              <button 
                onClick={() => setShowAbout(true)} 
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1"
              >
                About
              </button>
              <button 
                onClick={() => setShowContact(true)} 
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1"
              >
                Contact
              </button>
              <button 
                onClick={() => setShowPrivacy(true)} 
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1 whitespace-nowrap"
              >
                Privacy Policy
              </button>
              <button 
                onClick={() => setShowTerms(true)} 
                className="text-xs uppercase font-extrabold tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all pb-1"
              >
                Terms
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowMockAds(prev => !prev)}
                className="text-[10px] font-mono tracking-wider text-[#8E9299] hover:text-[#5A5A40] px-3 py-1.5 rounded-lg border border-black/5 bg-[#FAF9F5] transition-all"
              >
                Ads: {showMockAds ? 'ON' : 'OFF'}
              </button>

              <button 
                onClick={() => setMode('listing')}
                className="hidden sm:flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest px-5 py-3 rounded-xl border-2 border-[#5A5A40]/25 text-[#5A5A40] hover:bg-[#5A5A40]/5 transition-all cursor-pointer"
              >
                <ShoppingBag size={13} />
                <span>Optimize Free</span>
              </button>

              {/* Mobile responsive toggle shortcut */}
              <div className="lg:hidden flex items-center gap-1 bg-[#FAF9F5] p-1 rounded-xl border border-black/5">
                <button 
                  onClick={() => setMode('home')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all ${mode === 'home' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8E9299]'}`}
                >
                  Home
                </button>
                <button 
                  onClick={() => setMode('reply')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all ${mode !== 'home' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8E9299]'}`}
                >
                  Tools
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Dynamic Header Ad Banner (Billboard Placement) */}
      {showMockAds && (
        <div className="w-full flex justify-center px-4">
          <AdSensePlaceholder size="billboard" />
        </div>
      )}

      {/* Page Content Body */}
      <main className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col justify-start transition-all duration-300`}>
        {/* Mode Switcher */}
        {mode !== 'home' && (
          <div className="flex justify-center mb-12">
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-black/5 flex gap-1">
              <button
                onClick={() => setMode('reply')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 ${
                  mode === 'reply' 
                    ? 'bg-[#5A5A40] text-white shadow-md' 
                    : 'text-[#8E9299] hover:bg-black/5'
                }`}
              >
                <MessageSquare size={18} />
                <span className="font-medium">Reply Mode</span>
              </button>
              <button
                onClick={() => setMode('listing')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 ${
                  mode === 'listing' 
                    ? 'bg-[#5A5A40] text-white shadow-md' 
                    : 'text-[#8E9299] hover:bg-black/5'
                }`}
              >
                <ShoppingBag size={18} />
                <span className="font-medium">Listing Mode</span>
              </button>
              <button
                onClick={() => setMode('chat')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 ${
                  mode === 'chat' 
                    ? 'bg-[#5A5A40] text-white shadow-md' 
                    : 'text-[#8E9299] hover:bg-black/5'
                }`}
              >
                <MessageCircle size={18} />
                <span className="font-medium">AI Chat</span>
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-16"
            >
              {/* 1. PROFESSIONAL HERO SECTION */}
              <div className="bg-gradient-to-br from-[#5A5A40]/10 via-[#5A5A40]/5 to-transparent rounded-[32px] p-8 md:p-12 border border-[#5A5A40]/15 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#5A5A40]/5 rounded-full blur-3xl -z-10" />
                <div className="max-w-3xl">
                  {/* Visual Category tag */}
                  <div className="inline-flex items-center gap-2 bg-[#5A5A40]/15 text-[#5A5A40] px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-extrabold mb-6 border border-[#5A5A40]/10">
                    <Award size={12} />
                    <span>Free Merchant AI Portal & Copy Suite</span>
                  </div>
                  
                  <h1 className="font-serif text-4xl md:text-6xl font-bold text-[#5A5A40] leading-[1.08] tracking-tight mb-6">
                    Assess. Optimize. Scale. <br />
                    Complete E-Commerce Copy Engine
                  </h1>
                  
                  <p className="text-[#5A5A40]/90 text-sm md:text-base leading-relaxed mb-8 max-w-2xl font-normal">
                    MerchantAI is a full-scale AI companion optimized to handle the heavy lifting for modern e-commerce stores. 
                    From drafting ultra-empathetic, localized customer dispute replies across 15 countries to generating character-synchronized search listings 
                    for Amazon FBA and eBay, our portal provides direct, ready-to-publish outputs that secure buy-box placements and preserve top customer rating benchmarks.
                  </p>

                  {/* Immediate App CTAs */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => setMode('reply')}
                      className="flex items-center justify-center gap-2 px-7 py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      <MessageSquare size={16} />
                      <span>Open Reply Wizard</span>
                    </button>
                    <button
                      onClick={() => setMode('listing')}
                      className="flex items-center justify-center gap-2 px-7 py-4 bg-white hover:bg-[#FAF9F5] text-[#5A5A40] border-2 border-[#5A5A40]/20 text-xs font-extrabold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      <ShoppingBag size={16} />
                      <span>Generate SEO Listing</span>
                    </button>
                    <button
                      onClick={() => setMode('chat')}
                      className="flex items-center justify-center gap-2 px-7 py-4 bg-[#5A5A40]/5 hover:bg-[#5A5A40]/10 text-[#5A5A40] text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      <Bot size={16} />
                      <span>Co-Pilot Chat</span>
                    </button>
                  </div>
                </div>

                {/* Sub-features grid overlay */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-[#5A5A40]/10 text-center md:text-left">
                  <div>
                    <span className="text-xl md:text-2xl font-serif text-[#5A5A40] font-bold">15+</span>
                    <p className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold mt-0.5">Regions & Currencies</p>
                  </div>
                  <div>
                    <span className="text-xl md:text-2xl font-serif text-[#5A5A40] font-bold">100%</span>
                    <p className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold mt-0.5">Characters Compliant</p>
                  </div>
                  <div>
                    <span className="text-xl md:text-2xl font-serif text-[#5A5A40] font-bold">Instant</span>
                    <p className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold mt-0.5">Competitor Overlap Maps</p>
                  </div>
                  <div>
                    <span className="text-xl md:text-2xl font-serif text-[#5A5A40] font-bold">No-Cost</span>
                    <p className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold mt-0.5">Free Ad-Supported Access</p>
                  </div>
                </div>
              </div>

              {/* 2. AD PLACEMENT & DYNAMIC AD TOGGLE */}
              {showMockAds && (
                <div className="flex flex-col items-center">
                  <div className="w-full text-center mb-1">
                    <span className="text-[9px] uppercase font-mono text-[#8E9299] tracking-wider">Contextual Dynamic Shopping Banners</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <AdSensePlaceholder size="rectangle" />
                    <div className="bg-[#FAF9F5] border border-[#5A5A40]/15 rounded-2xl p-6 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-mono uppercase bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded font-bold">Pro Seller Tip</span>
                        <h4 className="font-serif text-lg font-bold text-[#5A5A40] mt-3">Avoid Keyword Stuffing Penalty</h4>
                        <p className="text-xs text-[#8E9299] mt-1.5 leading-relaxed">
                          Amazon's Search A10 algorithm filters out listings repeating search terms over 3 times inside key bullets. 
                          Keep primary phrase triggers natural, prioritizing readability to boost Conversion Rate (CRO).
                        </p>
                      </div>
                      <div className="mt-4 flex justify-between items-center text-[10px] uppercase tracking-wider font-extrabold">
                        <span className="text-gray-400">Ad Choices Verified</span>
                        <a href="#original-articles" className="text-[#5A5A40] hover:underline">Learn and Rank &rarr;</a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. WHAT THE TOOL DOES */}
              <div className="space-y-8 pt-4">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Advanced Copy Systems</span>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#5A5A40] font-bold">Uncompromising E-Commerce Superpowers</h2>
                  <p className="text-sm text-[#8E9299]">
                    MerchantAI coordinates complex regulatory, algorithmic, and support rules to deliver high-converting copy in seconds.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-3xl p-8 border border-black/5 hover:border-[#5A5A40]/15 transition-all shadow-sm">
                    <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center text-[#5A5A40] mb-6">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-[#5A5A40] mb-3">Reply Wizard & Dispute Resolver</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Automatically generates empathetic, firm, and fully protective resolution formulas for item transit losses, damage disputes, or custom returns. Protects seller metrics across 15 regions.
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl p-8 border border-black/5 hover:border-[#5A5A40]/15 transition-all shadow-sm">
                    <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center text-[#5A5A40] mb-6">
                      <ShoppingBag size={24} />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-[#5A5A40] mb-3">SEO Hub & Listing Optimizer</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Structures search headlines, bullet arguments, and back-end keywords strictly matching Amazon's A10 or eBay's Cassini filters. Prevents keyword stuffing penalties while securing search real estate.
                    </p>
                  </div>

                  <div className="bg-white rounded-3xl p-8 border border-black/5 hover:border-[#5A5A40]/15 transition-all shadow-sm">
                    <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center text-[#5A5A40] mb-6">
                      <Bot size={24} />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-[#5A5A40] mb-3">Co-Pilot & Strategy Chat</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      A real-time, context-grounded specialist configured with deep retail memory. Query pricing strategies, customer policy drafts, or FBA freight protocols instantly.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. HOW IT WORKS */}
              <div className="bg-[#FAF9F5] rounded-[32px] p-8 md:p-12 border border-black/5 space-y-8">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Seamless Execution Pipeline</span>
                  <h2 className="font-serif text-3xl text-[#5A5A40] font-bold">How the Optimization Engine Works</h2>
                  <p className="text-xs text-[#8E9299]">
                    Skip hours of manual copy drafts. Follow our integrated four-step pipeline to export ready-to-publish material.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shadow">
                      01
                    </div>
                    <h4 className="font-serif text-base font-bold text-[#5A5A40]">Input Specs</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Paste in raw product key-terms or copy the customer’s complex dispute complaint text. No pre-formatting needed.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shadow shadow-black/10">
                      02
                    </div>
                    <h4 className="font-serif text-base font-bold text-[#5A5A40]">Align Marketplace</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Choose your channel (Amazon, eBay, Etsy, or Shopify) to automatically set custom algorithm guidelines and character restrictions.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shadow shadow-black/10">
                      03
                    </div>
                    <h4 className="font-serif text-base font-bold text-[#5A5A40]">Calibrate Locale</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Select target countries, currencies, and support courier protocols (like FBA, USPS, or Royal Mail) for perfectly native-looking assets.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shadow shadow-black/10">
                      04
                    </div>
                    <h4 className="font-serif text-base font-bold text-[#5A5A40]">Copy & Deploy</h4>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Get premium outputs generated by our highly tuned Gemini models with direct characters compliance validation, ready for your console.
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. MARKETPLACE COVERAGE */}
              <div className="space-y-8">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Built-In Algorithm Memory</span>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#5A5A40] font-bold">Comprehensive Channel & Platform Coverage</h2>
                  <p className="text-xs text-[#8E9299]">
                    MerchantAI handles unique platform-specific guidelines entirely automatically. Choose any target.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-black/5 text-center flex flex-col items-center justify-between hover:border-[#5A5A40]/30 transition-all">
                    <span className="font-serif text-[13px] font-bold text-[#5A5A40] block mb-2 px-2 py-1 bg-[#5A5A40]/10 rounded-md">Amazon FBA</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block font-mono">Amazon A10</span>
                      <p className="text-[9px] text-[#8E9299] mt-1">249Byte backend arrays, maximum 200 char headlines.</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-black/5 text-center flex flex-col items-center justify-between hover:border-[#5A5A40]/30 transition-all">
                    <span className="font-serif text-[13px] font-bold text-[#e53238] block mb-2 px-2 py-1 bg-[#e53238]/10 rounded-md">eBay Desk</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block font-mono">eBay Cassini</span>
                      <p className="text-[9px] text-[#8E9299] mt-1">Strict 80 char title cap, pre-formatted specifics lists.</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-black/5 text-center flex flex-col items-center justify-between hover:border-[#5A5A40]/30 transition-all">
                    <span className="font-serif text-[13px] font-bold text-[#96BF48] block mb-2 px-2 py-1 bg-[#96BF48]/10 rounded-md">Shopify SEO</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block font-mono">Shopify Stores</span>
                      <p className="text-[9px] text-[#8E9299] mt-1">Emotional validation storytelling and SEO meta logs.</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-black/5 text-center flex flex-col items-center justify-between hover:border-[#5A5A40]/30 transition-all">
                    <span className="font-serif text-[13px] font-bold text-[#ffa200] block mb-2 px-2 py-1 bg-[#ffa200]/10 rounded-md">Walmart Sell</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block font-mono">Walmart SEO</span>
                      <p className="text-[9px] text-[#8E9299] mt-1">Benefit-to-feature matrix rules and clean bullet lines.</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-black/5 text-center flex flex-col items-center justify-between hover:border-[#5A5A40]/30 transition-all">
                    <span className="font-serif text-[13px] font-bold text-[#F56400] block mb-2 px-2 py-1 bg-[#F56400]/10 rounded-md">Etsy Crafts</span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block font-mono">Etsy & Crafts</span>
                      <p className="text-[9px] text-[#8E9299] mt-1">13 tags optimization, lifestyle description structures.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. CORE AI ENGINE SANDBOX (BELOW THE FOLD WORKSPACE PREVIEW) */}
              <div id="merchant-tools" className="bg-white rounded-[32px] p-8 border border-[#5A5A40]/15 shadow-sm space-y-8 scroll-mt-24">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-3.5 py-1.5 rounded-full font-mono font-bold tracking-widest uppercase">
                    Interactive Workspace Launcher
                  </span>
                  <h2 className="font-serif text-3xl text-[#5A5A40] font-bold">Portal Live Sandbox Playground</h2>
                  <p className="text-xs text-[#8E9299] leading-relaxed">
                    Set up your parameters inside our micro-setup console below, then instantly step into the live generative sandbox workspace to compile, download, or copy.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#FAF9F5] p-2 rounded-2xl border border-black/5">
                  <button
                    onClick={() => setEmbeddedToolTab('reply')}
                    className={`flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${embeddedToolTab === 'reply' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8E9299] hover:bg-black/5'}`}
                  >
                    <MessageSquare size={16} />
                    <span>01. Customer Reply Setup</span>
                  </button>
                  <button
                    onClick={() => setEmbeddedToolTab('listing')}
                    className={`flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${embeddedToolTab === 'listing' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8E9299] hover:bg-black/5'}`}
                  >
                    <ShoppingBag size={16} />
                    <span>02. SEO Listing Setup</span>
                  </button>
                  <button
                    onClick={() => setEmbeddedToolTab('chat')}
                    className={`flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${embeddedToolTab === 'chat' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#8E9299] hover:bg-black/5'}`}
                  >
                    <Bot size={16} />
                    <span>03. Strategy Co-Pilot Setup</span>
                  </button>
                </div>

                {embeddedToolTab === 'reply' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[#FAF9F5]/30 rounded-2xl border border-[#5A5A40]/10">
                    <div className="space-y-4">
                      <h4 className="font-serif text-lg font-bold text-[#5A5A40]">Dispute Parameters Setup</h4>
                      <p className="text-xs text-[#8E9299]">Pre-program your customer dispute details here, then seamlessly port over into the generation studio.</p>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#8E9299] block font-mono">Dispute Reason / Issue Type</label>
                        <select 
                          value={replyInputs.issueType}
                          onChange={(e) => setReplyInputs({ ...replyInputs, issueType: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm bg-white text-[#1a1a1a]"
                        >
                          <option>Item lost in transit</option>
                          <option>Item damaged upon arrival</option>
                          <option>Order delay dispute</option>
                          <option>Sizing error refund request</option>
                          <option>Custom exchange proposal</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#8E9299] block font-mono">Target Logistics Status</label>
                        <select 
                          value={replyInputs.deliveryStatus}
                          onChange={(e) => setReplyInputs({ ...replyInputs, deliveryStatus: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm bg-white text-[#1a1a1a]"
                        >
                          <option>Shipped (In transit)</option>
                          <option>Delivered according to GPS</option>
                          <option>Unshipped (Pending)</option>
                          <option>Returned to sender</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between bg-white p-6 rounded-2xl border border-black/5">
                      <div>
                        <span className="text-[9px] uppercase font-mono bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded font-extrabold block w-fit">Active Mapping Configuration</span>
                        <h4 className="font-serif text-base font-bold text-[#5A5A40] mt-3">Ready to Compile</h4>
                        <ul className="text-xs text-[#8E9299] mt-3 space-y-1.5 list-inside list-disc">
                          <li>Customer Name: <strong className="text-[#5A5A40]">{replyInputs.customerName || "Sarah Jones (Default)"}</strong></li>
                          <li>Assigned Region: <strong className="text-[#5A5A40]">{replyInputs.country}</strong></li>
                          <li>Marketplace: <strong className="text-[#5A5A40]">{replyInputs.marketplace}</strong></li>
                          <li>Selected Issue: <strong className="text-[#5A5A40]">{replyInputs.issueType}</strong></li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setMode('reply')}
                        className="w-full mt-6 py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Zap size={14} />
                        <span>Launch Workspace & Compile Reply</span>
                      </button>
                    </div>
                  </div>
                )}

                {embeddedToolTab === 'listing' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[#FAF9F5]/30 rounded-2xl border border-[#5A5A40]/10">
                    <div className="space-y-4">
                      <h4 className="font-serif text-lg font-bold text-[#5A5A40]">SEO Optimization Setup</h4>
                      <p className="text-xs text-[#8E9299]">Enter key terms and parameters below to configure your search-optimized product listing layout.</p>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#8E9299] block font-mono">Target Channel Portal</label>
                        <select 
                          value={listingInputs.marketplace}
                          onChange={(e) => setListingInputs({ ...listingInputs, marketplace: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm bg-white text-[#1a1a1a]"
                        >
                          <option>Amazon FBA</option>
                          <option>eBay Premium</option>
                          <option>Shopify Headline</option>
                          <option>Walmart standard</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#8E9299] block font-mono">Product Category</label>
                        <select 
                          value={listingInputs.category}
                          onChange={(e) => setListingInputs({ ...listingInputs, category: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm bg-white text-[#1a1a1a]"
                        >
                          <option>Electronics & Tech Accessories</option>
                          <option>Home Decor & Premium Bedding</option>
                          <option>Health, Wellness & Organic Tea</option>
                          <option>Apparel, Footwear & Sustainable Goods</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between bg-white p-6 rounded-2xl border border-black/5">
                      <div>
                        <span className="text-[9px] uppercase font-mono bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded font-extrabold block w-fit">Live SEO Rules Mapping</span>
                        <h4 className="font-serif text-base font-bold text-[#5A5A40] mt-3">Ready to Synthesize SEO Copy</h4>
                        <ul className="text-xs text-[#8E9299] mt-3 space-y-1.5 list-inside list-disc">
                          <li>Active Target: <strong className="text-[#5A5A40]">{listingInputs.marketplace}</strong></li>
                          <li>Product Category: <strong className="text-[#5A5A40] font-normal">{listingInputs.category}</strong></li>
                          <li>Primary Term: <strong className="text-[#5A5A40] font-normal">{listingInputs.primaryKeyword || "Eco-friendly retail item"}</strong></li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setMode('listing')}
                        className="w-full mt-6 py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Zap size={14} />
                        <span>Launch Workspace & Structure SEO Copy</span>
                      </button>
                    </div>
                  </div>
                )}

                {embeddedToolTab === 'chat' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[#FAF9F5]/30 rounded-2xl border border-[#5A5A40]/10">
                    <div className="space-y-4">
                      <h4 className="font-serif text-lg font-bold text-[#5A5A40]">Co-Pilot Thread Setup</h4>
                      <p className="text-xs text-[#8E9299]">Configure the specific focus parameters of your virtual e-commerce advisor before entering the live chat.</p>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#8E9299] block font-mono">Specialized Advisor Persona / Mode</label>
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-black/10 text-sm bg-white text-[#1a1a1a]"
                        >
                          <option>A10 Algorithm & Rank Strategist</option>
                          <option>Empathetic Customer Success Expert</option>
                          <option>Amazon TOS Compliance Consultant</option>
                          <option>Multi-Region VAT & Accounting Auditor</option>
                        </select>
                      </div>
                      <p className="text-[11px] text-[#8E9299] leading-relaxed italic">
                        "Your co-pilot maintains live knowledge maps of international retail thresholds, enabling safe draft suggestions."
                      </p>
                    </div>
                    <div className="flex flex-col justify-between bg-white p-6 rounded-2xl border border-black/5">
                      <div>
                        <span className="text-[9px] uppercase font-mono bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded font-extrabold block w-fit">Co-Pilot Memory Allocation</span>
                        <h4 className="font-serif text-base font-bold text-[#5A5A40] mt-3">Advisor Ready</h4>
                        <ul className="text-xs text-[#8E9299] mt-3 space-y-1.5 list-inside list-disc">
                          <li>Knowledge Scope: <strong className="text-[#5A5A40]">E-Commerce Global Channels</strong></li>
                          <li>Inference Engine: <strong className="text-[#5A5A40]">Server-side Gemini Pro</strong></li>
                          <li>Compliance Thresholds: <strong className="text-[#5A5A40]">Fully Synced to 2026 TOS</strong></li>
                        </ul>
                      </div>
                      <button
                        onClick={() => setMode('chat')}
                        className="w-full mt-6 py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <MessageCircle size={14} />
                        <span>Open Live Chat Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 7. ORIGINAL SUBSTANTIAL NICHE CONTENT: BLOG HUB */}
              <div id="original-articles" className="space-y-8 scroll-mt-24">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Original E-Commerce Insights</span>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#5A5A40] font-bold">Merchant Hub & Knowledge Center</h2>
                  <p className="text-sm text-[#8E9299]">
                    Deep dives, industry tutorials, and master strategies for running and ranking Amazon, eBay, and Shopify stores safely. Read full studies below.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {NICHE_ARTICLES.map((article) => (
                    <div key={article.id} className="bg-white rounded-3xl p-6 border border-black/5 hover:border-[#5A5A40]/25 transition-all shadow-sm flex flex-col justify-between group">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold font-mono tracking-wider bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-md">{article.category}</span>
                          <span className="text-[10px] text-[#8E9299] font-semibold">{article.readTime}</span>
                        </div>
                        <h3 className="font-serif text-lg font-semibold text-[#1a1a1a] leading-snug group-hover:text-[#5A5A40] transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-xs text-[#8E9299] leading-relaxed line-clamp-3">
                          {article.excerpt}
                        </p>
                      </div>
                      <div className="mt-6 pt-4 border-t border-black/5 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-gray-400 font-semibold">{article.date}</span>
                        <button
                          onClick={() => setSelectedArticleId(article.id)}
                          className="text-[10px] uppercase tracking-widest font-extrabold text-[#5A5A40] hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer"
                        >
                          <span>Read Study</span>
                          <span>&rarr;</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 8. USE CASES & AUDIENCES GRID */}
              <div className="space-y-8">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Who Is It Designed For</span>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#5A5A40] font-bold">Targeted Channel Optimization</h2>
                  <p className="text-sm text-[#8E9299]">
                    Whether you fulfill or sell on global platforms, our fine-tuned copy templates guarantee compliance and high conversions.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1 */}
                  <div className="bg-white rounded-3xl p-6 border border-black/5 hover:bg-[#5A5A40]/5 transition-colors">
                    <div className="p-3 bg-[#5A5A40]/10 text-[#5A5A40] rounded-2xl w-fit mb-4">
                      <Star size={20} />
                    </div>
                    <h3 className="font-serif text-base font-bold text-[#5A5A40] mb-2">Amazon FBA & Vendor</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Maintains rigid compliance limits (max 200 characters for titles, 5 benefit-dense bullet lines) and structures backend search arrays cleanly.
                    </p>
                  </div>
                  {/* Card 2 */}
                  <div className="bg-white rounded-3xl p-6 border border-black/5 hover:bg-[#5A5A40]/5 transition-colors">
                    <div className="p-3 bg-[#5A5A40]/10 text-[#5A5A40] rounded-2xl w-fit mb-4">
                      <Percent size={20} />
                    </div>
                    <h3 className="font-serif text-base font-bold text-[#5A5A40] mb-2">eBay PowerSellers</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Optimizes for quick, keyword-rich headings (max 80 characters), structures specifics templates, and adds clear returns options descriptors.
                    </p>
                  </div>
                  {/* Card 3 */}
                  <div className="bg-white rounded-3xl p-6 border border-black/5 hover:bg-[#5A5A40]/5 transition-colors">
                    <div className="p-3 bg-[#5A5A40]/10 text-[#5A5A40] rounded-2xl w-fit mb-4">
                      <Globe size={20} />
                    </div>
                    <h3 className="font-serif text-base font-bold text-[#5A5A40] mb-2">Direct & Shopify Stores</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Drives story-rich sales structures, highlighting emotional validation parameters, lifestyle features, and SEO meta snippets dynamically.
                    </p>
                  </div>
                  {/* Card 4 */}
                  <div className="bg-white rounded-3xl p-6 border border-black/5 hover:bg-[#5A5A40]/5 transition-colors">
                    <div className="p-3 bg-[#5A5A40]/10 text-[#5A5A40] rounded-2xl w-fit mb-4">
                      <HelpCircle size={20} />
                    </div>
                    <h3 className="font-serif text-base font-bold text-[#5A5A40] mb-2">Support & Refund Desks</h3>
                    <p className="text-xs text-[#8E9299] leading-relaxed">
                      Drafts replies to international customers. Supports auto-refund rules, FBA transit complaints, and localized courier protocols.
                    </p>
                  </div>
                </div>
              </div>

              {/* 9. INTERACTIVE SEO TRAFFIC & ROI CALCULATOR */}
              <div className="space-y-4">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Instant Evaluation Tools</span>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#5A5A40] font-bold">SEO Target Lift Calculator</h2>
                  <p className="text-sm text-[#8E9299]">
                    Type in keyword traffic estimates below to calculate expected monthly revenue gains from our copy optimization models.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-black/5 shadow-sm max-w-4xl mx-auto">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b border-black/5 pb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#5A5A40]/15 text-[#5A5A40] rounded-2xl">
                        <Calculator size={22} />
                      </div>
                      <div>
                        <h4 className="font-serif text-xl font-bold text-[#5A5A40]">Calculated Optimization Opportunity</h4>
                        <p className="text-[10px] text-[#8E9299] uppercase tracking-wide font-semibold mt-0.5">Real-time Traffic Formula Engine</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setCalcSearchVolume(15000); setCalcCTR(4.5); setCalcConversion(3.0); setCalcPrice(29.99); }}
                      className="text-xs font-bold text-[#5A5A40] hover:bg-[#5A5A40]/5 px-3.5 py-2 rounded-xl border border-[#5A5A40]/10 transition-all cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-[#8E9299] block font-mono">Search Volume / Mo</label>
                      <input 
                        type="number" 
                        value={calcSearchVolume} 
                        onChange={(e) => setCalcSearchVolume(Math.max(0, Number(e.target.value)))} 
                        className="w-full px-4 py-3 bg-[#f9f9f7] border border-black/10 focus:outline-none focus:ring-2 rounded-xl text-sm transition-all text-[#1a1a1a]"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-[#8E9299] block font-mono">Organic CTR (%)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={calcCTR} 
                        onChange={(e) => setCalcCTR(Math.max(0, Number(e.target.value)))} 
                        className="w-full px-4 py-3 bg-[#f9f9f7] border border-black/10 focus:outline-none focus:ring-2 rounded-xl text-sm transition-all text-[#1a1a1a]"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-[#8E9299] block font-mono">Conversion Rate (%)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={calcConversion} 
                        onChange={(e) => setCalcConversion(Math.max(0, Number(e.target.value)))} 
                        className="w-full px-4 py-3 bg-[#f9f9f7] border border-black/10 focus:outline-none focus:ring-2 rounded-xl text-sm transition-all text-[#1a1a1a]"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-[#8E9299] block font-mono">Price Per Sale ($)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={calcPrice} 
                        onChange={(e) => setCalcPrice(Math.max(0, Number(e.target.value)))} 
                        className="w-full px-4 py-3 bg-[#f9f9f7] border border-black/10 focus:outline-none focus:ring-2 rounded-xl text-sm transition-all text-[#1a1a1a]"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  {/* Outputs display panel */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-[#5A5A40]/5 rounded-[20px] border border-[#5A5A40]/10 text-center">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold block font-mono">New Monthly Clicks</span>
                      <p className="text-3xl font-serif font-bold text-[#5A5A40] mt-1.5">
                        {Math.round(calcSearchVolume * (calcCTR / 100)).toLocaleString()}
                      </p>
                    </div>
                    <div className="md:border-x border-black/5">
                      <span className="text-[10px] uppercase tracking-wider text-[#8E9299] font-bold block font-mono">Incremental Orders</span>
                      <p className="text-3xl font-serif font-bold text-[#5A5A40] mt-1.5">
                        {Math.round((calcSearchVolume * (calcCTR / 100)) * (calcConversion / 100)).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-green-700 font-extrabold block font-mono">Estimated Financial Lift</span>
                      <p className="text-3xl font-serif font-bold text-green-700 mt-1.5">
                        ${((calcSearchVolume * (calcCTR / 100)) * (calcConversion / 100) * calcPrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 10. EXPANDABLE FAQs SECTION */}
              <div id="faqs-hub" className="space-y-8 scroll-mt-24">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <span className="text-[10px] font-mono text-[#8E9299] uppercase tracking-widest font-extrabold">Got Questions?</span>
                  <h2 className="font-serif text-3xl md:text-4xl text-[#5A5A40] font-bold">Frequently Asked Questions</h2>
                  <p className="text-sm text-[#8E9299]">
                    Learn how our algorithms optimize copying strategies across global Amazon and eBay channels seamlessly.
                  </p>
                </div>

                <div className="max-w-3xl mx-auto space-y-4">
                  {[
                    {
                      q: "How does MerchantAI optimize listings differently for Amazon compared to eBay?",
                      a: "Amazon's Search A10 engine relies on high benefit coverage density and targets backend search fields (249 bytes maximum). eBay relies on Cassandra/SEO match indexes requiring character headings (max 80 characters) and detailed Item Specifics structures. MerchantAI's algorithms automatically switch character counts and template outputs depending on the selected marketplace channel."
                    },
                    {
                      q: "Are the generated dispute templates compatible with FBA (Fulfillment by Amazon) processes?",
                      a: "Yes! The Reply Wizard is trained on common FBA transit disputes. When you select FBA as the courier type, it drafts polite responses communicating that Amazon is responsible for shipping delays and safety, which actively helps sellers defend their negative feedback metrics."
                    },
                    {
                      q: "Can I use the competitor analysis tool for direct store listing benchmarks?",
                      a: "Absolutely. Simply copy and paste the competitor’s headline and their key bullets or specifications into the Benchmark Tool. It generates a detailed coverage map revealing shared terms, exclusive tags, and tactical suggestions to outperform them."
                    },
                    {
                      q: "Does this public tool store or access any sensitive personal store data?",
                      a: "No. MerchantAI operates as a secure, local-storage based public tool. We do not access or store API secrets, client IDs, or store inventory structures, ensuring total security and alignment with GDPR and public privacy standards."
                    },
                    {
                      q: "Is MerchantAI monetized using Google AdSense banners?",
                      a: "Yes! To keep our models 100% free for e-commerce sellers worldwide, the platform integrates respectful, e-commerce contextual Google AdSense ad units. Our sponsors are pre-validated to ensure high relevance to merchant inventory management."
                    }
                  ].map((faq, index) => {
                    const isOpen = activeFAQ === index;
                    return (
                      <div key={index} className="bg-white rounded-2xl border border-black/5 overflow-hidden transition-all duration-200">
                        <button
                          onClick={() => setActiveFAQ(isOpen ? null : index)}
                          className="w-full text-left p-6 flex justify-between items-center bg-white hover:bg-[#FAF9F5] transition-colors"
                        >
                          <span className="font-serif text-base font-bold text-[#5A5A40] pr-4">{faq.q}</span>
                          <span className="text-lg text-[#5A5A40] font-bold">{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                          <div className="p-6 pt-0 bg-white border-t border-black/5">
                            <p className="text-xs text-[#5A5A40]/80 leading-relaxed font-sans pt-4">{faq.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar-style Sponsor Placement */}
              {showMockAds && (
                <div className="pt-8 text-center">
                  <AdSensePlaceholder size="sidebar" />
                </div>
              )}
            </motion.div>
          ) : mode === 'reply' ? (
            <motion.div
              key="reply"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Reply Form */}
              <div className={`bg-white rounded-3xl p-8 shadow-sm border-2 transition-all duration-300`} style={{ borderColor: `${activeStyle.primary}20` }}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <h2 className="font-serif text-2xl text-[#5A5A40]">Draft a Response</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowTemplates(true)}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/5 px-3 py-1.5 rounded-lg hover:bg-[#5A5A40]/10 transition-all"
                      >
                        <FolderOpen size={14} />
                        Templates
                      </button>
                      <button 
                        onClick={resetReplyForm}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all"
                      >
                        <Trash2 size={14} />
                        Clear
                      </button>
                    </div>
                  </div>
                  {activeStyle.logo && (
                    <img src={activeStyle.logo} alt={currentMarketplace} className="h-6 opacity-80 grayscale hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Customer Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jones"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={replyInputs.customerName}
                      onChange={(e) => setReplyInputs({ ...replyInputs, customerName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Customer Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="e.g. sarah@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={replyInputs.customerEmail}
                      onChange={(e) => setReplyInputs({ ...replyInputs, customerEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Order ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 202-1234567-1234567"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={replyInputs.orderId}
                      onChange={(e) => setReplyInputs({ ...replyInputs, orderId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Marketplace</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all bg-white"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={replyInputs.marketplace}
                      onChange={(e) => setReplyInputs({ ...replyInputs, marketplace: e.target.value })}
                    >
                      <option>Amazon Retail</option>
                      <option>Amazon Vendor</option>
                      <option>eBay</option>
                      <option>Direct Website</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Target Country / Region</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all bg-white"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={replyInputs.country}
                      onChange={(e) => setReplyInputs({ ...replyInputs, country: e.target.value })}
                    >
                      <option>United Kingdom</option>
                      <option>United States</option>
                      <option>Germany</option>
                      <option>Canada</option>
                      <option>Australia</option>
                      <option>France</option>
                      <option>Italy</option>
                      <option>Spain</option>
                      <option>Japan</option>
                      <option>Other...</option>
                    </select>
                  </div>
                  {replyInputs.country === 'Other...' && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Custom Country / Region Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Netherlands, Brazil, India, etc."
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                        value={replyInputs.customCountry}
                        onChange={(e) => setReplyInputs({ ...replyInputs, customCountry: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Issue Type</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all bg-white"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={replyInputs.issueType}
                      onChange={(e) => setReplyInputs({ ...replyInputs, issueType: e.target.value })}
                    >
                      <option>General Inquiry</option>
                      <option>Damaged Item</option>
                      <option>Wrong Item Received</option>
                      <option>Missing Item</option>
                      <option>Delivery Delay</option>
                      <option>Return Request</option>
                      <option>Amazon - Negative Feedback Appeal (FBA/Vendor Delivery)</option>
                      <option>Amazon - Negative Feedback Appeal (Product Review)</option>
                      <option>Amazon - Negative Feedback Appeal (Other Policy)</option>
                      <option>Amazon - Policy Violation Appeal</option>
                      <option>Amazon - Account/Listing Issue Support</option>
                      <option>Amazon - Buyer Message (FBM/Retail)</option>
                    </select>
                  </div>
                  {(replyInputs.marketplace.includes('Amazon')) && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Fulfillment Type</label>
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all bg-white"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                        value={replyInputs.fulfillmentType}
                        onChange={(e) => setReplyInputs({ ...replyInputs, fulfillmentType: e.target.value as any })}
                      >
                        <option value="FBA">FBA (Retail)</option>
                        <option value="FBM">FBM (Retail)</option>
                        <option value="Vendor Central">Vendor Central</option>
                      </select>
                    </div>
                  )}
                  {(replyInputs.issueType.includes('Appeal') || replyInputs.issueType.includes('Support')) && (
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Appeal / Issue Details</label>
                      <input
                        type="text"
                        placeholder="e.g. Feedback is a product review, policy violation details, etc."
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                        value={replyInputs.removalReason}
                        onChange={(e) => setReplyInputs({ ...replyInputs, removalReason: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Customer Message / Feedback</label>
                  <textarea
                    rows={5}
                    placeholder="Paste the customer's message or negative feedback here..."
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all resize-none"
                    style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                    value={replyInputs.message}
                    onChange={(e) => setReplyInputs({ ...replyInputs, message: e.target.value })}
                  />
                </div>

                <button
                  onClick={generateReply}
                  disabled={loading || !replyInputs.message}
                  className="w-full text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  style={{ backgroundColor: activeStyle.primary, boxShadow: `0 10px 15px -3px ${activeStyle.primary}40` }}
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                  {loading ? 'Drafting Reply...' : 'Draft Suggested Reply'}
                </button>
              </div>

              {/* Reply Output */}
              {suggestedReply && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`bg-white rounded-3xl p-8 shadow-sm border-2 relative`}
                  style={{ borderColor: `${activeStyle.primary}20` }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-serif text-2xl text-[#5A5A40]">Suggested Reply</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${activeStyle.bg} ${activeStyle.text}`}>
                        {currentMarketplace}
                      </span>
                      <div className="flex gap-1 border-l border-black/10 pl-3 ml-1">
                        <button
                          onClick={undo}
                          disabled={historyIndex === 0}
                          className="p-1.5 hover:bg-black/5 rounded-lg transition-all disabled:opacity-30 text-[#8E9299] hover:text-[#5A5A40]"
                          title="Undo"
                        >
                          <Undo size={16} />
                        </button>
                        <button
                          onClick={redo}
                          disabled={historyIndex >= history.length - 1}
                          className="p-1.5 hover:bg-black/5 rounded-lg transition-all disabled:opacity-30 text-[#8E9299] hover:text-[#5A5A40]"
                          title="Redo"
                        >
                          <Redo size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveAsTemplate}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider hover:bg-black/5 px-3 py-1.5 rounded-lg transition-all text-[#8E9299]"
                      >
                        {saved ? <Check size={14} className="text-emerald-600" /> : <Save size={14} />}
                        {saved ? 'Saved to Templates' : 'Save as Template'}
                      </button>
                      <button
                        onClick={generateEmailDraft}
                        disabled={loading}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider hover:bg-black/5 px-3 py-1.5 rounded-lg transition-all text-[#5A5A40]"
                      >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                        Draft as Email
                      </button>
                      <button
                        onClick={() => handleCopy(suggestedReply)}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider hover:bg-black/5 px-3 py-1.5 rounded-lg transition-all"
                        style={{ color: activeStyle.primary }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy Text'}
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3 ml-1">
                      <Sparkles size={12} className="text-[#5A5A40]" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299]">Refine Draft</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => modifyReply('salutation')}
                        disabled={loading}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-[#5A5A40]/5 transition-all text-[#5A5A40] disabled:opacity-50 bg-white shadow-sm group"
                      >
                        <User size={14} className="group-hover:scale-110 transition-transform" />
                        Add Salutation
                      </button>
                      <button
                        onClick={() => modifyReply('closing')}
                        disabled={loading}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-[#5A5A40]/5 transition-all text-[#5A5A40] disabled:opacity-50 bg-white shadow-sm group"
                      >
                        <MessageCircle size={14} className="group-hover:scale-110 transition-transform" />
                        Add Closing
                      </button>
                      <button
                        onClick={() => modifyReply('shorter')}
                        disabled={loading}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-[#5A5A40]/5 transition-all text-[#5A5A40] disabled:opacity-50 bg-white shadow-sm group"
                      >
                        <RefreshCw size={14} className={`group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
                        Make Shorter
                      </button>
                      <button
                        onClick={() => modifyReply('formal')}
                        disabled={loading}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-[#5A5A40]/5 transition-all text-[#5A5A40] disabled:opacity-50 bg-white shadow-sm group"
                      >
                        <Sparkles size={14} className="group-hover:scale-110 transition-transform text-amber-500" />
                        Make More Formal
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={suggestedReply}
                    onChange={(e) => setSuggestedReply(e.target.value)}
                    className="w-full h-64 p-4 bg-[#f9f9f7] rounded-xl border border-black/5 text-sm leading-relaxed focus:outline-none resize-none font-sans"
                  />
                  <div className="mt-4 flex items-start gap-2 text-[#8E9299] text-xs italic">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <p>Please review and edit the draft as necessary before sending to the customer on {currentMarketplace}.</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="listing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Listing Form */}
              <div className={`bg-white rounded-3xl p-8 shadow-sm border-2 transition-all duration-300`} style={{ borderColor: `${activeStyle.primary}20` }}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <h2 className="font-serif text-2xl text-[#5A5A40]">Create Listing</h2>
                    <button 
                      onClick={resetListingForm}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8E9299] hover:text-[#5A5A40] transition-all"
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  </div>
                  {activeStyle.logo && (
                    <img src={activeStyle.logo} alt={currentMarketplace} className="h-6 opacity-80 grayscale hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Product Type</label>
                    <input
                      type="text"
                      placeholder="e.g. Duvet Cover Set"
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                        listingErrors.productType ? 'border-red-500 bg-red-50' : 'border-black/10'
                      }`}
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={listingInputs.productType}
                      onChange={(e) => {
                        setListingInputs({ ...listingInputs, productType: e.target.value });
                        if (listingErrors.productType) setListingErrors({ ...listingErrors, productType: undefined });
                      }}
                    />
                    {listingErrors.productType && <p className="text-[10px] text-red-500 font-medium">{listingErrors.productType}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Size</label>
                    <input
                      type="text"
                      placeholder="e.g. Double, King, Super King"
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                        listingErrors.size ? 'border-red-500 bg-red-50' : 'border-black/10'
                      }`}
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={listingInputs.size}
                      onChange={(e) => {
                        setListingInputs({ ...listingInputs, size: e.target.value });
                        if (listingErrors.size) setListingErrors({ ...listingErrors, size: undefined });
                      }}
                    />
                    {listingErrors.size && <p className="text-[10px] text-red-500 font-medium">{listingErrors.size}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Colour / Pattern</label>
                    <input
                      type="text"
                      placeholder="e.g. Charcoal Grey, Floral"
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                        listingErrors.colour ? 'border-red-500 bg-red-50' : 'border-black/10'
                      }`}
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={listingInputs.colour}
                      onChange={(e) => {
                        setListingInputs({ ...listingInputs, colour: e.target.value });
                        if (listingErrors.colour) setListingErrors({ ...listingErrors, colour: undefined });
                      }}
                    />
                    {listingErrors.colour && <p className="text-[10px] text-red-500 font-medium">{listingErrors.colour}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Fabric / Material</label>
                    <input
                      type="text"
                      placeholder="e.g. 100% Egyptian Cotton"
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                        listingErrors.fabric ? 'border-red-500 bg-red-50' : 'border-black/10'
                      }`}
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={listingInputs.fabric}
                      onChange={(e) => {
                        setListingInputs({ ...listingInputs, fabric: e.target.value });
                        if (listingErrors.fabric) setListingErrors({ ...listingErrors, fabric: undefined });
                      }}
                    />
                    {listingErrors.fabric && <p className="text-[10px] text-red-500 font-medium">{listingErrors.fabric}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Vendor Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Home, Bedding, Textiles"
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                        listingErrors.vendorDepartment ? 'border-red-500 bg-red-50' : 'border-black/10'
                      }`}
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={listingInputs.vendorDepartment}
                      onChange={(e) => {
                        setListingInputs({ ...listingInputs, vendorDepartment: e.target.value });
                        if (listingErrors.vendorDepartment) setListingErrors({ ...listingErrors, vendorDepartment: undefined });
                      }}
                    />
                    {listingErrors.vendorDepartment && <p className="text-[10px] text-red-500 font-medium">{listingErrors.vendorDepartment}</p>}
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Target Marketplace</label>
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all bg-white"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                        value={listingInputs.marketplace}
                        onChange={(e) => handleMarketplaceChange(e.target.value)}
                      >
                        <option>Amazon Retail</option>
                        <option>Amazon Vendor</option>
                        <option>eBay</option>
                        <option>Direct Website</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Target Country / Region</label>
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all bg-white"
                        style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                        value={listingInputs.country}
                        onChange={(e) => setListingInputs({ ...listingInputs, country: e.target.value })}
                      >
                        <option>United Kingdom</option>
                        <option>United States</option>
                        <option>Germany</option>
                        <option>Canada</option>
                        <option>Australia</option>
                        <option>France</option>
                        <option>Italy</option>
                        <option>Spain</option>
                        <option>Japan</option>
                        <option>Other...</option>
                      </select>
                    </div>
                    {listingInputs.country === 'Other...' && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Custom Country / Region Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Netherlands, Brazil, India, etc."
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                          style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                          value={listingInputs.customCountry}
                          onChange={(e) => setListingInputs({ ...listingInputs, customCountry: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Marketplace Guidelines */}
                <div className="mb-6 p-4 rounded-2xl bg-black/5 border border-black/5 flex items-start gap-3">
                  <Info size={16} className="text-[#8E9299] mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#8E9299]">{listingInputs.marketplace} Guidelines</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-[10px] text-[#8E9299]">Title Limit: <strong className="text-[#5A5A40]">{MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.titleLimit} chars</strong></span>
                      <span className="text-[10px] text-[#8E9299]">Bullet Limit: <strong className="text-[#5A5A40]">{MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.bulletLimit} chars</strong></span>
                      <span className="text-[10px] text-[#8E9299]">Description Limit: <strong className="text-[#5A5A40]">{MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.descLimit} chars</strong></span>
                    </div>
                  </div>
                </div>

                {/* Marketplace Tips */}
                <div className="mb-6 p-4 rounded-2xl border-2 border-dashed border-[#5A5A40]/20 bg-[#5A5A40]/5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] mb-3 flex items-center gap-2">
                    <Sparkles size={14} />
                    {listingInputs.marketplace} Optimization Tips
                  </p>
                  <ul className="space-y-2">
                    {(MARKETPLACE_TIPS[listingInputs.marketplace] || []).map((tip, idx) => (
                      <li key={idx} className="text-[10px] text-[#5A5A40] flex gap-2">
                        <span className="font-bold">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Keywords (comma separated)</label>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setListingInputs({ 
                          ...listingInputs, 
                          keywords: userMarketplaceDefaults[listingInputs.marketplace]?.keywords || MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.commonKeywords || '' 
                        })}
                        className="text-[10px] text-[#5A5A40] hover:underline flex items-center gap-1"
                      >
                        <RefreshCw size={10} />
                        Reset to {listingInputs.marketplace} Defaults
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. soft, breathable, luxury"
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                    value={listingInputs.keywords}
                    onChange={(e) => setListingInputs({ ...listingInputs, keywords: e.target.value })}
                  />
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Key Features (one per line)</label>
                    <span className="text-[10px] text-[#8E9299]">Max {MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.bulletLimit || 500} chars per bullet</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="e.g. Hypoallergenic&#10;Breathable fabric&#10;Machine washable"
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all resize-none"
                    style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                    value={listingInputs.features}
                    onChange={(e) => setListingInputs({ ...listingInputs, features: e.target.value })}
                  />
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Customer Reviews (optional)</label>
                  <textarea
                    rows={4}
                    placeholder="Paste customer reviews here to generate a compelling summary..."
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all resize-none"
                    style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                    value={listingInputs.customerReviews}
                    onChange={(e) => setListingInputs({ ...listingInputs, customerReviews: e.target.value })}
                  />
                </div>

                <div className="flex justify-end mb-8">
                  <button
                    onClick={saveCurrentAsDefault}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider hover:bg-[#5A5A40]/10 px-4 py-2 rounded-xl transition-all border border-[#5A5A40]/20 text-[#5A5A40]"
                  >
                    {saved ? <Check size={14} className="text-emerald-600" /> : <Save size={14} />}
                    {saved ? 'Saved as Marketplace Default' : `Save as ${listingInputs.marketplace} Default`}
                  </button>
                </div>

                <div className="space-y-4 mb-8 p-6 bg-[#5A5A40]/5 rounded-2xl border border-[#5A5A40]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon size={18} className="text-[#5A5A40]" />
                    <h3 className="font-serif text-lg text-[#5A5A40]">Product Image Generator</h3>
                  </div>
                  <p className="text-xs text-[#8E9299] mb-4">Describe the product scene you'd like to generate (e.g., "A cosy bedroom with sun streaming through the window, featuring this duvet set on a wooden bed").</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Describe the product scene..."
                      className="flex-1 px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                      value={listingInputs.imagePrompt}
                      onChange={(e) => setListingInputs({ ...listingInputs, imagePrompt: e.target.value })}
                    />
                    <button
                      onClick={generateProductImage}
                      disabled={isGeneratingImage || !listingInputs.imagePrompt}
                      className="px-6 py-3 bg-[#5A5A40] text-white rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-md hover:bg-[#4A4A35]"
                    >
                      {isGeneratingImage ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={generateListing}
                  disabled={loading || !listingInputs.productType || !listingInputs.size || !listingInputs.colour || !listingInputs.fabric || !listingInputs.vendorDepartment}
                  className="w-full text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  style={{ backgroundColor: activeStyle.primary, boxShadow: `0 10px 15px -3px ${activeStyle.primary}40` }}
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                  {loading ? 'Generating Content...' : 'Generate Listing Content'}
                </button>

                {/* Saved Listings for Comparison */}
                {savedListings.length > 0 && (
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40]">
                          <Layout size={18} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Saved Listings</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-[#8E9299]">{savedListings.length} generated versions</p>
                            <span className="text-[10px] text-[#8E9299]">•</span>
                            <button 
                              onClick={toggleSelectAll}
                              className="text-[10px] text-[#5A5A40] hover:underline font-medium"
                            >
                              {selectedListingIds.length === savedListings.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        {selectedListingIds.length > 0 && (
                          <button
                            onClick={deleteSelectedListings}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-xl transition-all border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                            Delete ({selectedListingIds.length})
                          </button>
                        )}
                        <button
                          onClick={() => setShowComparison(true)}
                          disabled={selectedListingIds.length < 2}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl transition-all bg-[#5A5A40] text-white disabled:opacity-50 shadow-md hover:bg-[#4A4A35]"
                        >
                          <Columns size={16} />
                          Compare ({selectedListingIds.length})
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {savedListings.map((listing) => (
                        <div 
                          key={listing.id}
                          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                            selectedListingIds.includes(listing.id) 
                              ? 'border-[#5A5A40] bg-[#5A5A40]/5' 
                              : 'border-black/5 hover:border-[#5A5A40]/30'
                          }`}
                          onClick={() => {
                            setSelectedListingIds(prev => 
                              prev.includes(listing.id) 
                                ? prev.filter(id => id !== listing.id)
                                : [...prev, listing.id]
                            );
                          }}
                        >
                          <div className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            selectedListingIds.includes(listing.id)
                              ? 'bg-[#5A5A40] border-[#5A5A40]'
                              : 'border-black/20'
                          }`}>
                            {selectedListingIds.includes(listing.id) && <Check size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-serif font-medium truncate text-[#5A5A40]">{listing.title}</p>
                            <p className="text-[10px] text-[#8E9299] mt-1">
                              {new Date(listing.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavedListings(prev => prev.filter(l => l.id !== listing.id));
                              setSelectedListingIds(prev => prev.filter(id => id !== listing.id));
                            }}
                            className="p-1.5 hover:bg-black/5 rounded-lg text-[#8E9299] hover:text-red-500 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Listing Output */}
              {listingOutput && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {/* Save to Comparison Button */}
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      onClick={analyzeListingSEO}
                      disabled={isAnalyzingListing}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl transition-all border-2 hover:bg-black/5 disabled:opacity-50"
                      style={{ borderColor: `${activeStyle.primary}40`, color: activeStyle.primary }}
                    >
                      {isAnalyzingListing ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search size={16} />
                      )}
                      {isAnalyzingListing ? 'Analyzing...' : 'Analyze SEO & Reviews'}
                    </button>
                    {selectedListingIds.length >= 2 && (
                      <button
                        onClick={() => setShowComparison(true)}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl transition-all bg-[#5A5A40] text-white shadow-md hover:bg-[#4A4A35]"
                      >
                        <Columns size={16} />
                        Compare Selected ({selectedListingIds.length})
                      </button>
                    )}
                    <button
                      onClick={saveListingForComparison}
                      className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl transition-all border-2 hover:bg-black/5"
                      style={{ borderColor: `${activeStyle.primary}40`, color: activeStyle.primary }}
                    >
                      <Plus size={16} />
                      Add to Comparison
                    </button>
                  </div>

                  {/* Analysis Results */}
                  {listingAnalysis && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="bg-[#5A5A40]/5 border-2 border-[#5A5A40]/20 rounded-3xl p-8">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-[#5A5A40] text-white rounded-xl">
                            <Zap size={20} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]">AI SEO & Feedback Analysis</h3>
                            <p className="text-[10px] text-[#5A5A40]/60">Optimization suggestions based on current listing and reviews</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[#5A5A40]">
                              <Search size={16} />
                              <h4 className="text-xs font-bold uppercase tracking-widest">SEO Improvements</h4>
                            </div>
                            <div className="text-sm leading-relaxed text-[#5A5A40]/80 bg-white/50 p-4 rounded-2xl border border-[#5A5A40]/10">
                              <Markdown>{listingAnalysis.seoImprovements}</Markdown>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[#5A5A40]">
                              <MessageSquare size={16} />
                              <h4 className="text-xs font-bold uppercase tracking-widest">Review Integration</h4>
                            </div>
                            <div className="text-sm leading-relaxed text-[#5A5A40]/80 bg-white/50 p-4 rounded-2xl border border-[#5A5A40]/10">
                              <Markdown>{listingAnalysis.reviewIntegration}</Markdown>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-[#5A5A40]/10">
                          <div className="flex items-center gap-2 mb-4 text-[#5A5A40]">
                            <Tag size={16} />
                            <h4 className="text-xs font-bold uppercase tracking-widest">Additional High-Impact Keywords</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {listingAnalysis.suggestedKeywords.map((kw, i) => (
                              <span key={i} className="px-3 py-1 bg-white border border-[#5A5A40]/20 text-[#5A5A40] text-[10px] font-medium rounded-full">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Title Section */}
                  {listingOutput.generatedImage && (
                    <div className="bg-white rounded-3xl p-4 shadow-sm border-2 overflow-hidden" style={{ borderColor: `${activeStyle.primary}20` }}>
                      <div className="flex justify-between items-center mb-4 px-4 pt-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Generated Product Image</h3>
                        <a 
                          href={listingOutput.generatedImage} 
                          download="product-image.png"
                          className="p-2 hover:bg-black/5 rounded-full transition-all"
                          style={{ color: activeStyle.primary }}
                        >
                          <Download size={18} />
                        </a>
                      </div>
                      <img 
                        src={listingOutput.generatedImage} 
                        alt="Generated Product" 
                        className="w-full aspect-square object-cover rounded-2xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className={`bg-white rounded-3xl p-8 shadow-sm border-2`} style={{ borderColor: `${activeStyle.primary}20` }}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Suggested Title</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${listingOutput.title.length > (MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.titleLimit || 200) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {listingOutput.title.length} / {MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.titleLimit || 200}
                        </span>
                      </div>
                      <button onClick={() => handleCopy(listingOutput.title)} className="hover:opacity-70 transition-opacity" style={{ color: activeStyle.primary }}><Copy size={16} /></button>
                    </div>
                    <p className="text-xl font-serif text-[#1a1a1a]">{listingOutput.title}</p>
                  </div>

                  {/* Bullets Section */}
                  <div className={`bg-white rounded-3xl p-8 shadow-sm border-2`} style={{ borderColor: `${activeStyle.primary}20` }}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Bullet Points</h3>
                        <span className="text-[10px] text-[#8E9299] italic">Max {MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.bulletLimit || 500} chars per bullet</span>
                      </div>
                      <button onClick={() => handleCopy(listingOutput.bullets.join('\n'))} className="hover:opacity-70 transition-opacity" style={{ color: activeStyle.primary }}><Copy size={16} /></button>
                    </div>
                    <ul className="space-y-3">
                      {listingOutput.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <span className="font-bold" style={{ color: activeStyle.primary }}>•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Review Summary Section */}
                  {listingOutput.reviewSummary && (
                    <div className={`bg-white rounded-3xl p-8 shadow-sm border-2`} style={{ borderColor: `${activeStyle.primary}20` }}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Customer Testimonial / Review Summary</h3>
                        <button onClick={() => handleCopy(listingOutput.reviewSummary)} className="hover:opacity-70 transition-opacity" style={{ color: activeStyle.primary }}><Copy size={16} /></button>
                      </div>
                      <p className="text-sm leading-relaxed italic text-[#5A5A40]">"{listingOutput.reviewSummary}"</p>
                    </div>
                  )}

                  {/* Descriptions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`bg-white rounded-3xl p-8 shadow-sm border-2`} style={{ borderColor: `${activeStyle.primary}20` }}>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Short Description</h3>
                        </div>
                        <button onClick={() => handleCopy(listingOutput.shortDesc)} className="hover:opacity-70 transition-opacity" style={{ color: activeStyle.primary }}><Copy size={16} /></button>
                      </div>
                      <p className="text-sm leading-relaxed">{listingOutput.shortDesc}</p>
                    </div>
                    <div className={`bg-white rounded-3xl p-8 shadow-sm border-2`} style={{ borderColor: `${activeStyle.primary}20` }}>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Long Description</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${listingOutput.longDesc.length > (MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.descLimit || 2000) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {listingOutput.longDesc.length} / {MARKETPLACE_DEFAULTS[listingInputs.marketplace]?.descLimit || 2000}
                          </span>
                        </div>
                        <button onClick={() => handleCopy(listingOutput.longDesc)} className="hover:opacity-70 transition-opacity" style={{ color: activeStyle.primary }}><Copy size={16} /></button>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{listingOutput.longDesc}</p>
                    </div>
                  </div>

                  {/* Keywords Section */}
                  <div className={`bg-white rounded-3xl p-8 shadow-sm border-2`} style={{ borderColor: `${activeStyle.primary}20` }}>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${activeStyle.primary}15`, color: activeStyle.primary }}>
                          <Tag size={18} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">SEO Keywords</h3>
                          <p className="text-[10px] text-[#8E9299] mt-0.5">Optimized for Amazon & eBay search</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCopy(listingOutput.keywords.join(', '))} 
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all border border-black/5 hover:bg-black/5"
                        style={{ color: activeStyle.primary }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy All'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {listingOutput.keywords.map((keyword, idx) => (
                        <span 
                          key={idx} 
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm cursor-default`}
                          style={{ 
                            borderColor: `${activeStyle.primary}30`,
                            backgroundColor: `${activeStyle.primary}05`,
                            color: activeStyle.primary
                          }}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Competitor Audit & Comparison Tool */}
                  <div className="bg-white rounded-3xl p-8 shadow-sm border-2" style={{ borderColor: `${activeStyle.primary}20` }}>
                    <div className="flex justify-between items-start mb-6 border-b border-black/5 pb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${activeStyle.primary}15`, color: activeStyle.primary }}>
                          <Scale size={22} />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8E9299]">Competitor Audit Grid</span>
                          <h3 className="font-serif text-xl text-[#5A5A40] mt-0.5">Competitor Benchmark Tool</h3>
                          <p className="text-xs text-[#8E9299]">Compare keyword density, style elements, and persuasive tone to win e-commerce placements.</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 mb-6">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Competitor Product Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Ultra Soft Egyptian Cotton Duvet Cover - 3 Piece Bedding Set"
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all text-sm"
                          style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                          value={competitorTitle}
                          onChange={(e) => setCompetitorTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9299]">Competitor Features / Bullets / Description</label>
                        <textarea
                          placeholder="Paste your competitor's key bullet points, description, materials list or specifications here to run a semantic cross-analysis."
                          className="w-full h-32 px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 transition-all text-sm resize-y"
                          style={{ '--tw-ring-color': `${activeStyle.primary}40` } as React.CSSProperties}
                          value={competitorDesc}
                          onChange={(e) => setCompetitorDesc(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <button
                        onClick={analyzeCompetitor}
                        disabled={isAnalyzingCompetitor || !competitorTitle}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-6 py-3.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md hover:shadow-lg"
                        style={{ backgroundColor: activeStyle.primary }}
                      >
                        {isAnalyzingCompetitor ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Auditing Listings...</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp size={16} />
                            <span>Analyze & Benchmark Listing</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Competitor Audit Outcomes */}
                    {competitorAnalysis && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 pt-8 border-t border-black/5 space-y-8"
                      >
                        {/* 1. Keyword Overlap Map */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-4 flex items-center gap-2">
                            <Tag size={16} className="text-[#5A5A40]/80" />
                            E-Commerce Keyword Coverage Analysis
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Shared */}
                            <div className="bg-green-500/5 rounded-2xl p-5 border border-green-500/15">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-500/10 px-2 py-1 rounded-md">Shared Keywords</span>
                              <p className="text-[11px] text-[#8E9299] mt-2 mb-3">Target terms successfully targeted by both listings.</p>
                              <div className="flex flex-wrap gap-1.5">
                                {competitorAnalysis.keywordComparison?.matched?.length ? (
                                  competitorAnalysis.keywordComparison.matched.map((kw, i) => (
                                    <span key={i} className="text-[11px] bg-white border border-green-500/20 px-2.5 py-1 rounded-lg text-green-800 font-medium">{kw}</span>
                                  ))
                                ) : (
                                  <span className="text-xs text-green-700/60 italic">No keyword overlap detected.</span>
                                )}
                              </div>
                            </div>

                            {/* Only Ours */}
                            <div className="bg-[#5A5A40]/5 rounded-2xl p-5 border border-[#5A5A40]/15">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-1 rounded-md">Our Exclusives</span>
                              <p className="text-[11px] text-[#8E9299] mt-2 mb-3">Strong keyword advantages present strictly on your side.</p>
                              <div className="flex flex-wrap gap-1.5">
                                {competitorAnalysis.keywordComparison?.onlyOurs?.length ? (
                                  competitorAnalysis.keywordComparison.onlyOurs.map((kw, i) => (
                                    <span key={i} className="text-[11px] bg-white border border-[#5A5A40]/20 px-2.5 py-1 rounded-lg text-[#5A5A40] font-medium">{kw}</span>
                                  ))
                                ) : (
                                  <span className="text-xs text-[#5A5A40]/60 italic">No exclusive strengths.</span>
                                )}
                              </div>
                            </div>

                            {/* Only Competitor */}
                            <div className="bg-amber-500/5 rounded-2xl p-5 border border-amber-500/15">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-500/10 px-2 py-1 rounded-md">Competitor Exclusives</span>
                              <p className="text-[11px] text-[#8E9299] mt-2 mb-3">High-relevance terms they use which you might consider adding.</p>
                              <div className="flex flex-wrap gap-1.5">
                                {competitorAnalysis.keywordComparison?.onlyCompetitor?.length ? (
                                  competitorAnalysis.keywordComparison.onlyCompetitor.map((kw, i) => (
                                    <span key={i} className="text-[11px] bg-white border border-amber-500/20 px-2.5 py-1 rounded-lg text-amber-800 font-medium">{kw}</span>
                                  ))
                                ) : (
                                  <span className="text-xs text-amber-700/60 italic">They have no major exclusive keywords.</span>
                                )}
                              </div>
                            </div>

                            {/* Missed Opportunities */}
                            <div className="bg-blue-500/5 rounded-2xl p-5 border border-blue-500/15">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-500/10 px-2 py-1 rounded-md">Untapped High-Volume Gems</span>
                              <p className="text-[11px] text-[#8E9299] mt-2 mb-3">Keywords neither has that could drive serious extra traffic.</p>
                              <div className="flex flex-wrap gap-1.5">
                                {competitorAnalysis.keywordComparison?.missedHighValue?.length ? (
                                  competitorAnalysis.keywordComparison.missedHighValue.map((kw, i) => (
                                    <span key={i} className="text-[11px] bg-white border border-blue-500/20 px-2.5 py-1 rounded-lg text-blue-800 font-medium">{kw}</span>
                                  ))
                                ) : (
                                  <span className="text-xs text-blue-700/60 italic">None suggested.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. Style, Persona & Performance Scoring */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-4 flex items-center gap-2">
                            <Sparkles size={16} className="text-[#5A5A40]/80" />
                            Listing Persona & Style Diagnosis
                          </h4>

                          <div className="bg-[#A39B81]/10 rounded-2xl p-6 border border-[#A39B81]/25">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              <div>
                                <span className="text-[10px] tracking-widest font-extrabold uppercase text-[#5A5A40]/70">Your Brand Persona</span>
                                <p className="text-sm font-semibold text-[#1a1a1a] mt-1">{competitorAnalysis.toneAndStyle?.oursTone || 'Professional & Informative'}</p>
                              </div>
                              <div>
                                <span className="text-[10px] tracking-widest font-extrabold uppercase text-amber-700">Competitor Brand Persona</span>
                                <p className="text-sm font-semibold text-[#1a1a1a] mt-1">{competitorAnalysis.toneAndStyle?.competitorTone || 'Persuasive & Value-Driven'}</p>
                              </div>
                            </div>

                            <p className="text-sm leading-relaxed text-[#5A5A40] border-t border-black/5 pt-4 mb-6 italic">
                              "{competitorAnalysis.toneAndStyle?.comparisonSummary}"
                            </p>

                            {/* Benchmark Meters */}
                            <div className="space-y-4 border-t border-black/5 pt-6">
                              <span className="text-[11px] tracking-widest font-extrabold uppercase text-[#5A5A40]">A/B Performance Benchmarks</span>

                              {/* SEO Score */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>Search Visibility & SEO Coverage</span>
                                  <span>You: {competitorAnalysis.toneAndStyle?.ourScores?.seo || 0}% vs Comp: {competitorAnalysis.toneAndStyle?.competitorScores?.seo || 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden flex">
                                  <div 
                                    className="h-full rounded-r-none rounded-l-full" 
                                    style={{ width: `${competitorAnalysis.toneAndStyle?.ourScores?.seo || 0}%`, backgroundColor: activeStyle.primary }}
                                  />
                                  <div 
                                    className="h-full bg-slate-400 opacity-60 rounded-l-none rounded-r-full" 
                                    style={{ width: `${competitorAnalysis.toneAndStyle?.competitorScores?.seo || 0}%` }}
                                  />
                                </div>
                              </div>

                              {/* Conv Score */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>Conversion Persuasion & Objections Handling</span>
                                  <span>You: {competitorAnalysis.toneAndStyle?.ourScores?.conversion || 0}% vs Comp: {competitorAnalysis.toneAndStyle?.competitorScores?.conversion || 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden flex">
                                  <div 
                                    className="h-full rounded-r-none rounded-l-full" 
                                    style={{ width: `${competitorAnalysis.toneAndStyle?.ourScores?.conversion || 0}%`, backgroundColor: activeStyle.primary }}
                                  />
                                  <div 
                                    className="h-full bg-slate-400 opacity-60 rounded-l-none rounded-r-full" 
                                    style={{ width: `${competitorAnalysis.toneAndStyle?.competitorScores?.conversion || 0}%` }}
                                  />
                                </div>
                              </div>

                              {/* Clarity Score */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>Reading Clarity & Technical Layout Checks</span>
                                  <span>You: {competitorAnalysis.toneAndStyle?.ourScores?.clarity || 0}% vs Comp: {competitorAnalysis.toneAndStyle?.competitorScores?.clarity || 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden flex">
                                  <div 
                                    className="h-full rounded-r-none rounded-l-full" 
                                    style={{ width: `${competitorAnalysis.toneAndStyle?.ourScores?.clarity || 0}%`, backgroundColor: activeStyle.primary }}
                                  />
                                  <div 
                                    className="h-full bg-slate-400 opacity-60 rounded-l-none rounded-r-full" 
                                    style={{ width: `${competitorAnalysis.toneAndStyle?.competitorScores?.clarity || 0}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. Competitive Strategic Bullet Points */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-4 flex items-center gap-2">
                            <Bot size={16} className="text-[#5A5A40]/80" />
                            Tactical Directives to Beat this Competitor
                          </h4>
                          <div className="space-y-3">
                            {competitorAnalysis.strategicSuggestions?.map((suggestion, i) => (
                              <div key={i} className="flex gap-3 bg-[#5A5A40]/5 p-4 rounded-xl border border-black/5 items-start">
                                <div className="text-xs font-bold w-5 h-5 rounded-full bg-[#5A5A40] text-white flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                                <p className="text-xs text-[#5A5A40]/90 leading-relaxed font-sans">{suggestion}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {mode === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden flex flex-col h-[600px]">
                {/* Chat Header */}
                <div className="p-6 border-b border-black/5 flex justify-between items-center bg-[#f9f9f7]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center text-white">
                      <Bot size={20} />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg text-[#5A5A40]">MerchantAI Assistant</h3>
                      <p className="text-[10px] uppercase tracking-widest text-[#8E9299] font-bold">Always here to help</p>
                    </div>
                  </div>
                  <button 
                    onClick={clearChat}
                    className="p-2 hover:bg-black/5 rounded-full transition-all text-[#8E9299]"
                    title="Clear Conversation"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfcfb]">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                      <Sparkles size={48} className="text-[#5A5A40]" />
                      <div>
                        <p className="font-serif text-xl text-[#5A5A40]">How can I help you today?</p>
                        <p className="text-sm">Ask about products, brand guidelines, or support tips.</p>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                            msg.role === 'user' ? 'bg-[#5A5A40] text-white' : 'bg-white border border-black/10 text-[#5A5A40]'
                          }`}>
                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                          </div>
                          <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                            msg.role === 'user' 
                              ? 'bg-[#5A5A40] text-white rounded-tr-none shadow-sm' 
                              : 'bg-white border border-black/5 text-[#1a1a1a] rounded-tl-none shadow-sm'
                          }`}>
                            {msg.text}
                            <div className={`text-[9px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-3 max-w-[80%]">
                        <div className="w-8 h-8 rounded-full bg-white border border-black/10 flex items-center justify-center text-[#5A5A40]">
                          <Bot size={14} />
                        </div>
                        <div className="bg-white border border-black/5 p-4 rounded-2xl rounded-tl-none shadow-sm">
                          <Loader2 size={16} className="animate-spin text-[#5A5A40]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-black/5 bg-white">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex gap-3"
                  >
                    <input
                      type="text"
                      placeholder="Type your message here..."
                      className="flex-1 px-6 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatLoading}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isChatLoading}
                      className="bg-[#5A5A40] text-white p-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplates && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowTemplates(false);
                setTemplateModalView('list');
                setEditingTemplate(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white z-10">
                <div className="flex items-center gap-4">
                  <h3 className="font-serif text-2xl text-[#5A5A40]">
                    {templateModalView === 'form' 
                      ? (editingTemplate ? 'Edit Template' : 'New Template') 
                      : 'Reply Templates'}
                  </h3>
                  {templateModalView === 'list' && (
                    <button 
                      onClick={createNewTemplate}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white bg-[#5A5A40] px-3 py-1.5 rounded-lg hover:opacity-90 transition-all shadow-sm"
                    >
                      <Plus size={12} />
                      Create New
                    </button>
                  )}
                </div>
                <button onClick={() => {
                  setShowTemplates(false);
                  setTemplateModalView('list');
                  setEditingTemplate(null);
                  setTemplateForm({ name: '', content: '', issueType: '', tags: [] });
                }} className="p-2 hover:bg-black/5 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {templateModalView === 'form' ? (
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Template Name</label>
                        <input
                          type="text"
                          placeholder="e.g., Damaged Item Policy"
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm transition-all"
                          style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                          value={templateForm.name}
                          onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Issue Type</label>
                        <select
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm transition-all appearance-none"
                          style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                          value={templateForm.issueType}
                          onChange={(e) => setTemplateForm({ ...templateForm, issueType: e.target.value })}
                        >
                          <option>General Inquiry</option>
                          <option>Damaged Item</option>
                          <option>Wrong Item Received</option>
                          <option>Missing Item</option>
                          <option>Delivery Delay</option>
                          <option>Return Request</option>
                          <option>Negative Feedback Removal - Seller Order</option>
                          <option>Negative Feedback Removal - Product Review</option>
                          <option>Custom</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Tags (comma separated)</label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E9299]" size={16} />
                        <input
                          type="text"
                          placeholder="e.g., refund, urgent, bedding"
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm transition-all"
                          style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                          value={templateForm.tags.join(', ')}
                          onChange={(e) => setTemplateForm({ ...templateForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {templateForm.tags.map((tag, idx) => (
                          <span key={idx} className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            {tag}
                            <button onClick={() => setTemplateForm({ ...templateForm, tags: templateForm.tags.filter((_, i) => i !== idx) })} className="hover:text-red-500">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#8E9299]">Template Content</label>
                        <span className="text-[10px] text-[#8E9299] italic">Use [Customer Name] and [Order ID] as placeholders</span>
                      </div>
                      <textarea
                        rows={10}
                        className="w-full px-4 py-4 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm resize-none leading-relaxed transition-all"
                        style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                        value={templateForm.content}
                        onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                        placeholder="Dear [Customer Name], ..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-6 py-4 bg-[#f9f9f7] border-b border-black/5 space-y-4 sticky top-0 z-10">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E9299]" size={16} />
                        <input 
                          type="text"
                          placeholder="Search templates by name, content or type..."
                          className="w-full pl-12 pr-12 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-white text-sm shadow-sm"
                          style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                        />
                        {templateSearch && (
                          <button 
                            onClick={() => setTemplateSearch('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E9299] hover:text-[#5A5A40]"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {allIssueTypes.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <div className="flex items-center gap-2 mr-2">
                            <Filter size={12} className="text-[#8E9299]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299]">Filter:</span>
                          </div>
                          <button
                            onClick={() => {
                              if (selectedIssueTypes.length === allIssueTypes.length) {
                                setSelectedIssueTypes([]);
                              } else {
                                setSelectedIssueTypes(allIssueTypes);
                              }
                            }}
                            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                              selectedIssueTypes.length === allIssueTypes.length
                                ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                : 'bg-white text-[#8E9299] border-black/10 hover:border-[#5A5A40]/30'
                            }`}
                          >
                            {selectedIssueTypes.length === allIssueTypes.length ? 'Deselect All' : 'Select All'}
                          </button>
                          <div className="h-4 w-[1px] bg-black/10 mx-1" />
                          {allIssueTypes.map(type => {
                            const count = templates.filter(t => t.issueType === type).length;
                            return (
                              <button
                                key={type}
                                onClick={() => {
                                  setSelectedIssueTypes(prev => 
                                    prev.includes(type) 
                                      ? prev.filter(t => t !== type) 
                                      : [...prev, type]
                                  );
                                }}
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 ${
                                  selectedIssueTypes.includes(type)
                                    ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                    : 'bg-white text-[#8E9299] border-black/10 hover:border-[#5A5A40]/30'
                                }`}
                              >
                                {type}
                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${
                                  selectedIssueTypes.includes(type) ? 'bg-white/20 text-white' : 'bg-black/5 text-[#8E9299]'
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                          {selectedIssueTypes.length > 0 && (
                            <button
                              onClick={() => setSelectedIssueTypes([])}
                              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"
                            >
                              Clear Filters
                            </button>
                          )}
                          <button
                            onClick={restoreDefaultTemplates}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-[#8E9299] hover:bg-black/5 transition-all ml-auto"
                          >
                            Restore Defaults
                          </button>
                        </div>
                      )}

                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <div className="flex items-center gap-2 mr-2">
                            <Tag size={12} className="text-[#8E9299]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299]">Tags:</span>
                          </div>
                          {allTags.map(tag => (
                            <button
                              key={tag}
                              onClick={() => {
                                setSelectedTags(prev => 
                                  prev.includes(tag) 
                                    ? prev.filter(t => t !== tag) 
                                    : [...prev, tag]
                                );
                              }}
                              className={`text-[10px] font-medium px-3 py-1.5 rounded-lg border transition-all ${
                                selectedTags.includes(tag)
                                  ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                                  : 'bg-white text-[#8E9299] border-black/10 hover:border-[#5A5A40]/30'
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                          {selectedTags.length > 0 && (
                            <button
                              onClick={() => setSelectedTags([])}
                              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"
                            >
                              Clear Tags
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-6 space-y-4">
                      {filteredTemplates.length === 0 ? (
                        <div className="text-center py-16 text-[#8E9299]">
                          <FolderOpen size={64} className="mx-auto mb-4 opacity-10" />
                          <p className="text-lg font-serif italic">{templateSearch || selectedIssueTypes.length > 0 ? 'No templates match your search.' : 'No templates saved yet.'}</p>
                          <button 
                            onClick={createNewTemplate}
                            className="mt-4 text-[#5A5A40] font-bold uppercase tracking-widest text-xs hover:underline"
                          >
                            Create your first template
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {filteredTemplates.map(template => (
                            <div 
                              key={template.id}
                              onClick={() => loadTemplate(template)}
                              className="group p-5 rounded-2xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-[#5A5A40]/5 cursor-pointer transition-all flex justify-between items-start bg-white hover:shadow-md"
                            >
                              <div className="space-y-2 flex-1 pr-4">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-bold text-[#1a1a1a] text-lg">
                                    {highlightText(template.name, templateSearch)}
                                  </h4>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-black/5 text-[#8E9299] font-bold uppercase tracking-widest">
                                    {highlightText(template.issueType, templateSearch)}
                                  </span>
                                </div>
                                {template.tags && template.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {template.tags.map((tag, idx) => (
                                      <span key={idx} className="text-[9px] bg-[#5A5A40]/5 text-[#5A5A40] px-2 py-0.5 rounded-full font-medium border border-[#5A5A40]/10">
                                        #{highlightText(tag, templateSearch)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-sm text-[#1a1a1a]/60 line-clamp-2 leading-relaxed">
                                  {highlightText(template.content, templateSearch)}
                                </p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button 
                                  onClick={(e) => startEditing(template, e)}
                                  className="p-2.5 text-[#8E9299] hover:text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-xl transition-all"
                                  title="Edit Template"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button 
                                  onClick={(e) => deleteTemplate(template.id, e)}
                                  className="p-2.5 text-[#8E9299] hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  title="Delete Template"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 bg-[#f9f9f7] border-t border-black/5 flex justify-between items-center">
                <div className="text-[10px] text-[#8E9299] font-bold uppercase tracking-widest">
                  {templateModalView === 'list' ? `${filteredTemplates.length} Templates Available` : 'Unsaved Changes'}
                </div>
                <div className="flex gap-3">
                  {templateModalView === 'form' ? (
                    <>
                      <button 
                        onClick={() => setTemplateModalView('list')}
                        className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-[#8E9299] hover:bg-black/5 rounded-xl transition-all"
                      >
                        Back to List
                      </button>
                      <button 
                        onClick={saveTemplate}
                        className="px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-[#5A5A40] rounded-xl hover:opacity-90 transition-all shadow-md"
                      >
                        {editingTemplate ? 'Update' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => {
                        setShowTemplates(false);
                        setTemplateModalView('list');
                        setEditingTemplate(null);
                      }}
                      className="px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-[#5A5A40] rounded-xl hover:opacity-90 transition-all shadow-md"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email Draft Modal */}
      <AnimatePresence>
        {showEmailDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailDraft(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40]">
                    <Mail size={20} />
                  </div>
                  <h3 className="font-serif text-2xl text-[#5A5A40]">Email Draft</h3>
                </div>
                <button 
                  onClick={() => setShowEmailDraft(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-all text-[#8E9299]"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299]">To</label>
                  <input 
                    type="text"
                    value={emailDraft.to}
                    onChange={(e) => setEmailDraft({ ...emailDraft, to: e.target.value })}
                    placeholder="customer@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm transition-all"
                    style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299]">Subject</label>
                  <input 
                    type="text"
                    value={emailDraft.subject}
                    onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                    placeholder="Email Subject"
                    className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm font-medium transition-all"
                    style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299]">Message Body</label>
                  <textarea 
                    rows={12}
                    value={emailDraft.body}
                    onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                    className="w-full px-4 py-4 rounded-xl border border-black/10 focus:outline-none focus:ring-2 bg-[#f9f9f7] text-sm leading-relaxed resize-none transition-all"
                    style={{ '--tw-ring-color': '#5A5A4040' } as React.CSSProperties}
                  />
                </div>
              </div>

              <div className="p-6 bg-[#f9f9f7] border-t border-black/5 flex justify-end gap-3">
                <button 
                  onClick={() => setShowEmailDraft(false)}
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-[#8E9299] hover:bg-black/5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleCopy(`To: ${emailDraft.to}\nSubject: ${emailDraft.subject}\n\n${emailDraft.body}`);
                    setShowEmailDraft(false);
                  }}
                  className="px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-[#5A5A40] rounded-xl hover:opacity-90 transition-all shadow-md flex items-center gap-2"
                >
                  <Copy size={14} />
                  Copy Full Draft
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {showComparison && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComparison(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center bg-white z-10">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40]">
                    <Columns size={20} />
                  </div>
                  <h3 className="font-serif text-2xl text-[#5A5A40]">Product Comparison</h3>
                </div>
                <button 
                  onClick={() => setShowComparison(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-all text-[#8E9299]"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-x-auto p-6 bg-[#fcfcfb]">
                <div className="flex gap-6 min-w-max pb-4">
                  {savedListings
                    .filter(l => selectedListingIds.includes(l.id))
                    .map((listing) => (
                      <div key={listing.id} className="w-[350px] flex flex-col gap-6 relative group">
                        {/* Remove from Comparison Button */}
                        <button
                          onClick={() => setSelectedListingIds(prev => prev.filter(id => id !== listing.id))}
                          className="absolute -top-2 -right-2 p-2 bg-white rounded-full shadow-lg border border-black/5 text-red-500 opacity-0 group-hover:opacity-100 transition-all z-20 hover:bg-red-50"
                          title="Remove from comparison"
                        >
                          <X size={16} />
                        </button>

                        {/* Image */}
                        <div className="bg-white rounded-2xl p-3 shadow-sm border border-black/5">
                          {listing.generatedImage ? (
                            <img 
                              src={listing.generatedImage} 
                              alt={listing.title} 
                              className="w-full aspect-square object-cover rounded-xl"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-[#5A5A40]/5 rounded-xl flex items-center justify-center text-[#8E9299]">
                              <ImageIcon size={32} />
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 flex-1">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] mb-2">Title</h4>
                          <p className="text-sm font-serif font-medium text-[#1a1a1a] leading-snug">{listing.title}</p>
                        </div>

                        {/* Bullets */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] mb-3">Key Features</h4>
                          <ul className="space-y-2">
                            {listing.bullets.map((bullet, idx) => (
                              <li key={idx} className="text-[11px] leading-relaxed flex gap-2">
                                <span className="text-[#5A5A40] font-bold">•</span>
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Short Description */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] mb-2">Short Description</h4>
                          <p className="text-[11px] leading-relaxed text-[#5A5A40]">{listing.shortDesc}</p>
                        </div>

                        {/* Long Description */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] mb-2">Long Description</h4>
                          <p className="text-[11px] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap">{listing.longDesc}</p>
                        </div>

                        {/* Review Summary */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] mb-2">Review Summary</h4>
                          <p className="text-[11px] leading-relaxed italic text-[#8E9299]">"{listing.reviewSummary}"</p>
                        </div>

                        {/* Keywords */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8E9299] mb-2">SEO Keywords</h4>
                          <div className="flex flex-wrap gap-1">
                            {listing.keywords.slice(0, 8).map((kw, idx) => (
                              <span key={idx} className="text-[9px] px-2 py-0.5 bg-[#5A5A40]/5 text-[#5A5A40] rounded-full border border-[#5A5A40]/10">
                                {kw}
                              </span>
                            ))}
                            {listing.keywords.length > 8 && <span className="text-[9px] text-[#8E9299]">+{listing.keywords.length - 8} more</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-6 border-t border-black/5 bg-white flex justify-end">
                <button
                  onClick={() => setShowComparison(false)}
                  className="px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-[#5A5A40] rounded-xl hover:opacity-90 transition-all shadow-md"
                >
                  Close Comparison
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Article Reader Modal */}
      <AnimatePresence>
        {selectedArticleId !== null && (() => {
          const article = NICHE_ARTICLES.find(a => a.id === selectedArticleId);
          if (!article) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedArticleId(null)}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="relative bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-black/5"
              >
                {/* Modal Header */}
                <div className="p-6 md:p-8 border-b border-black/5 flex justify-between items-start bg-white sticky top-0 z-10">
                  <div className="space-y-1 pr-6">
                    <span className="text-[10px] font-bold font-mono tracking-wider bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-md">
                      {article.category}
                    </span>
                    <h3 className="font-serif text-xl md:text-2xl font-bold text-[#5A5A40] mt-3">
                      {article.title}
                    </h3>
                    <div className="flex gap-4 text-[10px] text-[#8E9299] font-semibold font-mono">
                      <span>{article.date}</span>
                      <span>•</span>
                      <span>{article.readTime}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedArticleId(null)}
                    className="p-2 hover:bg-black/5 rounded-full transition-all text-[#8E9299] shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#fdfdfb] markdown-body text-sm text-gray-800 leading-relaxed font-sans prose prose-slate">
                  <Markdown>{article.content}</Markdown>
                </div>

                {/* Modal Footer */}
                <div className="p-4 md:p-6 border-t border-black/5 bg-white flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                  <div>
                    {showMockAds ? (
                      <span className="text-[9px] uppercase tracking-wider font-mono text-gray-400">Contextual Sponsor Verified Information</span>
                    ) : (
                      <span className="text-[9px] font-sans text-gray-400">Merchant Hub Original Study</span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedArticleId(null)}
                    className="w-full md:w-auto px-7 py-3 text-xs font-bold uppercase tracking-widest text-white bg-[#5A5A40] rounded-xl hover:opacity-90 transition-all shadow-md cursor-pointer"
                  >
                    Done Reading
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto py-12 px-4 md:px-8 border-t border-black/5 mt-20 text-center space-y-6">
        <div className="flex flex-wrap justify-center gap-6 text-xs uppercase tracking-widest font-extrabold text-[#8E9299]">
          <button onClick={() => { setMode('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">Home</button>
          <button onClick={() => { setMode('home'); setTimeout(() => document.getElementById('merchant-tools')?.scrollIntoView({ behavior: 'smooth' }), 120); }} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">Tool</button>
          <button onClick={() => { setMode('home'); setTimeout(() => document.getElementById('original-articles')?.scrollIntoView({ behavior: 'smooth' }), 120); }} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">Guides</button>
          <button onClick={() => { setMode('home'); setTimeout(() => document.getElementById('faqs-hub')?.scrollIntoView({ behavior: 'smooth' }), 120); }} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">FAQ</button>
          <button onClick={() => setShowAbout(true)} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">About</button>
          <button onClick={() => setShowContact(true)} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">Contact</button>
          <button onClick={() => setShowPrivacy(true)} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">Privacy Policy</button>
          <button onClick={() => setShowTerms(true)} className="hover:text-[#5A5A40] transition-all bg-transparent border-0 cursor-pointer">Terms</button>
        </div>
        <p className="text-xs text-[#8E9299] uppercase tracking-widest font-semibold">
          © 2026 MerchantAI. All rights reserved.
        </p>
      </footer>

      {/* About Modal */}
      <AnimatePresence>
        {showAbout && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-8 border border-black/5 shadow-2xl relative overflow-y-auto max-h-[85vh]"
            >
              <button 
                onClick={() => setShowAbout(false)}
                className="absolute top-6 right-6 p-2 text-[#8E9299] hover:bg-black/5 hover:text-black rounded-full transition-all bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
              <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-md font-mono font-bold tracking-wider uppercase">Behind MerchantAI</span>
              <h3 className="font-serif text-2xl md:text-3xl text-[#5A5A40] font-bold mt-4 mb-2">Empowering Global E-Commerce</h3>
              <p className="text-xs text-[#8E9299] mb-6">Designed as a direct operational aid for digital merchants, agencies, and dropshippers.</p>
              
              <div className="space-y-4 text-xs text-gray-700 leading-relaxed font-sans">
                <p>
                  MerchantAI was created with a clear and singular purpose: to democratize advanced visual and text assets for standard business merchants. Modern marketplaces like Amazon, eBay, Shopify, and Etsy have rigid, complex, and constantly shifting guidelines. For a growing retailer, complying with layout constraints, character constraints, and disputing random buyer complaints takes hours of focus.
                </p>
                <p>
                  Our system aligns deep-learning models (fine-tuned server-side via Gemini) with real product catalogs, active VAT compliance laws, international currencies, and logistics courier procedures.
                </p>
                <div className="grid grid-cols-3 gap-4 bg-[#FAF9F5] p-4 rounded-2xl border border-black/5 text-center mt-6">
                  <div>
                    <span className="font-serif text-xl font-bold text-[#5A5A40]">100% Free</span>
                    <p className="text-[9px] uppercase tracking-wider text-[#8E9299] font-semibold mt-1">Privacy Focused</p>
                  </div>
                  <div className="border-x border-black/5">
                    <span className="font-serif text-xl font-bold text-[#5A5A40]">15+ Countries</span>
                    <p className="text-[9px] uppercase tracking-wider text-[#8E9299] font-semibold mt-1">Fully Localized</p>
                  </div>
                  <div>
                    <span className="font-serif text-xl font-bold text-[#5A5A40]">Gemini Pro</span>
                    <p className="text-[9px] uppercase tracking-wider text-[#8E9299] font-semibold mt-1">State of the Art AI</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContact && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl p-8 border border-black/5 shadow-2xl relative overflow-y-auto max-h-[85vh]"
            >
              <button 
                onClick={() => setShowContact(false)}
                className="absolute top-6 right-6 p-2 text-[#8E9299] hover:bg-black/5 hover:text-black rounded-full transition-all bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
              <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-md font-mono font-bold tracking-wider uppercase">Reach Out</span>
              <h3 className="font-serif text-2xl text-[#5A5A40] font-bold mt-4 mb-2">Contact Merchant Support Desk</h3>
              <p className="text-xs text-[#8E9299] mb-6">Have business-integration requests, custom taxonomy needs, or sponsored ad proposals? Connect directly.</p>
              
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert("Merchant support query submitted. Our team will verify and reply via email in 24 business hours."); setShowContact(false); }}>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-[#8E9299] font-mono block">Registered Merchant Email</label>
                  <input type="email" required placeholder="name@yourstore.com" className="w-full px-4 py-2.5 bg-[#FAF9F5] rounded-xl border border-black/10 text-sm focus:outline-none text-[#1a1a1a]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-[#8E9299] font-mono block">Query Type</label>
                  <select className="w-full px-4 py-2.5 bg-[#FAF9F5] rounded-xl border border-black/10 text-sm bg-white text-[#1a1a1a]">
                    <option>Ad Sponsor & Merchant Placement Proposals</option>
                    <option>Custom API Access / Enterprise Integrations</option>
                    <option>TOS Policy Concerns / Support Complaints</option>
                    <option>Feedback & Feature Requests</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-[#8E9299] font-mono block">Context Detail / Message</label>
                  <textarea rows={4} required placeholder="Detail your integration request or proposed sponsorship alignment parameters here..." className="w-full px-4 py-2.5 bg-[#FAF9F5] rounded-xl border border-black/10 text-sm focus:outline-none resize-none text-[#1a1a1a]"></textarea>
                </div>
                <button type="submit" className="w-full py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-all shadow cursor-pointer border-0">
                  Transmit Dispute Support Ticket
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-8 border border-black/5 shadow-2xl relative overflow-y-auto max-h-[85vh]"
            >
              <button 
                onClick={() => setShowPrivacy(false)}
                className="absolute top-6 right-6 p-2 text-[#8E9299] hover:bg-black/5 hover:text-black rounded-full transition-all bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
              <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-md font-mono font-bold tracking-wider uppercase">Information Security</span>
              <h3 className="font-serif text-2xl md:text-3xl text-[#5A5A40] font-bold mt-4 mb-2">Merchant Privacy Policy</h3>
              <p className="text-xs text-[#8E9299] mb-6">Last Revised: June 19, 2026. Zero-Data retention e-commerce framework declaration.</p>
              
              <div className="space-y-4 text-xs text-gray-700 leading-relaxed font-sans max-h-[45vh] overflow-y-auto pr-2">
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">1. Data Minimization Principle</h4>
                <p>
                  MerchantAI values seller sovereignty and integrity. The web system is engineered to not store seller passwords, catalogs, API private keys, or client customer listings. All inputs, variables, and draft processes are bound to client-side localStorage and state containers.
                </p>
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">2. Server-side Operations</h4>
                <p>
                  Whenever you click generate, parameters are proxied securely to Gemini server APIs. These calls do not include persistent database logs or secondary training telemetry, protecting your unique competitive copy advantages.
                </p>
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">3. Cookie Alignment & Sponsored Ads</h4>
                <p>
                  We compile with Google AdSense terms and privacy protocols. Contextual cookie caches may analyze non-sensitive seller patterns to serve relevant, merchant-approved ad banners (such as logistical, warehousing, or packing companies details) to maintain our zero-cost access model.
                </p>
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">4. User Sovereignty & Local Deletion</h4>
                <p>
                  At any point, utilizing clear features (like "Reset Workspace" or "Clear Logs") wipes all local storage structures instantly, guaranteeing complete data sovereignty.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Terms of Service Modal */}
      <AnimatePresence>
        {showTerms && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-8 border border-black/5 shadow-2xl relative overflow-y-auto max-h-[85vh]"
            >
              <button 
                onClick={() => setShowTerms(false)}
                className="absolute top-6 right-6 p-2 text-[#8E9299] hover:bg-black/5 hover:text-black rounded-full transition-all bg-transparent border-0 cursor-pointer"
              >
                <X size={18} />
              </button>
              <span className="text-[9px] bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-md font-mono font-bold tracking-wider uppercase">Rules of Engagement</span>
              <h3 className="font-serif text-2xl md:text-3xl text-[#5A5A40] font-bold mt-4 mb-2">Terms & Compliances</h3>
              <p className="text-xs text-[#8E9299] mb-6">Last Revised: June 19, 2026. Global merchant portal code of conduct.</p>
              
              <div className="space-y-4 text-xs text-gray-700 leading-relaxed font-sans max-h-[45vh] overflow-y-auto pr-2">
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">1. Acceptable Utilization Limits</h4>
                <p>
                  MerchantAI is built to provide advisory support layouts. All generated refund responses, customer dispute protocols, and headlines must be pre-vetted by a human merchant representative before posting.
                </p>
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">2. Platform Disclaimers</h4>
                <p>
                  MerchantAI has no official, legal, or corporate affiliation with Amazon.com, Inc., eBay Inc., Shopify Inc., Etsy, Inc., Walmart Inc., or Google LLC. Any mention of active trademark listings, ranking algorithms, or compliance constraints are purely descriptive and based on public knowledge of modern seller environments.
                </p>
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">3. Ad-supported Terms</h4>
                <p>
                  By accessing our sandbox systems, you acknowledge that MerchantAI may present respectful, contextual sponsorship units. You are explicitly forbidden from using reverse-proxies or adblock rules to scraper the underlying model engines without supporting the platform's sponsors.
                </p>
                <h4 className="font-serif font-bold text-sm text-[#5A5A40]">4. No-Liability Code</h4>
                <p>
                  Under no circumstances shall MerchantAI or its maintainers be liable for store actions, organic ranking decline, negative customer ratings, account suspensions, or VAT miscalculations. Real-world commerce depends on numerous live variables; always use professional judgment.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
