import Link from 'next/link';

export function CTAFooter() {
  return (
    <>
      {/* CTA Banner */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background blob */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgb(var(--color-primary)), transparent)',
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-6">
            Ready to Take Control of Your <span className="gradient-text">Financial Future?</span>
          </h2>
          <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
            Join your colleagues in building wealth through cooperative savings and smart lending.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 rounded-lg gradient-bg text-white font-medium text-lg hover:opacity-90 transition-opacity"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-lg glass hover:bg-surface-elevated font-medium text-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <span className="font-display text-xl font-bold">Vigilant</span>
              </div>
              <p className="text-sm text-text-secondary">
                Empowering Vigilant Insurance staff with transparent, secure cooperative banking.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h3 className="font-display font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>
                  <Link href="#features" className="hover:text-text-primary transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-text-primary transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="#security" className="hover:text-text-primary transition-colors">
                    Security
                  </Link>
                </li>
                <li>
                  <Link href="#faq" className="hover:text-text-primary transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            {/* Governance */}
            <div>
              <h3 className="font-display font-semibold mb-4">Governance</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>
                  <Link href="/about" className="hover:text-text-primary transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/bylaws" className="hover:text-text-primary transition-colors">
                    Bylaws
                  </Link>
                </li>
                <li>
                  <Link href="/officers" className="hover:text-text-primary transition-colors">
                    Officers
                  </Link>
                </li>
                <li>
                  <Link href="/reports" className="hover:text-text-primary transition-colors">
                    Financial Reports
                  </Link>
                </li>
              </ul>
            </div>

            {/* Security & Legal */}
            <div>
              <h3 className="font-display font-semibold mb-4">Security & Legal</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li>
                  <Link href="/privacy" className="hover:text-text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-text-primary transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/compliance" className="hover:text-text-primary transition-colors">
                    NDPR Compliance
                  </Link>
                </li>
                <li>
                  <Link href="/audit" className="hover:text-text-primary transition-colors">
                    Audit Logs
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8 border-t border-border text-center text-sm text-text-secondary">
            <p>&copy; {new Date().getFullYear()} Vigilant Insurance Staff Cooperative. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
