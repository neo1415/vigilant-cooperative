'use client';

import { useEffect, useRef, useState } from 'react';

export function StatsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const stats: Array<{
    value: number;
    suffix: string;
    prefix: string;
    label: string;
    format: 'number' | 'currency' | 'decimal';
  }> = [
    { value: 45000000, suffix: '', prefix: '₦', label: 'Total Savings', format: 'currency' },
    { value: 150, suffix: '+', prefix: '', label: 'Active Members', format: 'number' },
    { value: 98.5, suffix: '%', prefix: '', label: 'Repayment Rate', format: 'decimal' },
    { value: 24, suffix: ' hrs', prefix: '', label: 'Avg. Processing Time', format: 'number' },
  ];

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="font-mono text-4xl sm:text-5xl font-bold gradient-text mb-2">
                {isVisible ? (
                  <AnimatedCounter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    format={stat.format}
                  />
                ) : (
                  <span>
                    {stat.prefix}0{stat.suffix}
                  </span>
                )}
              </div>
              <div className="text-sm sm:text-base text-text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  format = 'number',
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: 'number' | 'currency' | 'decimal';
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatValue = (val: number) => {
    if (format === 'currency') {
      return val.toLocaleString();
    }
    if (format === 'decimal') {
      return val.toFixed(1);
    }
    return val.toString();
  };

  return (
    <span>
      {prefix}
      {formatValue(count)}
      {suffix}
    </span>
  );
}
