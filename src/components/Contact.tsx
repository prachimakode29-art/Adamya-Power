import React, { useEffect, useState } from 'react';
import { Mail, Phone, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { createPublicEnquiry } from '../lib/firestoreEnquiries';

interface ContactProps {
  selectedService?: string;
}

export function Contact({ selectedService = 'Civil Engineering' }: ContactProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: selectedService,
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    whatsappUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (selectedService) {
      setFormData((prev) => ({ ...prev, service: selectedService }));
    }
  }, [selectedService]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      service: formData.service,
      message: formData.message.trim(),
    };

    try {
      // Save to Firestore for Admin & Co-Admin, and trigger Make.com webhook in parallel
      const [dbResult, webhookResult] = await Promise.allSettled([
        createPublicEnquiry(payload),
        fetch('https://hook.eu1.make.com/twr67rrzbsf4a8binrdut73pnl4frxwe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ]);

      if (dbResult.status === 'rejected' && webhookResult.status === 'rejected') {
        throw new Error('Both database and webhook submission failed.');
      }

      const waMessage = `Hello Adamya Power, I just submitted a quote request.\nName: ${payload.name}\nService: ${payload.service}\nPhone: ${payload.phone}\nRequirement: ${payload.message}`;
      const whatsappUrl = `https://wa.me/919183877729?text=${encodeURIComponent(waMessage)}`;

      setSubmitFeedback({
        type: 'success',
        text: 'Thank you! Your enquiry has been received. Our engineering team will send your quotation shortly.',
        whatsappUrl,
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        service: selectedService || 'Civil Engineering',
        message: '',
      });
    } catch (error) {
      console.error('Error sending form:', error);
      setSubmitFeedback({
        type: 'error',
        text: 'There was an error sending your enquiry. Please try again or reach us directly on WhatsApp.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-16 md:py-20 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left side: Contact Info */}
            <div className="p-10 lg:p-16 bg-gradient-to-br from-[#0c2340] to-[#003399] text-white">
              <h2 className="text-3xl font-extrabold mb-4 text-white">Ready to streamline?</h2>
              <p className="text-blue-100 mb-10 text-lg">
                Get in touch for a custom quote or to learn how we can help execute your next civil, electrical, or mechanical project.
              </p>

              <div className="space-y-8">
                <a href="tel:+919183877729" className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <Phone className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Call Us</h4>
                    <p className="text-blue-200">+91 91838 77729</p>
                    <p className="text-sm text-blue-300 mt-1">Mon-Sat, 9am to 6pm</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/919183877729"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <MessageSquare className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">WhatsApp</h4>
                    <p className="text-blue-200">+91 91838 77729</p>
                    <p className="text-sm text-blue-300 mt-1">Quick replies within 2 hours</p>
                  </div>
                </a>

                <a href="mailto:adamyapower@gmail.com" className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                    <Mail className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Email</h4>
                    <p className="text-blue-200">adamyapower@gmail.com</p>
                    <p className="text-sm text-blue-300 mt-1">Drop us a line anytime</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Right side: Form */}
            <div className="p-10 lg:p-16">
              <h3 className="text-2xl font-bold text-[#0c2340] mb-6">Request a Quote</h3>

              {submitFeedback && (
                <div
                  className={`mb-6 p-4 rounded-xl border text-sm space-y-3 ${
                    submitFeedback.type === 'success'
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {submitFeedback.type === 'success' ? (
                      <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-[#22c55e]" />
                    ) : (
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    )}
                    <span>{submitFeedback.text}</span>
                  </div>
                  {submitFeedback.whatsappUrl && (
                    <div className="pt-1">
                      <a
                        href={submitFeedback.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e] text-white font-semibold text-xs hover:bg-[#16a34a]"
                      >
                        <MessageSquare size={14} />
                        Chat on WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      maxLength={120}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#0055cc] focus:border-transparent outline-none transition-all"
                      placeholder="Your Name / Company"
                    />
                  </div>
                  <div>
                    <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-1">
                      Service Required
                    </label>
                    <select
                      id="service"
                      value={formData.service}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-[#0055cc] focus:border-transparent outline-none transition-all"
                    >
                      <option value="Civil Engineering">Civil Engineering</option>
                      <option value="Electrical Solutions">Electrical Solutions</option>
                      <option value="Mechanical Works">Mechanical Works</option>
                      <option value="Plant Maintenance">Plant Maintenance</option>
                      <option value="Power Systems">Power Systems</option>
                      <option value="Turnkey Projects">Turnkey Projects</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      maxLength={160}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#0055cc] focus:border-transparent outline-none transition-all"
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone / WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      maxLength={40}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#0055cc] focus:border-transparent outline-none transition-all"
                      placeholder="+91 91838 77729"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Requirements
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    required
                    maxLength={2000}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#0055cc] focus:border-transparent outline-none transition-all resize-none"
                    placeholder="Tell us about your civil, electrical, or mechanical project requirements..."
                  ></textarea>
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 text-lg mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Enquiry'}
                </Button>
                <p className="text-center text-sm text-gray-500 mt-3">
                  We&apos;ll get back to you within 24 hours. No obligations.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
