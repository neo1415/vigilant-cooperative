'use client';

import { useState } from 'react';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'How do I become a member?',
      answer: 'Register on the platform with your employee ID, phone number, and email. After admin approval, you\'ll receive your unique member ID and can start making savings deposits.',
    },
    {
      question: 'What are the loan eligibility requirements?',
      answer: 'You must have an active employment status, maintain a minimum savings balance, and meet the loan-to-savings ratio (typically 2:1). Short-term loans require 2 guarantors, while long-term loans require 4 guarantors.',
    },
    {
      question: 'How long does loan approval take?',
      answer: 'Once all guarantors consent, the approval workflow begins. The President reviews first, then the Loan Committee (requires 2 attestations), and finally the Treasurer. Most loans are approved within 3-5 business days.',
    },
    {
      question: 'Can I withdraw from my savings anytime?',
      answer: 'Yes, but withdrawals are limited to 25% of your normal savings balance per transaction, and you cannot reduce your balance to zero. Special savings have different rules and may require officer approval.',
    },
    {
      question: 'How is my data protected?',
      answer: 'All sensitive data (employee ID, phone, BVN, bank accounts) is encrypted with AES-256-GCM. We use bcrypt for passwords, TOTP for MFA, and maintain a tamper-evident audit log of all operations. The platform is NDPR compliant.',
    },
  ];

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-xl text-text-secondary">
            Everything you need to know about the platform
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-surface-elevated/50 transition-colors"
              >
                <span className="font-display font-semibold text-lg pr-4">{faq.question}</span>
                <svg
                  className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-5 text-text-secondary leading-relaxed">{faq.answer}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
