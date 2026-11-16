import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Map, HelpCircle, MessageSquare, Phone, Mail, AlertCircle,
  ChevronDown, Send, Loader
} from 'lucide-react';

export default function HelpSupport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [expanded, setExpanded] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const faqs = [
    {
      question: 'How do I book a ride?',
      answer: 'Go to Dashboard, enter your pickup and dropoff locations, and click "Find Autos". You can then select a driver from the available options.'
    },
    {
      question: 'How do I cancel a ride?',
      answer: 'If you have an active ride, you can cancel it from the ride details. Note that cancellations may incur charges if the driver has already started.'
    },
    {
      question: 'Why is my ride not being accepted?',
      answer: 'Make sure there are drivers available in your area. Try refreshing the page or searching again. Peak hours might have higher demand.'
    },
    {
      question: 'How do I contact support?',
      answer: 'You can reach our support team through the contact form below or call our customer service hotline available 24/7.'
    },
    {
      question: 'What is your safety policy?',
      answer: 'We prioritize passenger safety. All drivers are verified with valid licenses and insurance. Share your ride details with trusted contacts.'
    },
    {
      question: 'How do I rate a driver?',
      answer: 'After a completed ride, you can rate your driver on a scale of 1-5 stars. Your feedback helps us maintain service quality.'
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({ title: "Success", description: "Your message has been sent to our support team!" });
      setSubject('');
      setMessage('');
    } catch (err) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden lg:flex flex-col">
        <div className="px-6 py-5 flex items-center gap-2 border-b">
          <div className="bg-[#E0F2FE] p-1.5 rounded-lg"><Map className="w-6 h-6 text-[#0D9488]"/></div>
          <span className="text-2xl font-extrabold text-[#0D9488]">ChaloAuto</span>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {[
            { label: 'Dashboard', path: '/passenger' },
            { label: 'Find Rides', path: '/find-rides' },
            { label: 'My Bookings', path: '/bookings' },
            { label: 'Profile', path: '/profile' },
            { label: 'Help & Support', path: '/help', active: true },
            { label: 'Simulation', path: '/simulation' },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                item.active
                  ? 'bg-[#ECFDF5] text-[#0D9488]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen">
        <header className="bg-white px-8 py-4 border-b flex justify-between items-center">
          <h1 className="text-2xl font-bold">Help & Support</h1>
          <button onClick={() => navigate('/passenger')} className="text-slate-500 hover:text-slate-700 text-sm font-semibold">Back to Dashboard</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          {/* Contact Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-800">Call Us</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">Available 24/7</p>
              <p className="text-lg font-semibold text-slate-800">+91 9876543210</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-bold text-slate-800">Email Us</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">Response in 24 hours</p>
              <p className="text-lg font-semibold text-slate-800">support@chaloauto.com</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-800">Chat</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">Instant support online</p>
              <p className="text-lg font-semibold text-slate-800">Live Chat Available</p>
            </div>
          </div>

          {/* FAQs */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8">
            <h2 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#0D9488]" /> Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-slate-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-semibold text-slate-800 text-left">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${expanded === idx ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded === idx && (
                    <div className="px-6 py-4 bg-white border-t border-slate-100">
                      <p className="text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-2xl border border-slate-100 p-8">
            <h2 className="font-bold text-slate-800 text-lg mb-6">Send us a Message</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Your Name</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={user?.phone || ''}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D9488]"
                >
                  <option value="">Select a subject</option>
                  <option value="booking">Issue with Booking</option>
                  <option value="payment">Payment Issue</option>
                  <option value="driver">Driver Complaint</option>
                  <option value="safety">Safety Concern</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder="Please describe your issue in detail..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D9488] resize-none"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">Our support team will respond to your inquiry within 24 hours.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-[#0D9488] hover:bg-teal-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
