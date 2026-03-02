import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Animated blob backgrounds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl animate-blob"
          style={{
            background: 'radial-gradient(circle, rgb(var(--color-primary)), transparent)',
          }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl animate-blob"
          style={{
            background: 'radial-gradient(circle, rgb(var(--color-secondary)), transparent)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-96 h-96 rounded-full opacity-20 blur-3xl animate-blob"
          style={{
            background: 'radial-gradient(circle, rgb(var(--color-accent)), transparent)',
            animationDelay: '4s',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Text content */}
          <div className="space-y-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full glass">
              <svg
                className="w-4 h-4 mr-2 text-secondary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium">Official Platform</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight">
              Cooperative Banking,{' '}
              <span className="gradient-text">Transparent</span> & Secure
            </h1>

            <p className="text-xl text-text-secondary max-w-2xl">
              Empowering Vigilant Insurance staff with seamless savings, instant loan approvals,
              and complete financial transparency. Built for trust, designed for growth.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="px-8 py-4 rounded-lg gradient-bg text-white font-medium text-lg hover:opacity-90 transition-opacity text-center"
              >
                Get Started
              </Link>
              <Link
                href="#how-it-works"
                className="px-8 py-4 rounded-lg glass hover:bg-surface-elevated font-medium text-lg transition-colors text-center"
              >
                Learn More
              </Link>
            </div>

            {/* Social proof stats */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div>
                <div className="font-mono text-3xl font-bold gradient-text">150+</div>
                <div className="text-sm text-text-secondary mt-1">Active Members</div>
              </div>
              <div>
                <div className="font-mono text-3xl font-bold gradient-text">₦50M+</div>
                <div className="text-sm text-text-secondary mt-1">Managed Assets</div>
              </div>
              <div>
                <div className="font-mono text-3xl font-bold gradient-text">99.9%</div>
                <div className="text-sm text-text-secondary mt-1">Uptime</div>
              </div>
            </div>
          </div>

          {/* Right column - Dashboard mockup */}
          <div className="relative lg:block hidden">
            <div className="relative animate-mockup-enter">
              <div
                className="glass rounded-2xl p-6 shadow-2xl"
                style={{
                  transform: 'perspective(1000px) rotateY(-5deg) rotateX(5deg)',
                  transition: 'transform 0.3s ease',
                }}
              >
                {/* Mockup header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full gradient-bg" />
                    <div>
                      <div className="h-3 w-24 bg-text-tertiary/20 rounded" />
                      <div className="h-2 w-16 bg-text-tertiary/10 rounded mt-2" />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-text-tertiary/10" />
                    <div className="w-8 h-8 rounded-lg bg-text-tertiary/10" />
                  </div>
                </div>

                {/* Mockup metric cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs text-text-secondary mb-2">Total Savings</div>
                    <div className="font-mono text-2xl font-bold gradient-text">₦250,000</div>
                    <div className="text-xs text-secondary mt-1">+12.5% this month</div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs text-text-secondary mb-2">Active Loan</div>
                    <div className="font-mono text-2xl font-bold gradient-text">₦150,000</div>
                    <div className="text-xs text-text-secondary mt-1">6 months remaining</div>
                  </div>
                </div>

                {/* Mockup transaction list */}
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-text-tertiary/20" />
                        <div>
                          <div className="h-2 w-20 bg-text-tertiary/30 rounded" />
                          <div className="h-2 w-16 bg-text-tertiary/20 rounded mt-1" />
                        </div>
                      </div>
                      <div className="h-3 w-16 bg-text-tertiary/30 rounded" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 px-4 py-2 rounded-full glass shadow-lg animate-float">
                <span className="text-sm font-medium text-secondary">✓ Savings Updated</span>
              </div>
              <div
                className="absolute -bottom-4 -left-4 px-4 py-2 rounded-full glass shadow-lg animate-float"
                style={{ animationDelay: '1s' }}
              >
                <span className="text-sm font-medium text-primary">✓ Loan Approved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
