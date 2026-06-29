// Chatbot.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, MapPin, Phone, Globe, Wifi, Monitor, Briefcase, Navigation } from 'lucide-react';

const WELCOME_MESSAGE = `Hi, I'm the Caseworker Intelligence for Digital Inclusion bot! I can help you find internet service options and digital inclusion resources in Clark County. 

Want to get started by telling me your address?`;

// ─── Service type → icon ──────────────────────────────────────────────────────

const SERVICE_TYPE_ICON = {
  'Affordability / Connectivity': Wifi,
  'Digital Skills Training'     : Monitor,
  'Device Access'               : Monitor,
  'Workforce Programming'       : Briefcase,
  'Navigation / Referral'       : Navigation,
};

const getServiceIcon = (type = '') => {
  for (const [key, Icon] of Object.entries(SERVICE_TYPE_ICON)) {
    if (type.includes(key)) return Icon;
  }
  return Globe;
};

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function MessageContent({ content }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const isBullet = /^[•-]\s+/.test(line);
        const text     = isBullet ? line.replace(/^[•-]\s+/, '') : line;
        const renderBold = (str) =>
          str.split(/\*\*(.*?)\*\*/g).map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
          );
        if (isBullet) return (
          <div key={i} className="flex gap-2">
            <span className="mt-0.5 flex-shrink-0">•</span>
            <span>{renderBold(text)}</span>
          </div>
        );
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <div key={i}>{renderBold(line)}</div>;
      })}
    </div>
  );
}

// ─── Plan accordions ──────────────────────────────────────────────────────────

