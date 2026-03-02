export function TrustMarquee() {
  const badges = [
    { icon: '🔒', text: 'Bank-Level Encryption' },
    { icon: '📊', text: 'Complete Audit Trail' },
    { icon: '✓', text: 'NDPR Compliant' },
    { icon: '🛡️', text: 'Multi-Factor Auth' },
    { icon: '💰', text: 'Insured Deposits' },
    { icon: '⚡', text: 'Instant Approvals' },
  ];

  return (
    <div className="relative overflow-hidden py-8 border-y border-border bg-surface/50">
      <div className="flex animate-marquee">
        {/* Duplicate items for seamless loop */}
        {[...badges, ...badges].map((badge, index) => (
          <div
            key={index}
            className="flex items-center space-x-3 px-8 whitespace-nowrap"
          >
            <span className="text-2xl">{badge.icon}</span>
            <span className="text-sm font-medium text-text-secondary">{badge.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
