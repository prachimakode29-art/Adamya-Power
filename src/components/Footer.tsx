import React from 'react';
import { Lock } from 'lucide-react';

interface FooterProps {
  onOpenAdmin: () => void;
}

export function Footer({ onOpenAdmin }: FooterProps) {
  return (
    <footer className="bg-white border-t border-gray-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Adamya Power & Industrial Solutions Logo"
              className="h-12 w-12 rounded-xl object-cover border border-gray-100 bg-white"
            />
            <div className="flex flex-col">
              <span className="text-[#0c2340] font-extrabold text-xl leading-none tracking-wide">
                ADAMYA
              </span>
              <span className="text-[#0055cc] text-[0.55rem] font-bold tracking-widest leading-tight mt-1">
                POWER &amp; INDUSTRIAL SOLUTIONS
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-gray-500">
            <a href="#services" className="hover:text-[#0055cc] transition-colors">
              Services
            </a>
            <a href="#contact" className="hover:text-[#0055cc] transition-colors">
              Request a Quote
            </a>
            <a href="mailto:adamyapower@gmail.com" className="hover:text-[#0055cc] transition-colors">
              adamyapower@gmail.com
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1 text-gray-400 hover:text-[#0c2340] transition-colors text-xs"
              title="Admin & Co-Admin Portal"
            >
              <Lock size={12} />
              Admin Login
            </button>
          </div>

          <div className="text-sm text-gray-400 text-center md:text-right">
            &copy; {new Date().getFullYear()} Adamya Power &amp; Industrial Solutions. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
