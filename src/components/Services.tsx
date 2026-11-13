import React from 'react';
import { Zap, Wrench, HardHat, Activity, Power, ClipboardCheck, ArrowRight } from 'lucide-react';

interface ServicesProps {
  onSelectService?: (serviceTitle: string) => void;
}

export function Services({ onSelectService }: ServicesProps) {
  const services = [
    {
      icon: <Zap className="w-8 h-8 text-[#0055cc]" />,
      title: 'Electrical Solutions',
      description:
        'HT/LT installations, substations, control panels, and complete industrial electrical wiring setups.',
    },
    {
      icon: <Wrench className="w-8 h-8 text-[#0055cc]" />,
      title: 'Mechanical Works',
      description:
        'Heavy machinery erection, piping networks, HVAC systems, and precision industrial fabrication.',
    },
    {
      icon: <HardHat className="w-8 h-8 text-[#0055cc]" />,
      title: 'Civil Engineering',
      description:
        'Construction of industrial sheds, robust foundation work, and core structural engineering.',
    },
    {
      icon: <Activity className="w-8 h-8 text-[#0055cc]" />,
      title: 'Plant Maintenance',
      description:
        'Routine industrial maintenance, comprehensive overhauling, and rapid emergency breakdown support.',
    },
    {
      icon: <Power className="w-8 h-8 text-[#0055cc]" />,
      title: 'Power Systems',
      description:
        'Integration of generators, renewable energy solutions, and high-voltage transmission lines.',
    },
    {
      icon: <ClipboardCheck className="w-8 h-8 text-[#0055cc]" />,
      title: 'Turnkey Projects',
      description:
        'End-to-end project execution from planning to commissioning with strict adherence to safety.',
    },
  ];

  const handleCardClick = (title: string) => {
    if (onSelectService) {
      onSelectService(title);
    }
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="services" className="pt-12 pb-16 md:pt-14 md:pb-20 bg-slate-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0c2340] mb-3">
            Our Core Expertise
          </h2>
          <p className="text-lg text-gray-600">
            Delivering precision, safety, and reliability across all domains of industrial execution and infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-7 border border-gray-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-xl bg-slate-50 shadow-sm flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 border border-gray-100">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold text-[#0c2340] mb-2.5">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-5">{service.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCardClick(service.title)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0055cc] hover:text-[#003399] transition-colors self-start"
              >
                Request Quote
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
