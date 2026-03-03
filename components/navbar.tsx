'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { isAuthenticated } from '@/lib/auth';

export function Navbar() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMemberPortalClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'glass shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="font-display text-xl font-bold">Vigilant</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#security"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Security
            </Link>
            <Link
              href="#faq"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              FAQ
            </Link>
          </div>

          {/* Right side buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={handleMemberPortalClick}
              className="px-6 py-2 rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition-opacity"
            >
              Member Portal
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg glass hover:bg-surface-elevated transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden glass border-t border-border">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="#features"
              className="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              href="#security"
              className="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Security
            </Link>
            <Link
              href="#faq"
              className="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              FAQ
            </Link>
            <div className="pt-3 border-t border-border space-y-2">
              <Link
                href="/login"
                className="block px-4 py-2 text-center text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <button
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleMemberPortalClick(e);
                }}
                className="block w-full px-4 py-2 text-center rounded-lg gradient-bg text-white font-medium hover:opacity-90 transition-opacity"
              >
                Member Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
