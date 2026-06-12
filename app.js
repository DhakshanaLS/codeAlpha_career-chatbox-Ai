/**
 * Upgraded ChatStudio Dashboard Controller (app.js)
 * Coordinates inputs, preview updates, analytics, lead inbox, target website swapper,
 * dynamic theme switcher, voice recognition, cloud deploy console, and session transcripts.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------------------------
  // STATE DEFINITIONS
  // ----------------------------------------------------
  const state = {
    branding: {
      name: "Chat",
      avatar: "🤖",
      domain: "saas",
      modelType: "retrieval",
      systemPrompt: "You are a helpful customer support assistant.",
      greeting: "Hello there! 👋 How can I help you today?",
      primaryColor: "#6366f1",
      userBgColor: "#4f46e5",
      position: "bottom-right",
      suggestions: ["Pricing Plans", "Key Features", "Contact Sales", "Support"],
      fontFamily: "Inter",
      borderRadius: 12,
      headerGradient: "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)",
      leadCapture: {
        enabled: false,
        fields: ["name", "email"],
        triggerAfterMessages: 2,
        completed: false
      }
    },
    intents: [], 
    leads: [], 
    transcripts: [], // logged session transcripts
    analytics: {
      totalMessages: 0,
      matches: 0,
      fallbacks: 0,
      confidenceSum: 0,
      triggerCounts: {
        welcome: 1, 
        pricing: 0,
        features: 0,
        support: 0,
        contact: 0,
        fallback: 0
      }
    }
  };

  let chatbotInstance = null;
  let syncOnline = false; // Is backend server detected?
  const BACKEND_URL = ""; // Relative url for same-origin routes

  // DOM elements cache
  const elements = {
    // Navigation
    navItems: document.querySelectorAll(".nav-item"),
    tabPanes: document.querySelectorAll(".tab-pane"),

    // Dashboard Bar & Toggles
    backendStatusBadge: document.getElementById("backend-status-badge"),
    dashboardThemeSelect: document.getElementById("dashboard-theme-select"),

    // Domain & Model selectors
    domainSelect: document.getElementById("domain-select"),
    modelTypeSelect: document.getElementById("model-type-select"),
    systemPromptGroup: document.getElementById("system-prompt-group"),
    systemPromptInput: document.getElementById("system-prompt-input"),

    // Basic Settings
    botNameInput: document.getElementById("bot-name-input"),
    botAvatarInput: document.getElementById("bot-avatar-input"),
    botGreetingInput: document.getElementById("bot-greeting-input"),
    primaryColorPicker: document.getElementById("primary-color-picker"),
    userBgPicker: document.getElementById("user-bg-picker"),
    alignLeftBtn: document.getElementById("align-left-btn"),
    alignRightBtn: document.getElementById("align-right-btn"),

    // Advanced Styling
    fontFamilySelect: document.getElementById("font-family-select"),
    borderRadiusSlider: document.getElementById("border-radius-slider"),
    borderRadiusVal: document.getElementById("border-radius-val"),
    headerThemeButtons: document.querySelectorAll(".btn-header-theme"),

    // Lead Capture settings
    leadCaptureToggle: document.getElementById("lead-capture-toggle"),
    leadCaptureSettings: document.getElementById("lead-capture-settings"),
    fieldEmail: document.getElementById("field-email"),
    fieldPhone: document.getElementById("field-phone"),
    leadTriggerCount: document.getElementById("lead-trigger-count"),

    // Leads Inbox elements
    leadsCount: document.getElementById("leads-count"),
    exportLeadsBtn: document.getElementById("export-leads-btn"),
    leadsTableBody: document.getElementById("leads-table-body"),

    // Transcripts Pane elements
    transcriptsList: document.getElementById("transcripts-list"),
    transcriptMessagesBody: document.getElementById("transcript-messages-body"),
    activeSessionMeta: document.getElementById("active-session-meta"),

    // Deploy Console
    btnCloudDeploy: document.getElementById("btn-cloud-deploy"),
    deployStatusTxt: document.getElementById("deploy-status-txt"),
    deployTerminal: document.getElementById("deploy-terminal"),

    // Suggest Chips manager
    newChipInput: document.getElementById("new-chip-input"),
    addChipBtn: document.getElementById("add-chip-btn"),
    chipsContainer: document.getElementById("chips-manager-container"),

    // Knowledge Base inputs
    intentsContainer: document.getElementById("intents-container"),
    intentNameInput: document.getElementById("intent-name"),
    intentTriggersInput: document.getElementById("intent-triggers"),
    intentResponseInput: document.getElementById("intent-response"),
    trainIntentBtn: document.getElementById("train-intent-btn"),

    // Analytics counters
    statTotalMessages: document.getElementById("stat-total-messages"),
    statMatchRate: document.getElementById("stat-match-rate"),
    statAvgConfidence: document.getElementById("stat-avg-confidence"),
    statCsat: document.getElementById("stat-csat"),
    analyticsBarsContainer: document.getElementById("analytics-bars-container"),
    nlpDebugLog: document.getElementById("nlp-debug-log"),
    btnAutopilot: document.getElementById("btn-autopilot-chat"),

    // Exporter
    embedCodeBox: document.getElementById("embed-code-box"),
    copyCodeBtn: document.getElementById("copy-code-btn"),

    // Widget Preview Mount
    previewMount: document.getElementById("chatbot-preview-mount"),
    browserUrlText: document.getElementById("browser-url-text")
  };

  // ----------------------------------------------------
  // PRE-TRAINED INTENTS & MOCK SITES DATABASES
  // ----------------------------------------------------
  const domainFaqDatabase = {
    saas: [
      {
        id: "pricing",
        name: "Pricing Plans",
        patterns: ["price", "cost", "pricing", "plans", "subscription", "how much", "rate", "trial", "free trial", "starter", "professional", "pro", "select plan"],
        responses: ["Our plans start at just $19/month for the **Starter** plan. We also have a **Pro** plan ($49/month) and **Enterprise** options tailored for large teams. All plans include a 14-day free trial!"]
      },
      {
        id: "features",
        name: "Key Features",
        patterns: ["features", "capability", "what can you do", "integration", "benefits", "why choose"],
        responses: ["SaaSify offers automated workflows, real-time advanced analytics, multi-channel customer communications, and 50+ integrations. It is designed to scale with your team seamlessly."]
      },
      {
        id: "support",
        name: "Support & Help",
        patterns: ["help", "support", "bug", "error", "broken", "issue", "assistance", "problem", "ticket"],
        responses: ["Our dedicated support team is available 24/7! You can open a ticket in your account dashboard or email support@saasify.io for an urgent response."]
      },
      {
        id: "contact",
        name: "Contact Sales",
        patterns: ["contact", "email", "phone", "sales", "call", "talk to human", "speak to agent", "representative", "demo", "sales demo", "book demo", "book a demo", "book a sales demo"],
        responses: ["You can reach our sales team directly at sales@saasify.io or call us at +1 (800) 555-0199 (Mon-Fri 9am-6pm EST). We can set up a personal demo for your team!"]
      }
    ],
    ecommerce: [
      {
        id: "orders",
        name: "Order Tracking",
        patterns: ["track", "order", "status", "shipment", "where is my", "shipped", "tracking", "find package"],
        responses: ["You can track your order using the live carrier link provided in your confirmation email, or check your E-Shop dashboard order history tab!"]
      },
      {
        id: "shipping",
        name: "Shipping Info",
        patterns: ["shipping", "delivery", "shipping cost", "international", "rates", "fees", "how long"],
        responses: ["We offer Standard delivery (3-5 business days) for $4.99, free for orders above $50. Express 1-2 day delivery is available for $14.99."]
      },
      {
        id: "returns",
        name: "Returns & Refund Policy",
        patterns: ["return", "refund", "exchange", "money back", "cancel order", "damaged", "broken"],
        responses: ["We accept returns within 30 days of purchase for unused products. We'll issue a full refund to your original payment method within 5-7 business days."]
      },
      {
        id: "contact",
        name: "Customer Support",
        patterns: ["contact", "email", "support", "help", "phone", "talk to agent", "representative"],
        responses: ["Need help? Reach our team at support@eshop.com or call +1 (800) 555-0100 (Mon-Fri 8am-8pm EST)."]
      }
    ],
    healthcare: [
      {
        id: "booking",
        name: "Appointment Booking",
        patterns: ["book", "schedule", "appointment", "visit", "consultation", "make appointment", "see doctor"],
        responses: ["You can schedule your clinic visit online using our appointment calendar, or by calling our desk. Let us know if you need help finding a specialty!"]
      },
      {
        id: "clinics",
        name: "Clinic Locations & Hours",
        patterns: ["locations", "clinic", "address", "where is", "hours", "open", "saturday", "weekend"],
        responses: ["HealthHub is located at 742 Evergreen Terrace. We are open Monday to Friday, 8:00 AM to 7:00 PM, and Saturday, 9:00 AM to 2:00 PM."]
      },
      {
        id: "services",
        name: "Treatments & Doctors",
        patterns: ["doctors", "services", "specialists", "treatments", "pediatrics", "cardiology", "physio"],
        responses: ["We offer General Practice, Pediatrics, Cardiology, and Physical Therapy. Check our 'Doctors' tab to view our certified medical staff bio records."]
      },
      {
        id: "contact",
        name: "Clinic Contact",
        patterns: ["contact", "phone", "email", "emergency", "call", "nurse"],
        responses: ["You can call the clinic reception at +1 (800) 555-0200. In case of a medical emergency, please call 911 immediately."]
      }
    ],
    realestate: [
      {
        id: "renting",
        name: "Rentals & Listings",
        patterns: ["rent", "renting", "lease", "apartment", "studio", "house", "listings", "rentals"],
        responses: ["We have active listings for studio apartments starting at $1,200/mo, up to luxury homes. Check out our featured catalog or let me know your criteria!"]
      },
      {
        id: "buying",
        name: "Buying & Selling",
        patterns: ["buy", "purchase", "sell", "mortgage", "agent", "home value", "market price"],
        responses: ["Looking to buy or sell? Our certified realtors help you negotiate deals, run appraisals, and arrange financing. Let's schedule a consultation!"]
      },
      {
        id: "viewing",
        name: "Property Tours",
        patterns: ["tour", "viewing", "visit", "see house", "schedule tour", "open house"],
        responses: ["We coordinate guided property visits Monday through Saturday from 9:00 AM to 5:00 PM. Tell us the property address and your preferred date!"]
      },
      {
        id: "contact",
        name: "Brokerage Contact",
        patterns: ["contact", "phone", "broker", "agent", "office", "email", "realtor"],
        responses: ["Call DreamHome office at +1 (800) 555-0300 or write to info@dreamhome.com to speak with a listing broker."]
      }
    ],
    custom: []
  };

  // ----------------------------------------------------
  // INITIALIZATION & SETUP
  // ----------------------------------------------------
  function init() {
    // 1. Connect to server status endpoint to verify connectivity
    checkBackendConnectivity(() => {
      // 2. Load cached elements
      loadSavedState();

      // 3. Initialize Chatbot Widget
      chatbotInstance = new ChatbotWidget(state.branding);
      chatbotInstance.updateIntents(state.intents);
      chatbotInstance.init(elements.previewMount);
      
      // Bind callback integrations
      chatbotInstance.onInteraction = handleChatbotInteraction;
      chatbotInstance.onLeadCaptured = handleLeadCaptured;

      // Intercept chatbot close to save session transcripts
      const originalToggle = chatbotInstance.toggleChat;
      chatbotInstance.toggleChat = function(forceState = null) {
        const prevOpen = this.isOpen;
        originalToggle.call(this, forceState);
        if (prevOpen && !this.isOpen && this.history.length > 1) {
          saveSessionTranscript(this.history);
        }
      };

      // Set selectors from state
      elements.domainSelect.value = state.branding.domain || "saas";
      elements.modelTypeSelect.value = state.branding.modelType || "retrieval";
      elements.systemPromptInput.value = state.branding.systemPrompt || "";
      toggleSystemPromptView(state.branding.modelType);

      elements.botNameInput.value = state.branding.name;
      elements.botAvatarInput.value = state.branding.avatar;
      elements.botGreetingInput.value = state.branding.greeting;
      elements.primaryColorPicker.value = state.branding.primaryColor;
      elements.userBgPicker.value = state.branding.userBgColor;

      elements.fontFamilySelect.value = state.branding.fontFamily || "Inter";
      elements.borderRadiusSlider.value = state.branding.borderRadius !== undefined ? state.branding.borderRadius : 12;
      elements.borderRadiusVal.textContent = elements.borderRadiusSlider.value + "px";

      elements.headerThemeButtons.forEach(btn => {
        if (btn.getAttribute("data-gradient") === state.branding.headerGradient) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      // Lead capture inputs
      if (state.branding.leadCapture) {
        elements.leadCaptureToggle.checked = state.branding.leadCapture.enabled;
        elements.leadCaptureSettings.style.display = state.branding.leadCapture.enabled ? "block" : "none";
        elements.fieldEmail.checked = state.branding.leadCapture.fields.includes("email");
        elements.fieldPhone.checked = state.branding.leadCapture.fields.includes("phone");
        elements.leadTriggerCount.value = state.branding.leadCapture.triggerAfterMessages || 2;
      }

      if (state.branding.position === "bottom-left") {
        elements.alignLeftBtn.classList.add("active");
        elements.alignRightBtn.classList.remove("active");
      } else {
        elements.alignRightBtn.classList.add("active");
        elements.alignLeftBtn.classList.remove("active");
      }

      // Load active UI Console Theme on body
      const activeConsoleTheme = localStorage.getItem("chatstudio_console_theme") || "aurora";
      elements.dashboardThemeSelect.value = activeConsoleTheme;
      applyConsoleTheme(activeConsoleTheme);

      // Render landing page copy
      updateTargetWebsite(state.branding.domain);

      // Bind all dynamic form interactions
      bindTabNavigation();
      bindSettingsChangeHandlers();
      bindThemePresets();
      bindIntentsFormHandlers();
      bindChipsManager();
      bindClipboardExporter();
      bindAutopilotSimulator();
      bindLeadsHandlers();
      bindTranscriptsHandlers();
      bindCloudDeployer();

      // Render views
      renderChipsManager();
      renderIntentsList();
      renderAnalytics();
      renderLeadsInbox();
      renderTranscriptsList();
      generateEmbedSnippet();
    });

    // Landing page test trigger queries
    window.triggerChatbotQuery = (queryText) => {
      if (chatbotInstance) {
        chatbotInstance.toggleChat(true);
        chatbotInstance.processInput(queryText);
      }
    };
  }

  // ----------------------------------------------------
  // BACKEND DB CONNECTION CONTROLLER
  // ----------------------------------------------------
  function checkBackendConnectivity(callback) {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.status === "online") {
          syncOnline = true;
          elements.backendStatusBadge.className = "badge-status-online";
          elements.backendStatusBadge.style.background = "rgba(16, 185, 129, 0.08)";
          elements.backendStatusBadge.style.border = "1px solid rgba(16, 185, 129, 0.2)";
          elements.backendStatusBadge.style.color = "#10b981";
          elements.backendStatusBadge.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span> Connected (Online)`;
          console.log("[Sync] Persistent backend database detected!");
        }
        callback();
      })
      .catch(err => {
        syncOnline = false;
        elements.backendStatusBadge.className = "badge-status-local";
        elements.backendStatusBadge.style.background = "rgba(245, 158, 11, 0.08)";
        elements.backendStatusBadge.style.border = "1px solid rgba(245, 158, 11, 0.2)";
        elements.backendStatusBadge.style.color = "#f59e0b";
        elements.backendStatusBadge.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span> Local Sync (Offline)`;
        console.warn("[Sync] Server offline. Falling back to localStorage database.");
        callback();
      });
  }

  // ----------------------------------------------------
  // LOAD & SAVE STATE HELPERS
  // ----------------------------------------------------
  function loadSavedState() {
    // Basic branding loaders
    const savedBranding = localStorage.getItem("chatstudio_branding");
    if (savedBranding) {
      state.branding = JSON.parse(savedBranding);
    }
    
    const savedAnalytics = localStorage.getItem("chatstudio_analytics");
    if (savedAnalytics) {
      state.analytics = JSON.parse(savedAnalytics);
    }

    // Load Leads database
    if (syncOnline) {
      // Sync from Server DB
      fetch('/api/leads')
        .then(res => res.json())
        .then(data => {
          state.leads = data;
          localStorage.setItem("chatstudio_leads", JSON.stringify(data));
          renderLeadsInbox();
        });
      
      // Sync Intents from Server DB
      fetch('/api/intents')
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            state.intents = data;
          } else {
            state.intents = JSON.parse(JSON.stringify(domainFaqDatabase[state.branding.domain || "saas"]));
          }
          localStorage.setItem("chatstudio_intents", JSON.stringify(state.intents));
          renderIntentsList();
        });

      // Sync Transcripts from Server DB
      fetch('/api/transcripts')
        .then(res => res.json())
        .then(data => {
          state.transcripts = data;
          localStorage.setItem("chatstudio_transcripts", JSON.stringify(data));
          renderTranscriptsList();
        });
    } else {
      // Fallback: Sync from localStorage
      const savedIntents = localStorage.getItem("chatstudio_intents");
      if (savedIntents) {
        state.intents = JSON.parse(savedIntents);
      } else {
        state.intents = JSON.parse(JSON.stringify(domainFaqDatabase[state.branding.domain || "saas"]));
      }

      const savedLeads = localStorage.getItem("chatstudio_leads");
      if (savedLeads) {
        state.leads = JSON.parse(savedLeads);
      }

      const savedTranscripts = localStorage.getItem("chatstudio_transcripts");
      if (savedTranscripts) {
        state.transcripts = JSON.parse(savedTranscripts);
      }
    }
  }

  function saveState() {
    localStorage.setItem("chatstudio_branding", JSON.stringify(state.branding));
    localStorage.setItem("chatstudio_intents", JSON.stringify(state.intents));
    localStorage.setItem("chatstudio_leads", JSON.stringify(state.leads));
    localStorage.setItem("chatstudio_transcripts", JSON.stringify(state.transcripts));
    localStorage.setItem("chatstudio_analytics", JSON.stringify(state.analytics));
  }

  // ----------------------------------------------------
  // CONSOLE THEME SWITCHER
  // ----------------------------------------------------
  function applyConsoleTheme(theme) {
    document.body.classList.remove("theme-light", "theme-neon", "theme-aurora");
    if (theme === "light") {
      document.body.classList.add("theme-light");
    } else if (theme === "neon") {
      document.body.classList.add("theme-neon");
    } else {
      document.body.classList.add("theme-aurora");
    }
  }

  // ----------------------------------------------------
  // TAB NAVIGATION
  // ----------------------------------------------------
  function bindTabNavigation() {
    elements.navItems.forEach(item => {
      item.addEventListener("click", () => {
        const targetTabId = item.getAttribute("data-tab");

        elements.navItems.forEach(el => el.classList.remove("active"));
        item.classList.add("active");

        elements.tabPanes.forEach(pane => {
          if (pane.id === targetTabId) {
            pane.classList.add("active");
          } else {
            pane.classList.remove("active");
          }
        });

        if (targetTabId === "export-tab") {
          generateEmbedSnippet();
        }
        if (targetTabId === "leads-tab") {
          renderLeadsInbox();
        }
        if (targetTabId === "transcripts-tab") {
          renderTranscriptsList();
        }
        if (targetTabId === "analytics-tab") {
          setTimeout(updateAnalyticsBars, 100);
        }
      });
    });
  }

  function toggleSystemPromptView(modelType) {
    if (modelType === "generative" || modelType === "hybrid") {
      elements.systemPromptGroup.style.display = "block";
    } else {
      elements.systemPromptGroup.style.display = "none";
    }
  }

  // ----------------------------------------------------
  // DYNAMIC SETTINGS BINDING
  // ----------------------------------------------------
  function bindSettingsChangeHandlers() {
    // Console Theme select
    elements.dashboardThemeSelect.addEventListener("change", (e) => {
      const selected = e.target.value;
      localStorage.setItem("chatstudio_console_theme", selected);
      applyConsoleTheme(selected);
    });

    // Domain preset changer
    elements.domainSelect.addEventListener("change", (e) => {
      const activeDomain = e.target.value;
      state.branding.domain = activeDomain;
      
      updateTargetWebsite(activeDomain);
      
      state.intents = JSON.parse(JSON.stringify(domainFaqDatabase[activeDomain] || []));
      chatbotInstance.updateIntents(state.intents);
      chatbotInstance.updateConfig({ domain: activeDomain });
      
      renderIntentsList();
      renderAnalytics();
      saveState();

      if (syncOnline) {
        // Sync custom intents array to backend
        // In a true database we overwrite or append. We will just save locally and let server handle additions
        state.intents.forEach(intent => {
          fetch('/api/intents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intent)
          });
        });
      }
      
      alert(`Framework presets for "${activeDomain.toUpperCase()}" loaded! Target site copy and FAQ database successfully updated.`);
    });

    // Model type selector
    elements.modelTypeSelect.addEventListener("change", (e) => {
      const type = e.target.value;
      state.branding.modelType = type;
      toggleSystemPromptView(type);
      chatbotInstance.updateConfig({ modelType: type });
      saveState();
    });

    // System instruction text
    elements.systemPromptInput.addEventListener("input", (e) => {
      state.branding.systemPrompt = e.target.value;
      chatbotInstance.updateConfig({ systemPrompt: e.target.value });
      saveState();
    });

    // Chatbot Display Name
    elements.botNameInput.addEventListener("input", (e) => {
      state.branding.name = e.target.value.trim() || "Chat";
      chatbotInstance.updateConfig({ name: state.branding.name });
      saveState();
    });

    // Chatbot Avatar Input
    elements.botAvatarInput.addEventListener("input", (e) => {
      state.branding.avatar = e.target.value.trim() || "🤖";
      chatbotInstance.updateConfig({ avatar: state.branding.avatar });
      saveState();
    });

    // Chatbot Greeting Input
    elements.botGreetingInput.addEventListener("change", (e) => {
      state.branding.greeting = e.target.value.trim() || "Hello!";
      chatbotInstance.updateConfig({ greeting: state.branding.greeting });
      saveState();
    });

    // Theme Color Picker
    elements.primaryColorPicker.addEventListener("input", (e) => {
      state.branding.primaryColor = e.target.value;
      chatbotInstance.updateConfig({ primaryColor: state.branding.primaryColor });
      saveState();
    });

    // User Color Picker
    elements.userBgPicker.addEventListener("input", (e) => {
      state.branding.userBgColor = e.target.value;
      chatbotInstance.updateConfig({ userBgColor: state.branding.userBgColor });
      saveState();
    });

    // Screen alignment switches
    elements.alignLeftBtn.addEventListener("click", () => {
      state.branding.position = "bottom-left";
      elements.alignLeftBtn.classList.add("active");
      elements.alignRightBtn.classList.remove("active");
      chatbotInstance.updateConfig({ position: "bottom-left" });
      saveState();
    });

    elements.alignRightBtn.addEventListener("click", () => {
      state.branding.position = "bottom-right";
      elements.alignRightBtn.classList.add("active");
      elements.alignLeftBtn.classList.remove("active");
      chatbotInstance.updateConfig({ position: "bottom-right" });
      saveState();
    });

    // Font Family selector
    elements.fontFamilySelect.addEventListener("change", (e) => {
      state.branding.fontFamily = e.target.value;
      chatbotInstance.updateConfig({ fontFamily: e.target.value });
      saveState();
    });

    // Border Radius Slider
    elements.borderRadiusSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      state.branding.borderRadius = val;
      elements.borderRadiusVal.textContent = val + "px";
      chatbotInstance.updateConfig({ borderRadius: val });
      saveState();
    });

    // Header Gradient buttons
    elements.headerThemeButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const grad = btn.getAttribute("data-gradient");
        state.branding.headerGradient = grad;
        
        elements.headerThemeButtons.forEach(b => {
          b.style.border = "1px solid var(--border-color)";
          b.classList.remove("active");
        });
        btn.style.border = "2px solid #fff";
        btn.classList.add("active");

        chatbotInstance.updateConfig({ headerGradient: grad });
        saveState();
      });
    });

    // Lead Capture configurations
    elements.leadCaptureToggle.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      state.branding.leadCapture.enabled = enabled;
      elements.leadCaptureSettings.style.display = enabled ? "block" : "none";
      
      chatbotInstance.updateConfig({
        leadCapture: {
          ...chatbotInstance.config.leadCapture,
          enabled: enabled,
          completed: false
        }
      });
      saveState();
    });

    const updateLeadFields = () => {
      const fields = ["name"];
      if (elements.fieldEmail.checked) fields.push("email");
      if (elements.fieldPhone.checked) fields.push("phone");
      state.branding.leadCapture.fields = fields;

      chatbotInstance.updateConfig({
        leadCapture: {
          ...chatbotInstance.config.leadCapture,
          fields: fields
        }
      });
      saveState();
    };

    elements.fieldEmail.addEventListener("change", updateLeadFields);
    elements.fieldPhone.addEventListener("change", updateLeadFields);

    elements.leadTriggerCount.addEventListener("change", (e) => {
      const count = parseInt(e.target.value);
      state.branding.leadCapture.triggerAfterMessages = count;

      chatbotInstance.updateConfig({
        leadCapture: {
          ...chatbotInstance.config.leadCapture,
          triggerAfterMessages: count
        }
      });
      saveState();
    });
  }

  // ----------------------------------------------------
  // TARGET WEBSITE DYNAMIC RENDERING (SITE SWAPPER)
  // ----------------------------------------------------
  function updateTargetWebsite(domain) {
    if (!elements.browserUrlText) return;

    // Apply URL change
    if (domain === "saas") {
      elements.browserUrlText.textContent = "https://saasify.io/preview";
    } else if (domain === "ecommerce") {
      elements.browserUrlText.textContent = "https://eshop.com/preview";
    } else if (domain === "healthcare") {
      elements.browserUrlText.textContent = "https://healthhub.org/preview";
    } else if (domain === "realestate") {
      elements.browserUrlText.textContent = "https://dreamhome.com/preview";
    } else {
      elements.browserUrlText.textContent = "https://yourcustomdomain.com/preview";
    }

    // Toggle body class of sandbox
    const sandbox = document.getElementById("sandbox-wrapper");
    if (sandbox) {
      sandbox.className = "preview-sandbox mock-site-body " + domain + "-theme";
    }

    const wrapper = document.getElementById("site-content-wrapper");
    if (!wrapper) return;

    // Apply specific HTML Layout updates to the mock landing page
    if (domain === "ecommerce") {
      wrapper.innerHTML = `
        <header class="site-header">
          <div class="site-logo">
            🛒 E-Shop Online
          </div>
          <nav class="site-nav">
            <a href="#features" id="nav-link-1">Products</a>
            <a href="#pricing" id="nav-link-2">Deals</a>
            <a href="#contact" id="nav-link-3">Support</a>
          </nav>
        </header>

        <section class="site-hero">
          <h1 id="hero-title">Shop Premium Goods Online</h1>
          <p id="hero-subtitle">Fast worldwide shipping, 30-day money-back guarantee, and 24/7 dedicated support.</p>
          <div class="cta-group">
            <button class="btn-primary" onclick="triggerChatbotQuery('Tell me about your product deals')">Shop Deals</button>
            <button class="btn-secondary" onclick="triggerChatbotQuery('How do I track my order?')">Track Order</button>
          </div>
        </section>

        <h2 id="features" class="site-section-title">Why Shop With Us?</h2>
        <div class="site-features-grid">
          <div class="feature-card">
            <div class="feature-icon">✈️</div>
            <h3>Free Shipping</h3>
            <p>Get standard free shipping on all orders over $50 worldwide.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🛡️</div>
            <h3>30-Day returns</h3>
            <p>No questions asked return policy. Refunded back in 5-7 business days.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💬</div>
            <h3>Live support</h3>
            <p>Our intelligent virtual assistant answers tracking and returns questions instantly.</p>
          </div>
        </div>

        <h2 id="pricing" class="site-section-title">Elite Memberships</h2>
        <div class="pricing-grid">
          <div class="price-card">
            <h3>Gold Buyer</h3>
            <div class="price-amount">$9.99<span>/mo</span></div>
            <ul class="price-features">
              <li>Free shipping on all items</li>
              <li>Exclusive 10% cashbacks</li>
              <li>Priority support desk</li>
            </ul>
            <button class="btn-secondary" style="width: 100%;" onclick="triggerChatbotQuery('Tell me more about the Gold Buyer membership')">Select Plan</button>
          </div>
          <div class="price-card popular">
            <h3>Platinum VIP</h3>
            <div class="price-amount">$24.99<span>/mo</span></div>
            <ul class="price-features">
              <li>Free Next-Day delivery</li>
              <li>Exclusive 25% cashbacks</li>
              <li>Personal account assistant</li>
              <li>Early access to products</li>
            </ul>
            <button class="btn-primary" style="width: 100%;" onclick="triggerChatbotQuery('Tell me more about the Platinum VIP membership')">Join VIP</button>
          </div>
        </div>

        <footer class="site-footer">
          <p>&copy; 2026 E-Shop Retailers Co. All rights reserved.</p>
        </footer>
      `;
    } else if (domain === "healthcare") {
      wrapper.innerHTML = `
        <header class="site-header">
          <div class="site-logo" style="color: #10b981;">
            🏥 HealthHub Clinic
          </div>
          <nav class="site-nav">
            <a href="#features" id="nav-link-1">Services</a>
            <a href="#pricing" id="nav-link-2">Co-pay</a>
            <a href="#contact" id="nav-link-3">Clinic Contact</a>
          </nav>
        </header>

        <section class="site-hero">
          <h1 id="hero-title">Compassionate Care for You</h1>
          <p id="hero-subtitle">Schedule online appointments with certified medical doctors, manage prescriptions, and read diagnostic details.</p>
          <div class="cta-group">
            <button class="btn-primary" style="background-color:#10b981;" onclick="triggerChatbotQuery('How do I book an appointment?')">Book Visit</button>
            <button class="btn-secondary" onclick="triggerChatbotQuery('What clinic services do you offer?')">Our Specialties</button>
          </div>
        </section>

        <h2 id="features" class="site-section-title">Our Services</h2>
        <div class="site-features-grid">
          <div class="feature-card">
            <div class="feature-icon">🧑‍⚕️</div>
            <h3>Primary Care</h3>
            <p>Family check-ups, preventative care vaccines, and physical wellness records.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">❤️</div>
            <h3>Specialist Medicine</h3>
            <p>Certified experts in Cardiology, Pediatrics, Neurology, and Physiotherapy.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💻</div>
            <h3>Digital Records</h3>
            <p>Manage health folders, co-pay invoice history, and write secure messages online.</p>
          </div>
        </div>

        <h2 id="pricing" class="site-section-title">General Treatment Rates</h2>
        <div class="pricing-grid">
          <div class="price-card">
            <h3>Standard Visit</h3>
            <div class="price-amount">$75<span>/visit</span></div>
            <ul class="price-features">
              <li>General consultation doctor check</li>
              <li>Digital prescription log</li>
              <li>Accepts basic insurances</li>
            </ul>
            <button class="btn-secondary" style="width: 100%;" onclick="triggerChatbotQuery('Tell me more about standard visit fees')">Select Visit</button>
          </div>
          <div class="price-card popular" style="border-color:#10b981;">
            <div style="background-color:#10b981;" class="price-card popular::before">SPECIALIST</div>
            <h3>Specialist Care</h3>
            <div class="price-amount">$140<span>/visit</span></div>
            <ul class="price-features">
              <li>Cardiology or Neurology check</li>
              <li>Advanced diagnostic tools</li>
              <li>Priority booking online</li>
              <li>Consultation summary notes</li>
            </ul>
            <button class="btn-primary" style="width: 100%; background-color:#10b981;" onclick="triggerChatbotQuery('Tell me more about specialist fees')">Book Specialist</button>
          </div>
        </div>

        <footer class="site-footer">
          <p>&copy; 2026 HealthHub Clinic Network. All rights reserved.</p>
        </footer>
      `;
    } else if (domain === "realestate") {
      wrapper.innerHTML = `
        <header class="site-header">
          <div class="site-logo" style="color: #ff9f1c;">
            🏠 DreamHome Realtors
          </div>
          <nav class="site-nav">
            <a href="#features" id="nav-link-1">Listings</a>
            <a href="#pricing" id="nav-link-2">Guided Tours</a>
            <a href="#contact" id="nav-link-3">Contact Broker</a>
          </nav>
        </header>

        <section class="site-hero">
          <h1 id="hero-title">Find Your Dream Property</h1>
          <p id="hero-subtitle">Explore verified studios, suburban residential houses, and commercial workspace properties in prime locations.</p>
          <div class="cta-group">
            <button class="btn-primary" style="background-color:#ff9f1c;" onclick="triggerChatbotQuery('What properties do you have for rent?')">Browse Rentals</button>
            <button class="btn-secondary" onclick="triggerChatbotQuery('I want to schedule a property tour')">Book Tour</button>
          </div>
        </section>

        <h2 id="features" class="site-section-title">Featured Advantages</h2>
        <div class="site-features-grid">
          <div class="feature-card">
            <div class="feature-icon">🔍</div>
            <h3>Verified listings</h3>
            <p>Every apartment and house is pre-inspected by realtors to ensure accuracy.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💼</div>
            <h3>Expert agents</h3>
            <p>Dedicated local brokers to help you negotiate price rates and lease terms.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔑</div>
            <h3>Flexible leasing</h3>
            <p>Short term studio leases (3-6 months) up to long term house rental options.</p>
          </div>
        </div>

        <h2 id="pricing" class="site-section-title">Service Packages</h2>
        <div class="pricing-grid">
          <div class="price-card">
            <h3>Rental Finder</h3>
            <div class="price-amount">$199<span>/flat fee</span></div>
            <ul class="price-features">
              <li>Curated list of 10 properties</li>
              <li>Agent-guided visits (up to 3)</li>
              <li>Lease paperwork filing</li>
            </ul>
            <button class="btn-secondary" style="width: 100%;" onclick="triggerChatbotQuery('Tell me more about the Rental Finder package')">Choose Package</button>
          </div>
          <div class="price-card popular" style="border-color:#ff9f1c;">
            <div style="background-color:#ff9f1c;" class="price-card popular::before">EXCLUSIVE</div>
            <h3>Home Buyer Rep</h3>
            <div class="price-amount">2.5%<span> commission</span></div>
            <ul class="price-features">
              <li>Full market search appraisal</li>
              <li>Unlimited property walkthroughs</li>
              <li>Mortgage and escrow coordination</li>
              <li>Attorney-backed contract negotiations</li>
            </ul>
            <button class="btn-primary" style="width: 100%; background-color:#ff9f1c;" onclick="triggerChatbotQuery('Tell me more about Home Buyer representative package')">Consult Broker</button>
          </div>
        </div>

        <footer class="site-footer">
          <p>&copy; 2026 DreamHome Brokerage Inc. All rights reserved.</p>
        </footer>
      `;
    } else {
      // Custom / default
      wrapper.innerHTML = `
        <header class="site-header">
          <div class="site-logo">
            ⚡ Custom Site
          </div>
          <nav class="site-nav">
            <a href="#features">Services</a>
            <a href="#pricing">Details</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        <section class="site-hero">
          <h1 id="hero-title">Your Custom Landing Page</h1>
          <p id="hero-subtitle">Customize this content or deploy the widget snippet on any hosting provider.</p>
          <div class="cta-group">
            <button class="btn-primary" onclick="triggerChatbotQuery('Hello!')">Chat Now</button>
          </div>
        </section>

        <footer class="site-footer">
          <p>&copy; 2026 Custom Brand Inc.</p>
        </footer>
      `;
    }
  }

  // ----------------------------------------------------
  // SUGGESTION CHIPS MANAGER
  // ----------------------------------------------------
  function bindThemePresets() {
    document.querySelectorAll(".btn-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        const primary = btn.getAttribute("data-primary");
        const user = btn.getAttribute("data-user");

        state.branding.primaryColor = primary;
        state.branding.userBgColor = user;

        elements.primaryColorPicker.value = primary;
        elements.userBgPicker.value = user;

        chatbotInstance.updateConfig({
          primaryColor: primary,
          userBgColor: user
        });

        saveState();
        generateEmbedSnippet();
      });
    });
  }

  function bindChipsManager() {
    elements.addChipBtn.addEventListener("click", () => {
      const val = elements.newChipInput.value.trim();
      if (val && !state.branding.suggestions.includes(val)) {
        state.branding.suggestions.push(val);
        elements.newChipInput.value = "";
        renderChipsManager();
        chatbotInstance.updateConfig({ suggestions: state.branding.suggestions });
        saveState();
      }
    });

    elements.newChipInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        elements.addChipBtn.click();
      }
    });
  }

  function renderChipsManager() {
    elements.chipsContainer.innerHTML = "";
    state.branding.suggestions.forEach((chip, index) => {
      const chipEl = document.createElement("div");
      chipEl.className = "manager-chip";
      chipEl.innerHTML = `
        <span>${chip}</span>
        <button type="button" data-index="${index}">&times;</button>
      `;

      chipEl.querySelector("button").addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.getAttribute("data-index"));
        state.branding.suggestions.splice(idx, 1);
        renderChipsManager();
        chatbotInstance.updateConfig({ suggestions: state.branding.suggestions });
        saveState();
      });

      elements.chipsContainer.appendChild(chipEl);
    });
  }

  // ----------------------------------------------------
  // KNOWLEDGE BASE (INTENTS) MANAGER
  // ----------------------------------------------------
  function bindIntentsFormHandlers() {
    elements.trainIntentBtn.addEventListener("click", () => {
      const name = elements.intentNameInput.value.trim();
      const triggersRaw = elements.intentTriggersInput.value.trim();
      const response = elements.intentResponseInput.value.trim();

      if (!name || !triggersRaw || !response) {
        alert("Please fill in all fields (Intent name, trigger patterns, and response text).");
        return;
      }

      const patterns = triggersRaw
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      if (patterns.length === 0) {
        alert("Please enter at least one valid trigger keyphrase.");
        return;
      }

      const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      const newIntent = {
        id,
        name,
        patterns,
        responses: [response]
      };

      state.intents.push(newIntent);
      chatbotInstance.updateIntents(state.intents);

      if (state.analytics.triggerCounts[id] === undefined) {
        state.analytics.triggerCounts[id] = 0;
      }

      if (syncOnline) {
        fetch('/api/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newIntent)
        });
      }

      elements.intentNameInput.value = "";
      elements.intentTriggersInput.value = "";
      elements.intentResponseInput.value = "";

      renderIntentsList();
      renderAnalytics(); 
      saveState();
      alert(`Intent "${name}" trained successfully! Test it in the chatbot preview.`);
    });
  }

  function renderIntentsList() {
    elements.intentsContainer.innerHTML = "";
    state.intents.forEach((intent, index) => {
      const card = document.createElement("div");
      card.className = "intent-card";
      card.innerHTML = `
        <div class="intent-card-header">
          <span class="intent-badge">${intent.name}</span>
          <div class="intent-actions">
            <button class="btn-icon-danger" data-index="${index}" title="Delete Intent">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="intent-patterns">
          <strong>Triggers:</strong> ${intent.patterns.join(", ")}
        </div>
        <div class="intent-response">
          ${intent.responses[0]}
        </div>
      `;

      card.querySelector(".btn-icon-danger").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        const idx = parseInt(btn.getAttribute("data-index"));
        const intentToDelete = state.intents[idx];

        if (confirm(`Are you sure you want to delete the "${intentToDelete.name}" intent?`)) {
          state.intents.splice(idx, 1);
          chatbotInstance.updateIntents(state.intents);
          renderIntentsList();
          renderAnalytics();
          saveState();
        }
      });

      elements.intentsContainer.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // AUTOPILOT CONVERSATION SIMULATOR
  // ----------------------------------------------------
  function bindAutopilotSimulator() {
    elements.btnAutopilot.addEventListener("click", () => {
      let queries = [];
      const domain = state.branding.domain;
      
      if (domain === "ecommerce") {
        queries = [
          "hello!",
          "how do I track my order?",
          "what are shipping costs?",
          "tell me about returns",
          "can I get a refund?",
          "contact customer support",
          "platinum VIP membership details"
        ];
      } else if (domain === "healthcare") {
        queries = [
          "hi there",
          "how do I book an appointment?",
          "where is the clinic located?",
          "what are your clinic open hours?",
          "do you have cardiology doctor?",
          "what are treatment rates?",
          "is there an emergency number?"
        ];
      } else if (domain === "realestate") {
        queries = [
          "good morning",
          "show me properties for rent",
          "cost of apartments?",
          "how do I schedule property tour?",
          "contact realestate broker",
          "buying a house packages",
          "is there security deposit refund?"
        ];
      } else {
        queries = [
          "hello chatbot",
          "what is the cost of pro?",
          "tell me about features",
          "how do I open support ticket?",
          "I want to contact sales",
          "show me pricing plans",
          "how do I start free trial?",
          "do you have integrations?",
          "what is hybrid AI RAG?"
        ];
      }

      const query = queries[Math.floor(Math.random() * queries.length)];

      chatbotInstance.toggleChat(true);

      const previewInput = elements.previewMount.querySelector("#botChatInput");
      const previewForm = elements.previewMount.querySelector("#botChatForm");
      if (!previewInput || !previewForm) return;

      previewInput.value = "";
      previewInput.disabled = true;
      elements.btnAutopilot.disabled = true;
      elements.btnAutopilot.textContent = "Autopilot Typing...";

      let charIndex = 0;
      const typingInterval = setInterval(() => {
        if (charIndex < query.length) {
          previewInput.value += query.charAt(charIndex);
          charIndex++;
          const messages = elements.previewMount.querySelector("#botChatMessages");
          if (messages) messages.scrollTop = messages.scrollHeight;
        } else {
          clearInterval(typingInterval);
          previewInput.disabled = false;
          elements.btnAutopilot.disabled = false;
          elements.btnAutopilot.textContent = "Run Autopilot Query";

          setTimeout(() => {
            const submitEvent = new Event("submit", { cancelable: true });
            previewForm.dispatchEvent(submitEvent);
          }, 300);
        }
      }, 45); 
    });
  }

  // ----------------------------------------------------
  // PERFORMANCE ANALYTICS & NLP LOGGING
  // ----------------------------------------------------
  function handleChatbotInteraction(event, payload) {
    if (event === "user_message") {
      state.analytics.totalMessages++;
    } else if (event === "match") {
      state.analytics.matches++;
      state.analytics.confidenceSum += payload.confidence;
      state.analytics.triggerCounts[payload.intentId] = (state.analytics.triggerCounts[payload.intentId] || 0) + 1;
      appendNlpDebugLog("match", payload);
    } else if (event === "fallback") {
      state.analytics.fallbacks++;
      state.analytics.triggerCounts["fallback"] = (state.analytics.triggerCounts["fallback"] || 0) + 1;
      appendNlpDebugLog("fallback", payload);
    }

    renderAnalytics();
    saveState();
  }

  function appendNlpDebugLog(type, payload) {
    if (!elements.nlpDebugLog) return;

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];

    const logDiv = document.createElement("div");
    logDiv.style.borderBottom = "1px solid rgba(255,255,255,0.04)";
    logDiv.style.paddingBottom = "6px";
    logDiv.style.marginBottom = "6px";

    let html = `<div><span style="color: #6b7280;">[${timeStr}]</span> <strong style="color: #a78bfa;">Query:</strong> "${payload.query}"</div>`;

    if (type === "match") {
      const confidencePercent = Math.round(payload.confidence * 100);
      const confColor = payload.confidence >= 0.7 ? "#34d399" : "#f59e0b";
      
      html += `<div><span style="color: ${confColor}; font-weight: bold;">↳ RESOLVED:</span> Intent <strong>"${payload.intentName}"</strong> (Score: ${confidencePercent}%)</div>`;
      if (payload.details) {
        if (payload.details.matchedPattern) {
          html += `<div style="color: #71717a; padding-left: 14px;">• Match trigger: "${payload.details.matchedPattern}"</div>`;
        }
        if (payload.details.queryTokens && payload.details.queryTokens.length > 0) {
          html += `<div style="color: #71717a; padding-left: 14px;">• Scanned terms: [${payload.details.queryTokens.join(", ")}]</div>`;
        }
      }
    } else {
      html += `<div><span style="color: #f87171; font-weight: bold;">↳ FALLBACK:</span> No intent matched (Confidence &lt; 25%)</div>`;
      if (payload.details && payload.details.queryTokens) {
        html += `<div style="color: #71717a; padding-left: 14px;">• Scanned tokens: [${payload.details.queryTokens.join(", ")}]</div>`;
      }
    }

    logDiv.innerHTML = html;
    elements.nlpDebugLog.appendChild(logDiv);
    elements.nlpDebugLog.scrollTop = elements.nlpDebugLog.scrollHeight;
  }

  function renderAnalytics() {
    const total = state.analytics.totalMessages;
    const matches = state.analytics.matches;
    const fallbacks = state.analytics.fallbacks;
    const confSum = state.analytics.confidenceSum;

    const matchRate = total > 0 ? Math.round((matches / total) * 100) : 0;
    const avgConfidence = matches > 0 ? Math.round((confSum / matches) * 100) : 0;

    const fallbackPercentage = total > 0 ? (fallbacks / total) : 0;
    const csat = total > 0 ? Math.max(50, Math.round(98 - (fallbackPercentage * 60))) : 96;

    elements.statTotalMessages.textContent = total;
    elements.statMatchRate.textContent = `${matchRate}%`;
    elements.statAvgConfidence.textContent = `${avgConfidence}%`;
    elements.statCsat.textContent = `${csat}%`;

    elements.analyticsBarsContainer.innerHTML = "";

    const chartData = [
      ...state.intents.map(intent => ({
        id: intent.id,
        name: intent.name,
        count: state.analytics.triggerCounts[intent.id] || 0
      })),
      {
        id: "fallback",
        name: "Fallback (Unmatched)",
        count: state.analytics.triggerCounts["fallback"] || 0
      }
    ];

    const maxVal = Math.max(1, ...chartData.map(d => d.count));

    chartData.forEach(item => {
      const barItem = document.createElement("div");
      barItem.className = "chart-bar-item";
      barItem.innerHTML = `
        <div class="chart-bar-label" title="${item.name}">${item.name}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" data-width="${(item.count / maxVal) * 100}%" style="width: 0%;"></div>
        </div>
        <div class="chart-bar-value">${item.count}</div>
      `;
      elements.analyticsBarsContainer.appendChild(barItem);
    });

    updateAnalyticsBars();
  }

  function updateAnalyticsBars() {
    const fills = elements.analyticsBarsContainer.querySelectorAll(".chart-bar-fill");
    fills.forEach(fill => {
      const width = fill.getAttribute("data-width");
      requestAnimationFrame(() => {
        fill.style.width = width;
      });
    });
  }

  // ----------------------------------------------------
  // LEADS CAPTURED HANDLERS & TABLE
  // ----------------------------------------------------
  function handleLeadCaptured(leadData) {
    state.leads.push(leadData);
    saveState();
    renderLeadsInbox();

    if (syncOnline) {
      // POST to persistent backend DB
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      })
      .then(res => res.json())
      .then(savedLead => {
        console.log("[Sync] Lead successfully stored in JSON Database:", savedLead);
      });
    }
  }

  function bindLeadsHandlers() {
    elements.exportLeadsBtn.addEventListener("click", () => {
      if (state.leads.length === 0) {
        alert("No leads available to export yet.");
        return;
      }

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Name,Email,Phone,Domain Source,Date Captured\n";

      state.leads.forEach(lead => {
        const name = `"${lead.name || ''}"`;
        const email = `"${lead.email || ''}"`;
        const phone = `"${lead.phone || ''}"`;
        const domain = `"${lead.domain || ''}"`;
        const date = `"${new Date(lead.timestamp).toLocaleString()}"`;
        csvContent += `${name},${email},${phone},${domain},${date}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `leads_export_${state.branding.domain}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  function renderLeadsInbox() {
    if (!elements.leadsTableBody) return;
    
    elements.leadsCount.textContent = state.leads.length;
    elements.leadsTableBody.innerHTML = "";

    if (state.leads.length === 0) {
      elements.leadsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted);">No leads captured yet. Configure lead capture settings and test the simulator!</td>
        </tr>
      `;
      return;
    }

    const sortedLeads = [...state.leads].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedLeads.forEach(lead => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid var(--border-color)";
      row.style.transition = "background-color 0.2s";

      const dateStr = new Date(lead.timestamp).toLocaleDateString() + " " + new Date(lead.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const domainBadge = `<span style="font-size: 0.7rem; font-weight: 700; background-color: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); color: var(--accent-cyan); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${lead.domain}</span>`;

      row.innerHTML = `
        <td style="padding: 12px 10px; font-weight: 600;">${lead.name || '-'}</td>
        <td style="padding: 12px 10px; font-family: monospace;">${lead.email || '-'}</td>
        <td style="padding: 12px 10px;">${lead.phone || '-'}</td>
        <td style="padding: 12px 10px;">${domainBadge}</td>
        <td style="padding: 12px 10px; text-align: right; color: var(--text-muted); font-size: 0.75rem;">${dateStr}</td>
      `;
      elements.leadsTableBody.appendChild(row);
    });
  }

  // ----------------------------------------------------
  // TRANSCRIPTS RECORDER & VIEWER
  // ----------------------------------------------------
  function saveSessionTranscript(historyArray) {
    const activeDomain = state.branding.domain || "saas";
    const session = {
      id: "session-" + Math.floor(Math.random() * 1000000),
      domain: activeDomain,
      timestamp: new Date(),
      messages: JSON.parse(JSON.stringify(historyArray))
    };

    state.transcripts.push(session);
    saveState();
    renderTranscriptsList();

    if (syncOnline) {
      // POST transcript data to server database.json
      fetch('/api/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      })
      .then(res => res.json())
      .then(savedTrans => {
        console.log("[Sync] Conversation session stored in Cloud JSON Database:", savedTrans);
      });
    }
  }

  function bindTranscriptsHandlers() {
    // We bind selection events dynamically in rendering
  }

  function renderTranscriptsList() {
    if (!elements.transcriptsList) return;

    elements.transcriptsList.innerHTML = "";

    if (state.transcripts.length === 0) {
      elements.transcriptsList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding-top: 30px;">
          No chats logged yet. Start chatting in the simulator on the right, and then close the widget window to log!
        </div>
      `;
      return;
    }

    const sortedTranscripts = [...state.transcripts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedTranscripts.forEach(session => {
      const chip = document.createElement("div");
      chip.className = "session-chip";
      chip.style.cssText = "padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 4px; text-align: left;";
      
      chip.addEventListener("mouseover", () => {
        chip.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
        chip.style.borderColor = "var(--accent-cyan)";
      });
      chip.addEventListener("mouseout", () => {
        chip.style.backgroundColor = "rgba(255,255,255,0.02)";
        chip.style.borderColor = "var(--border-color)";
      });

      const dateStr = new Date(session.timestamp).toLocaleDateString() + " " + new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const badge = `<span style="font-size: 0.65rem; font-weight: 700; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2); color: var(--accent-violet); padding: 1px 4px; border-radius: 3px; text-transform: uppercase; width: fit-content;">${session.domain}</span>`;

      chip.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          ${badge}
          <span style="font-size: 0.65rem; color: var(--text-muted);">${dateStr}</span>
        </div>
        <div style="font-size: 0.725rem; font-weight: 500; color: #fff;">Session ID: #${session.id.split("-")[1]}</div>
        <div style="font-size: 0.675rem; color: var(--text-muted);">${session.messages.length} messages exchanged</div>
      `;

      chip.addEventListener("click", () => {
        // Toggle selected styling
        const activeChips = elements.transcriptsList.querySelectorAll(".session-chip");
        activeChips.forEach(c => c.style.borderColor = "var(--border-color)");
        chip.style.borderColor = "var(--accent-violet)";
        
        loadTranscriptSessionDetails(session);
      });

      elements.transcriptsList.appendChild(chip);
    });
  }

  function loadTranscriptSessionDetails(session) {
    if (!elements.transcriptMessagesBody) return;

    elements.transcriptMessagesBody.innerHTML = "";
    elements.activeSessionMeta.textContent = `ID: #${session.id.split("-")[1]} • Domain: ${session.domain.toUpperCase()}`;

    session.messages.forEach(msg => {
      const bubbleEl = document.createElement("div");
      bubbleEl.style.cssText = "display: flex; gap: 8px; max-width: 85%; align-self: flex-start; animation: fadeIn 0.2s;";
      
      const contentText = msg.text
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

      if (msg.sender === "user") {
        bubbleEl.style.alignSelf = "flex-end";
        bubbleEl.style.flexDirection = "row-reverse";
        bubbleEl.innerHTML = `
          <div style="padding: 8px 12px; border-radius: 10px; border-top-right-radius: 2px; background: ${state.branding.userBgColor}; color: ${state.branding.textColor}; font-size: 0.75rem; line-height: 1.4;">
            ${contentText}
          </div>
        `;
      } else {
        bubbleEl.innerHTML = `
          <div style="font-size: 0.95rem; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center;">🤖</div>
          <div style="padding: 8px 12px; border-radius: 10px; border-top-left-radius: 2px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-main); font-size: 0.75rem; line-height: 1.4; max-width: 80%;">
            ${contentText}
          </div>
        `;
      }
      elements.transcriptMessagesBody.appendChild(bubbleEl);
    });

    elements.transcriptMessagesBody.scrollTop = elements.transcriptMessagesBody.scrollHeight;
  }

  // ----------------------------------------------------
  // CLOUD DEPLOYMENT SIMULATOR
  // ----------------------------------------------------
  function bindCloudDeployer() {
    if (!elements.btnCloudDeploy) return;

    elements.btnCloudDeploy.addEventListener("click", () => {
      elements.btnCloudDeploy.disabled = true;
      elements.btnCloudDeploy.style.opacity = "0.6";
      elements.deployStatusTxt.textContent = "Status: Deploying...";
      elements.deployStatusTxt.style.color = "#f59e0b"; // Warning gold color

      elements.deployTerminal.innerHTML = `<div style="color: #6b7280;">[System] Initiating cloud deploy pipeline for domain "${state.branding.domain}"...</div>`;

      const logs = [
        { delay: 800, text: `[System] Validating chatbot config integrity & pre-trained intents database...` },
        { delay: 1500, text: `[System] Provisioning cloud microservice containers (Node.js & SQLite integration)...` },
        { delay: 2200, text: `[System] Optimizing styling assets (Gradient: ${state.branding.headerGradient.split(",")[1].split(" ")[1]}, Radius: ${state.branding.borderRadius}px)...` },
        { delay: 3000, text: `[System] Compiling JavaScript bundle and deploying widget loader snippet...` },
        { delay: 3800, text: `[System] Deployment successfully completed! Live URL: https://${state.branding.domain}-chat.cloud.deploy/widget.js` }
      ];

      logs.forEach(log => {
        setTimeout(() => {
          const logDiv = document.createElement("div");
          logDiv.innerHTML = log.text;
          
          if (log.text.includes("completed!")) {
            logDiv.style.color = "#34d399";
            logDiv.style.fontWeight = "bold";
            elements.deployStatusTxt.textContent = "Status: ONLINE (Production)";
            elements.deployStatusTxt.style.color = "#10b981";
            elements.btnCloudDeploy.disabled = false;
            elements.btnCloudDeploy.style.opacity = "1";
          } else {
            logDiv.style.color = "#a1a1aa";
          }
          
          elements.deployTerminal.appendChild(logDiv);
          elements.deployTerminal.scrollTop = elements.deployTerminal.scrollHeight;
        }, log.delay);
      });
    });
  }

  // ----------------------------------------------------
  // STANDALONE SNIPPET GENERATOR
  // ----------------------------------------------------
  function generateEmbedSnippet() {
    const cleanStyles = `
/* Chatbot Widget Styles */
.bot-widget-container {
  position: fixed;
  z-index: 99999;
  font-family: var(--widget-font, '${state.branding.fontFamily}', -apple-system, sans-serif);
  --primary-color: ${state.branding.primaryColor};
  --text-color: #ffffff;
  --bot-bg: #1e1b4b;
  --user-bg: ${state.branding.userBgColor};
  --widget-radius: ${state.branding.borderRadius}px;
  --header-gradient: ${state.branding.headerGradient};
  bottom: 20px;
  ${state.branding.position === "bottom-right" ? "right: 20px;" : "left: 20px;"}
  transition: all 0.3s ease;
}
.bot-bubble-btn {
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background-color: var(--primary-color); color: var(--text-color);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3); transition: transform 0.2s;
}
.bot-bubble-btn:hover { transform: scale(1.08); }
.bot-chat-box {
  display: flex; flex-direction: column; position: absolute; bottom: 70px;
  width: 340px; height: 460px; background-color: #0f0f16;
  border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--widget-radius);
  box-shadow: 0 12px 36px rgba(0,0,0,0.4); overflow: hidden;
  opacity: 0; transform: translateY(20px) scale(0.92); pointer-events: none;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  ${state.branding.position === "bottom-right" ? "right: 0; transform-origin: bottom right;" : "left: 0; transform-origin: bottom left;"}
}
.bot-widget-container.widget-open .bot-chat-box { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.bot-chat-header { background: var(--header-gradient, var(--bot-bg)); padding: 14px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.bot-header-avatar { font-size: 1.5rem; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
.bot-header-info { flex-grow: 1; }
.bot-header-title { margin: 0; color: var(--text-color); font-size: 0.95rem; font-weight: 600; }
.bot-header-status { font-size: 0.7rem; color: #34d399; }
.bot-close-btn { background: transparent; border: none; color: rgba(255,255,255,0.5); cursor: pointer; display: flex; align-items: center; }
.bot-close-btn:hover { color: #fff; }
.bot-chat-messages { flex-grow: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background-color: #0d0d12; }
.bot-message { display: flex; gap: 8px; max-width: 85%; }
.bot-message.message-user { align-self: flex-end; flex-direction: row-reverse; max-width: 80%; }
.bot-message-bubble { padding: 10px 14px; border-radius: var(--widget-radius); font-size: 0.85rem; line-height: 1.4; }
.message-bot .bot-message-bubble { background-color: #1a1a24; color: #e4e4e7; border-top-left-radius: 2px; }
.message-user .bot-message-bubble { background-color: var(--user-bg); color: var(--text-color); border-top-right-radius: 2px; }
.bot-typing-indicator { align-self: flex-start; display: none; align-items: center; gap: 4px; background-color: #1a1a24; padding: 10px 14px; border-radius: var(--widget-radius); }
.bot-typing-indicator span { width: 6px; height: 6px; background-color: #a1a1aa; border-radius: 50%; animation: typing 1.4s infinite ease-in-out both; }
@keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
.bot-chat-suggestions { padding: 8px 12px; display: flex; gap: 6px; overflow-x: auto; background-color: #0d0d12; }
.bot-suggestion-chip { background-color: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); color: #a1a1aa; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
.bot-suggestion-chip:hover { background-color: var(--primary-color); color: var(--text-color); }
.bot-chat-input-area { display: flex; padding: 10px 12px; background-color: #0f0f16; border-top: 1px solid rgba(255,255,255,0.06); align-items: center; gap: 8px; }
.bot-chat-input-area input { flex-grow: 1; background: transparent; border: none; color: #fff; font-size: 0.85rem; outline: none; }
.bot-chat-input-area button { background: transparent; border: none; color: var(--primary-color); cursor: pointer; display: flex; align-items: center; }
.bot-mic-btn { display: flex; align-items: center; margin-right: 4px; cursor: pointer; }
.bot-mic-btn.recording { color: #f43f5e !important; animation: micPulse 1.2s infinite; }
@keyframes micPulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
.bot-watermark { font-size: 0.65rem; color: #27272a; text-align: center; padding: 4px 0; background-color: #0f0f16; }
`;

    const codeString = `<!-- ==============================================
     AI CHATBOT WIDGET INTEGRATION SNIPPET
     Paste inside body tag at bottom of your HTML pages
     ============================================== -->
<style>
${cleanStyles.trim()}
</style>

<div id="saasify-chatbot-mount"></div>

<script>
(function() {
  class ChatbotWidget {
    constructor(config, intents) {
      this.config = config;
      this.intents = intents;
      this.history = [];
      this.isOpen = false;
      this.container = null;
      this.conversationState = null;
      this.capturedLeadData = {};
      this.pendingQuery = "";
    }
    
    tokenize(t) { return t.toLowerCase().replace(/[.,\\/#!$%\\^&\\*;:{}=\\-_`~()?]/g,"").split(/\\s+/).filter(w => w.length > 0); }
    
    findMatch(q) {
      const qTokens = this.tokenize(q);
      if (qTokens.length === 0) return { intent: null, confidence: 0 };
      let bestMatch = null, maxScore = 0;
      for (const intent of this.intents) {
        for (const pattern of intent.patterns) {
          const pLower = pattern.toLowerCase();
          let score = 0;
          if (q.toLowerCase().includes(pLower)) { score = 1.0; }
          const pTokens = this.tokenize(pLower);
          let matchCount = 0;
          for (const tok of qTokens) { if (pTokens.includes(tok)) matchCount++; }
          if (pTokens.length > 0) {
            const overlap = matchCount / Math.max(pTokens.length, qTokens.length);
            score = Math.max(score, overlap);
          }
          if (score > maxScore) { maxScore = score; bestMatch = intent; }
        }
      }
      return maxScore >= 0.25 ? { intent: bestMatch, confidence: maxScore } : { intent: null, confidence: 0 };
    }

    playTone(type) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (type === "user") {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(450, ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04);
        } else if (type === "bot") {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.connect(gain1); gain1.connect(ctx.destination);
          osc1.frequency.setValueAtTime(650, ctx.currentTime);
          gain1.gain.setValueAtTime(0.03, ctx.currentTime);
          gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
          osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.06);
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(850, ctx.currentTime);
            gain2.gain.setValueAtTime(0.03, ctx.currentTime);
            gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
            osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.08);
          }, 80);
        }
      } catch (e) {}
    }

    generateAiResponse(userInput) {
      const modelType = this.config.modelType;
      const domain = this.config.domain;
      const res = this.findMatch(userInput);
      let baseText = "";
      if (res.intent) {
        baseText = res.intent.responses[Math.floor(Math.random() * res.intent.responses.length)];
      }

      if (modelType === "retrieval") {
        return baseText || this.config.fallbackResponse;
      }

      let promptInstruct = this.config.systemPrompt.toLowerCase();
      let prefix = "";
      if (promptInstruct.includes("sarcastic")) prefix = "If I must answer: ";
      else if (promptInstruct.includes("pirate")) prefix = "Ahoy! ";

      if (modelType === "hybrid" && baseText) {
        return \`Certainly! \${prefix}\${baseText}\`;
      }

      const tokens = this.tokenize(userInput);
      if (tokens.includes("hello") || tokens.includes("hi")) {
        return \`\${prefix}Hello! Welcome to our domain. How can I help you today?\`;
      }
      if (tokens.includes("price") || tokens.includes("cost")) {
        return \`\${prefix}Our packages are highly competitive. Check our site tables!\`;
      }
      return baseText || \`I've noted your question about "\${userInput}". Please let me know how I can guide you further!\`;
    }
    
    processInput(userInput) {
      if (!userInput.trim()) return;
      this.addMessage(userInput, "user");
      this.showTypingIndicator();
      setTimeout(() => {
        this.hideTypingIndicator();

        if (this.conversationState && this.conversationState.startsWith("lead_")) {
          this.handleLeadCaptureInput(userInput);
          return;
        }

        if (this.config.leadCapture && this.config.leadCapture.enabled && !this.config.leadCapture.completed) {
          const uCount = this.history.filter(m => m.sender === "user").length;
          if (uCount >= this.config.leadCapture.triggerAfterMessages) {
            this.pendingQuery = userInput;
            const fields = this.config.leadCapture.fields || ["name", "email"];
            this.conversationState = "lead_" + fields[0];
            this.addMessage("Hello! To save this chat history, please provide your **full name**:", "bot");
            return;
          }
        }

        const respText = this.generateAiResponse(userInput);
        this.addMessage(respText, "bot");
      }, 750);
    }

    handleLeadCaptureInput(userInput) {
      const fields = this.config.leadCapture.fields || ["name", "email"];
      if (this.conversationState === "lead_name") {
        this.capturedLeadData.name = userInput;
        const nextIdx = fields.indexOf("name") + 1;
        if (nextIdx < fields.length) {
          this.conversationState = "lead_" + fields[nextIdx];
          this.addMessage(\`Thanks \${userInput}! What is your **email address**?\`, "bot");
        } else {
          this.completeLeadCapture();
        }
      } else if (this.conversationState === "lead_email") {
        this.capturedLeadData.email = userInput;
        const nextIdx = fields.indexOf("email") + 1;
        if (nextIdx < fields.length) {
          this.conversationState = "lead_" + fields[nextIdx];
          this.addMessage("And your **phone number**?", "bot");
        } else {
          this.completeLeadCapture();
        }
      } else if (this.conversationState === "lead_phone") {
        this.capturedLeadData.phone = userInput;
        this.completeLeadCapture();
      }
    }

    completeLeadCapture() {
      this.config.leadCapture.completed = true;
      this.conversationState = null;
      this.capturedLeadData.domain = this.config.domain;
      this.capturedLeadData.timestamp = new Date();
      
      console.log("Lead captured:", this.capturedLeadData);
      
      this.addMessage("Thank you! Contact saved. Resuming conversation...", "bot");
      const q = this.pendingQuery || "hello";
      this.pendingQuery = "";
      setTimeout(() => {
        this.showTypingIndicator();
        setTimeout(() => {
          this.hideTypingIndicator();
          this.addMessage(this.generateAiResponse(q), "bot");
        }, 750);
      }, 1000);
    }
    
    init(el) {
      this.container = el;
      this.container.innerHTML = \`
        <div class="bot-widget-container">
          <button class="bot-bubble-btn" id="botBubbleBtn" aria-label="Open chat">
            <span class="bot-bubble-icon">\${this.config.avatar}</span>
          </button>
          <div class="bot-chat-box" id="botChatBox">
            <div class="bot-chat-header" id="botChatHeader">
              <div class="bot-header-avatar">\${this.config.avatar}</div>
              <div class="bot-header-info">
                <h4 class="bot-header-title">\${this.config.name}</h4>
                <span class="bot-header-status">Online • Agent</span>
              </div>
              <button class="bot-close-btn" id="botCloseBtn" type="button" aria-label="Close Chat">&times;</button>
            </div>
            <div class="bot-chat-messages" id="botChatMessages">
              <div class="bot-typing-indicator" id="botTypingIndicator" style="display: none;">
                <span></span><span></span><span></span>
              </div>
            </div>
            <div class="bot-chat-suggestions" id="botChatSuggestions"></div>
            <form class="bot-chat-input-area" id="botChatForm">
              <input type="text" id="botChatInput" placeholder="Ask something..." autocomplete="off" />
              <button type="button" id="botMicBtn" aria-label="Speech input" class="bot-mic-btn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>
              <button type="submit">Send</button>
            </form>
            <div class="bot-watermark">Powered by \${this.config.name} AI</div>
          </div>
        </div>
      \`;
      
      this.bindEvents();
      this.renderSuggestions();
      this.addMessage(this.config.greeting, "bot");
    }
    
    renderSuggestions() {
      const sBox = this.container.querySelector("#botChatSuggestions");
      sBox.innerHTML = "";
      this.config.suggestions.forEach(s => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "bot-suggestion-chip"; btn.textContent = s;
        btn.onclick = () => this.processInput(s);
        sBox.appendChild(btn);
      });
    }
    
    toggleChat() {
      this.isOpen = !this.isOpen;
      const widget = this.container.querySelector(".bot-widget-container");
      if (this.isOpen) widget.classList.add("widget-open");
      else widget.classList.remove("widget-open");
    }
    
    addMessage(text, sender) {
      const messagesContainer = this.container.querySelector("#botChatMessages");
      const indicator = this.container.querySelector("#botTypingIndicator");
      const mEl = document.createElement("div");
      mEl.className = "bot-message " + (sender === "user" ? "message-user" : "message-bot");
      mEl.innerHTML = \`<div class="bot-message-bubble">\${text.replace(/\\*\\*(.*?)\\*\\*/g, "<strong>$1</strong>")}</div>\`;
      messagesContainer.insertBefore(mEl, indicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      this.playTone(sender);
    }
    
    showTypingIndicator() {
      this.container.querySelector("#botTypingIndicator").style.display = "flex";
      const messagesContainer = this.container.querySelector("#botChatMessages");
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    hideTypingIndicator() { this.container.querySelector("#botTypingIndicator").style.display = "none"; }
    
    bindEvents() {
      const cInput = this.container.querySelector("#botChatInput");
      const cForm = this.container.querySelector("#botChatForm");
      const micBtn = this.container.querySelector("#botMicBtn");

      this.container.querySelector("#botBubbleBtn").onclick = () => this.toggleChat();
      this.container.querySelector("#botCloseBtn").onclick = () => this.toggleChat();
      
      cForm.onsubmit = (e) => {
        e.preventDefault();
        const query = cInput.value.trim();
        if (query) { this.processInput(query); cInput.value = ""; }
      };

      if (micBtn && cInput) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          const rec = new SpeechRecognition();
          rec.continuous = false; rec.lang = 'en-US'; rec.interimResults = false;
          let isRec = false;
          rec.onstart = () => { isRec = true; micBtn.classList.add("recording"); cInput.placeholder = "Listening..."; };
          rec.onend = () => { isRec = false; micBtn.classList.remove("recording"); cInput.placeholder = "Ask something..."; };
          rec.onresult = (e) => {
            cInput.value = e.results[0][0].transcript;
            setTimeout(() => { cForm.dispatchEvent(new Event("submit", {cancelable:true})); }, 500);
          };
          micBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (isRec) rec.stop(); else rec.start(); };
        } else {
          micBtn.style.display = "none";
        }
      }
    }
  }

  // Initialize custom instance
  const customConfig = ${JSON.stringify(state.branding, null, 2)};
  const customIntents = ${JSON.stringify(state.intents, null, 2)};

  const mountNode = document.getElementById("saasify-chatbot-mount");
  const widget = new ChatbotWidget(customConfig, customIntents);
  widget.init(mountNode);
})();
</script>`;

    elements.embedCodeBox.textContent = codeString;
  }

  // ----------------------------------------------------
  // COPY CLIPBOARD
  // ----------------------------------------------------
  function bindClipboardExporter() {
    elements.copyCodeBtn.addEventListener("click", () => {
      const codeText = elements.embedCodeBox.textContent;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeText)
          .then(showCopiedFeedback)
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        const textarea = document.createElement("textarea");
        textarea.value = codeText;
        textarea.style.position = "fixed";  
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          showCopiedFeedback();
        } catch (err) {
          alert("Failed to copy embed snippet. Please copy manually.");
        }
        document.body.removeChild(textarea);
      }

      function showCopiedFeedback() {
        const originalHTML = elements.copyCodeBtn.innerHTML;
        elements.copyCodeBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Copied!
        `;
        elements.copyCodeBtn.style.borderColor = "var(--accent-emerald)";
        elements.copyCodeBtn.style.color = "var(--accent-emerald)";

        setTimeout(() => {
          elements.copyCodeBtn.innerHTML = originalHTML;
          elements.copyCodeBtn.style.borderColor = "";
          elements.copyCodeBtn.style.color = "";
        }, 2000);
      }
    });
  }

  // Run initial loading
  init();
});