function PlanRow({ plan }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-800">{plan.planName || '—'}</span>
          {plan.meetsThreshold && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-medium">★ 100/25</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{plan.technology || 'Unknown'}</td>
      <td className="px-3 py-2">
        <div className="text-gray-700">{plan.price || '—'}</div>
        {plan.introDiscount && plan.introDiscount.trim() !== '$0' && (
          <div className="text-xs text-blue-600">{plan.introDiscount} off / {plan.introPeriod} mo</div>
        )}
        {plan.otherFees && plan.otherFees.trim() !== '$0' && (
          <div className="text-xs text-gray-400">+{plan.otherFees} fees</div>
        )}
      </td>
      <td className="px-3 py-2 text-gray-700 text-sm">{plan.downloadMbps || '—'}</td>
      <td className="px-3 py-2 text-gray-700 text-sm">{plan.uploadMbps || '—'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {plan.lowIncome === 'Yes' && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Low-income</span>
          )}
          {plan.contract === 'No' && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">No contract</span>
          )}
          {plan.dataCap === 'Yes' && plan.dataCapGB && (
            <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{plan.dataCapGB} GB cap</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function ProviderAccordion({ provider, plans, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const thresholdCount = plans.filter(p => p.meetsThreshold).length;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-800">{provider}</span>
          {thresholdCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
              ★ {thresholdCount} meet{thresholdCount === 1 ? 's' : ''} 100/25
            </span>
          )}
          <span className="text-xs text-gray-400">({plans.length} plan{plans.length !== 1 ? 's' : ''})</span>
        </div>
        <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium bg-white text-gray-500 border-b border-gray-100">
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Technology</th>
                <th className="px-3 py-2">Price/mo</th>
                <th className="px-3 py-2">↓ Mbps</th>
                <th className="px-3 py-2">↑ Mbps</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {plans.map((plan, i) => <PlanRow key={i} plan={plan} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlanTables({ planGroups }) {
  if (!planGroups) return null;
  const { threshold = [], byProvider = {} } = planGroups;

  // Merge threshold + non-threshold plans into a single per-provider map
  const allByProvider = {};
  for (const plan of threshold) {
    const key = plan.provider || 'Other';
    if (!allByProvider[key]) allByProvider[key] = [];
    allByProvider[key].push(plan);
  }
  for (const [provider, plans] of Object.entries(byProvider)) {
    const key = provider.trim() || 'Other';
    if (!allByProvider[key]) allByProvider[key] = [];
    allByProvider[key].push(...plans);
  }

  const providers = Object.entries(allByProvider).filter(([k]) => k.trim());
  if (!providers.length) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-gray-300" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Available Plans</h2>
        <div className="flex-1 h-px bg-gray-300" />
      </div>
      <div className="space-y-2">
        {providers.map(([provider, plans]) => (
          <ProviderAccordion key={provider} provider={provider} plans={plans} defaultOpen={false} />
        ))}
      </div>
    </div>
  );
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ service }) {
  const Icon = getServiceIcon(service.type);
  const distLabel = service.distanceMiles !== undefined
    ? `${service.distanceMiles.toFixed(1)} mi`
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={14} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm text-gray-900 leading-snug">{service.name}</div>
            {distLabel && (
              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{distLabel}</span>
            )}
          </div>
          <div className="text-xs text-blue-600 mb-1">{service.type}</div>
          <p className="text-xs text-gray-600 leading-snug">{service.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {service.phone && (
              <a href={`tel:${service.phone.replace(/\D/g,'')}`}
                 className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                <Phone size={11} />{service.phone}
              </a>
            )}
            {service.url && (
              <a href={service.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                <Globe size={11} />Website
              </a>
            )}
            {service.address && service.address !== 'Online / National' && !service.address.startsWith('Online') && !service.address.startsWith('Statewide') && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={11} />{service.address.split(',')[0]}
              </span>
            )}
          </div>
          {service.languages && service.languages !== 'English' && (
            <div className="mt-1 text-xs text-gray-400">🌐 {service.languages}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Service section with collapsible tiers ───────────────────────────────────

function DistanceTier({ label, count, services, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!services?.length) return null;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-semibold text-sm text-gray-800">
          {label} <span className="font-normal text-gray-400 text-xs">({count})</span>
        </span>
        <span className="text-gray-400 text-xs ml-2 flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 p-3 border-t border-gray-200 bg-white">
          {services.map((s, i) => <ServiceCard key={i} service={s} />)}
        </div>
      )}
    </div>
  );
}

function ServiceGroups({ serviceGroups }) {
  if (!serviceGroups) return null;
  const { within1, within5, national } = serviceGroups;
  const hasLocal = within1?.length || within5?.length;
  if (!hasLocal && !national?.length) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-gray-300" />
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Digital Inclusion Services</h2>
        <div className="flex-1 h-px bg-gray-300" />
      </div>
      <div className="space-y-2">
        {hasLocal ? (
          <>
            <DistanceTier label="Within 1 mile" count={within1?.length} services={within1} defaultOpen={false} />
            <DistanceTier label="1 – 5 miles"   count={within5?.length} services={within5} defaultOpen={false} />
          </>
        ) : (
          <p className="text-xs text-gray-400 italic px-1">No local services found within 5 miles.</p>
        )}
        <DistanceTier label="National / Virtual" count={national?.length} services={national} defaultOpen={false} />
      </div>
    </div>
  );
}

// ─── Main chatbot ─────────────────────────────────────────────────────────────

export default function Chatbot() {
  const [messages, setMessages]   = useState([
    { role: 'assistant', content: WELCOME_MESSAGE, planGroups: null, serviceGroups: null }
  ]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef            = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, planGroups: null, serviceGroups: null }]);
    setIsLoading(true);

    try {
      const apiUrl   = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json' },
        body    : JSON.stringify({
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, {
        role         : 'assistant',
        content      : data.message,
        planGroups   : data.planGroups    || null,
        serviceGroups: data.serviceGroups || null,
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        planGroups: null, serviceGroups: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">CC</div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">Caseworker Intelligence for Digital Inclusion</h1>
          <p className="text-xs text-gray-500 leading-tight">Clark County Government, NV</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Online
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">CC</div>
            )}
            <div className={message.role === 'user' ? 'max-w-xs md:max-w-lg lg:max-w-2xl' : 'flex-1 min-w-0'}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
              }`}>
                <MessageContent content={message.content} />
              </div>
              {message.role === 'assistant' && (
                <>
                  <PlanTables planGroups={message.planGroups} />
                  <ServiceGroups serviceGroups={message.serviceGroups} />
                </>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">CC</div>
            <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex space-x-1.5">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter an address or ask a question..."
            className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Enter a Clark County address to see internet plans and nearby digital inclusion services
        </p>
      </div>

    </div>
  );
}