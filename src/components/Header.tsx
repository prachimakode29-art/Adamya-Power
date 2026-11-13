import React from 'react';
import { Menu, X, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';

interface HeaderProps {
  isAdminView: boolean;
  onExitAdmin: () => void;
}

export function Header({ isAdminView, onExitAdmin }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleNavigate = (sectionId: string) => {
    setIsMenuOpen(false);
    if (isAdminView) {
      onExitAdmin();
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => {
              if (isAdminView) onExitAdmin();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 text-left focus:outline-none"
          >
            <img
              src="/logo.jpg"
              alt="Adamya Power & Industrial Solutions Logo"
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover border border-gray-100 shadow-sm bg-white"
            />
            <div className="flex flex-col">
              <span className="text-[#0c2340] font-extrabold text-xl sm:text-2xl leading-none tracking-wide">
                ADAMYA
              </span>
              <span className="text-[#0055cc] text-[0.6rem] font-bold tracking-widest leading-tight mt-1">
                POWER &amp; INDUSTRIAL
                <br />
                SOLUTIONS
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          {isAdminView ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#0055cc] bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
                <ShieldCheck size={15} />
                Admin &amp; Co-Admin Portal
              </span>
              <Button type="button" variant="secondary" onClick={onExitAdmin} className="py-2 px-4 text-sm">
                Back to Website
              </Button>
            </div>
          ) : (
            <>
              <nav className="hidden md:flex items-center gap-8">
                <button
                  type="button"
                  onClick={() => handleNavigate('services')}
                  className="text-gray-600 hover:text-[#0055cc] font-medium transition-colors"
                >
                  Services
                </button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => handleNavigate('contact')}
                  className="py-2.5 px-5"
                >
                  Request a Quote
                </Button>
              </nav>

              {/* Mobile Menu Button */}
              <button
                type="button"
                className="md:hidden p-2 text-gray-600 hover:text-[#0055cc]"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle navigation menu"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Nav (Public only) */}
      {!isAdminView && isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100">
          <div className="px-4 pt-2 pb-6 space-y-3 flex flex-col">
            <button
              type="button"
              onClick={() => handleNavigate('services')}
              className="text-left px-3 py-2 text-gray-600 font-medium hover:bg-slate-50 rounded-md"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('contact')}
              className="px-3 py-2.5 text-center bg-gradient-to-r from-[#003399] to-[#0055cc] text-white rounded-md font-medium"
            >
              Request a Quote
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
