export function SecuritySection() {
  return (
    <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          {/* Text content - 60% */}
          <div className="lg:col-span-3 space-y-6">
            <h2 className="font-display text-4xl sm:text-5xl font-bold">
              Bank-Level <span className="gradient-text">Security</span>
            </h2>

            <p className="text-lg text-text-secondary leading-relaxed">
              Your financial data is protected with military-grade AES-256-GCM encryption. Every sensitive field—from employee IDs to bank account numbers—is encrypted at rest and in transit. We never store plaintext sensitive data.
            </p>

            <p className="text-lg text-text-secondary leading-relaxed">
              Our tamper-evident audit log uses blockchain-inspired chain hashing to detect any unauthorized modifications. Every action is recorded with full before/after state, IP address, and timestamp—creating an immutable trail of all financial operations.
            </p>

            <p className="text-lg text-text-secondary leading-relaxed">
              Multi-factor authentication (MFA) is enforced for all officers handling financial operations. We use TOTP-based codes with backup recovery options, rate limiting, and replay attack prevention to ensure only authorized users can access critical functions.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center space-x-2 px-4 py-2 rounded-lg glass">
                <svg className="w-5 h-5 text-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">AES-256-GCM</span>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 rounded-lg glass">
                <svg className="w-5 h-5 text-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">TOTP MFA</span>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 rounded-lg glass">
                <svg className="w-5 h-5 text-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Audit Trail</span>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 rounded-lg glass">
                <svg className="w-5 h-5 text-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">NDPR Compliant</span>
              </div>
            </div>
          </div>

          {/* Visual - 40% */}
          <div className="lg:col-span-2 flex justify-center">
            <div className="relative w-64 h-64">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Shield outline */}
                <path
                  d="M100 20 L160 40 L160 100 Q160 140 100 180 Q40 140 40 100 L40 40 Z"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="2"
                  className="drop-shadow-lg"
                />

                {/* Checkmark */}
                <path
                  d="M70 100 L90 120 L130 70"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Animated rings */}
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="1"
                  opacity="0.3"
                  className="animate-ring-pulse"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="1"
                  opacity="0.2"
                  className="animate-ring-pulse"
                  style={{ animationDelay: '0.5s' }}
                />
                <circle
                  cx="100"
                  cy="100"
                  r="100"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="1"
                  opacity="0.1"
                  className="animate-ring-pulse"
                  style={{ animationDelay: '1s' }}
                />

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgb(26, 107, 255)" />
                    <stop offset="100%" stopColor="rgb(0, 200, 150)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
