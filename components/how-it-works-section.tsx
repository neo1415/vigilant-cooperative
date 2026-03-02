export function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Register & Get Approved',
      description: 'Submit your employee details and wait for admin approval. Receive your unique member ID and virtual account.',
    },
    {
      number: '02',
      title: 'Save & Build Credit',
      description: 'Make regular savings deposits via payroll deduction or bank transfer. Build your savings to unlock loan eligibility.',
    },
    {
      number: '03',
      title: 'Apply & Access Loans',
      description: 'Apply for loans based on your savings. Get guarantor consent, approval from officers, and instant disbursement.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Three simple steps to financial empowerment
          </p>
        </div>

        {/* Desktop: Horizontal layout */}
        <div className="hidden md:flex items-start justify-between relative">
          {steps.map((step, index) => (
            <div key={step.number} className="flex-1 relative">
              <div className="flex flex-col items-center text-center">
                {/* Step number */}
                <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-6 relative z-10">
                  <span className="font-display text-3xl font-bold gradient-text">{step.number}</span>
                </div>

                {/* Content */}
                <h3 className="font-display text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-text-secondary max-w-xs">{step.description}</p>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute top-10 left-1/2 w-full h-0.5 border-t-2 border-dashed border-border" />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: Vertical layout */}
        <div className="md:hidden space-y-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="flex items-start space-x-4">
                {/* Step number */}
                <div className="w-16 h-16 rounded-xl glass flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-2xl font-bold gradient-text">{step.number}</span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="font-display text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-text-secondary">{step.description}</p>
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-8 top-16 w-0.5 h-8 border-l-2 border-dashed border-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
