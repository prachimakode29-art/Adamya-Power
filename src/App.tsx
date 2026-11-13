/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Services } from './components/Services';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { LeadsWorkspace } from './components/LeadsWorkspace';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.hash === '#admin'
  );
  const [selectedService, setSelectedService] = useState<string>('Civil Engineering');

  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openAdminPortal = () => {
    window.location.hash = '#admin';
    setIsAdminRoute(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exitAdminPortal = () => {
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setIsAdminRoute(false);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900">
      <Header isAdminView={isAdminRoute} onExitAdmin={exitAdminPortal} />

      {isAdminRoute ? (
        <main>
          <LeadsWorkspace onBackToWebsite={exitAdminPortal} />
        </main>
      ) : (
        <main>
          <Hero />
          <Services onSelectService={setSelectedService} />
          <Contact selectedService={selectedService} />
        </main>
      )}

      <Footer onOpenAdmin={openAdminPortal} />
    </div>
  );
}
