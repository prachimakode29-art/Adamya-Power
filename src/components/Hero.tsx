import React from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { Button } from './ui/Button';

export function Hero() {
  return (
    <section className="relative pt-14 pb-10 md:pt-16 md:pb-12 overflow-hidden bg-white">
      {/* Professional background accents matching the logo's presentation */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-[#0055cc]/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-[#0055cc]/10 to-transparent rounded-full blur-3xl"></div>
        {/* Subtle diagonal architectural lines */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.12] bg-[linear-gradient(115deg,transparent_40%,#0055cc_41%,transparent_42%,transparent_48%,#0055cc_49%,transparent_50%)]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#0055cc] text-sm font-semibold mb-5 border border-blue-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
            </span>
            Civil, Electrical &amp; Mechanical Excellence
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0c2340] leading-tight mb-5">
            Powering Industries.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#003399] to-[#0066cc]">
              Building the Future.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl leading-relaxed">
            Delivering premium civil, electrical, and mechanical engineering solutions. We build trust through precision, safety, and future-ready infrastructure for your projects.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="primary" className="gap-2 text-lg px-8 py-4" asChild>
              <a href="#contact">
                Request a Quote
                <ArrowRight size={20} />
              </a>
            </Button>
            <Button variant="secondary" className="gap-2 text-lg px-8 py-4" asChild>
              <a href="https://wa.me/919183877729" target="_blank" rel="noopener noreferrer">
                <Phone size={20} />
                WhatsApp Us
              </a>
            </Button>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-6 sm:gap-8 text-sm text-gray-500 font-medium">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[#22c55e]">
                ✓
              </div>
              Future-Ready Architecture
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[#22c55e]">
                ✓
              </div>
              Precision Execution
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[#22c55e]">
                ✓
              </div>
              Safety First
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
