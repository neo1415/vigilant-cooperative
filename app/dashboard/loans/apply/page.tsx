/**
 * Multi-Step Loan Application Form
 * Implements 4-step loan application process with validation
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { formatNaira } from '../../../../utils/financial';
import { toKoboAmount } from '../../../../types/branded';
import { get, apiClient } from '@/lib/api-client';

interface EligibilityData {
  eligible: boolean;
  eligibilityKobo: number;
  eligibilityFormatted: string;
  canApplyLongTerm: boolean;
  canApplyShortTerm: boolean;
  activeLongTermCount: number;
  activeShortTermCount: number;
}

interface Member {
  id: string;
  memberId: string;
  fullName: string;
  department: string | null;
}

interface FormData {
  loanType: 'SHORT_TERM' | 'LONG_TERM' | '';
  principalKobo: number;
  repaymentMonths: number;
  purpose: string;
  purposeDetail: string;
  guarantorIds: string[];
}

const LOAN_PURPOSES = [
  { value: 'EDUCATION', label: 'Education' },
  { value: 'MEDICAL', label: 'Medical Expenses' },
  { value: 'HOUSING', label: 'Housing/Rent' },
  { value: 'BUSINESS', label: 'Business Investment' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'OTHER', label: 'Other' },
];


export default function LoanApplicationPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    loanType: '',
    principalKobo: 0,
    repaymentMonths: 6,
    purpose: '',
    purposeDetail: '',
    guarantorIds: [],
  });

  const [loanTerms, setLoanTerms] = useState({
    interestKobo: 0,
    totalRepayableKobo: 0,
    monthlyInstallmentKobo: 0,
    interestRate: 0,
  });

  useEffect(() => {
    fetchEligibility();
    fetchMembers();
  }, []);

  useEffect(() => {
    if (formData.loanType && formData.principalKobo > 0) {
      const rate = formData.loanType === 'SHORT_TERM' ? 0.05 : 0.10;
      const interest = Math.floor(formData.principalKobo * rate);
      const total = formData.principalKobo + interest;
      const monthly = Math.floor(total / formData.repaymentMonths);
      setLoanTerms({
        interestKobo: interest,
        totalRepayableKobo: total,
        monthlyInstallmentKobo: monthly,
        interestRate: rate * 100,
      });
    }
  }, [formData.loanType, formData.principalKobo, formData.repaymentMonths]);

  const fetchEligibility = async () => {
    try {
      const result = await get<EligibilityData>('/api/v1/loans/eligibility');
      if (result.success && result.data) {
        setEligibility(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const result = await get<{ members: Member[] }>('/api/v1/members/eligible-guarantors');
      if (result.success && result.data) {
        setMembers(result.data.members || []);
      }
    } catch {
      console.error('Failed to fetch members');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient('/api/v1/loans', {
        method: 'POST',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          loanType: formData.loanType,
          principalKobo: formData.principalKobo,
          repaymentMonths: formData.repaymentMonths,
          purpose: formData.purpose,
          purposeDetail: formData.purposeDetail || undefined,
          guarantorIds: formData.guarantorIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit');
      router.push(`/loans?success=true&ref=${data.data.loanReference}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">Not Eligible</h2>
          <p className="text-muted-foreground mb-4">You are not currently eligible to apply for a loan.</p>
          <Button onClick={() => router.push('/loans')}>Back to Loans</Button>
        </Card>
      </div>
    );
  }

  const minGuarantors = formData.loanType === 'SHORT_TERM' ? 2 : 3;
  const maxMonths = formData.loanType === 'SHORT_TERM' ? 6 : 12;
  const filteredMembers = members.filter(m =>
    m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.memberId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Apply for a Loan</h1>
        <p className="text-muted-foreground">Complete the application process</p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step < currentStep ? 'bg-green-500 text-white' :
                step === currentStep ? 'bg-primary text-white' :
                'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {step < currentStep ? '✓' : step}
              </div>
              {step < 4 && <div className={`flex-1 h-1 mx-2 ${
                step < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
              }`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Type</span>
          <span>Amount</span>
          <span>Guarantors</span>
          <span>Review</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Card className="p-6 mb-6">
        {/* Step 1: Loan Type */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Select Loan Type</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setFormData(prev => ({ ...prev, loanType: 'SHORT_TERM', repaymentMonths: 6 }))}
                disabled={!eligibility.canApplyShortTerm}
                className={`p-6 border-2 rounded-lg text-left ${
                  formData.loanType === 'SHORT_TERM' ? 'border-primary bg-primary/5' : 'border-border'
                } ${!eligibility.canApplyShortTerm ? 'opacity-50' : ''}`}
              >
                <h3 className="text-xl font-semibold mb-4">Short-Term Loan</h3>
                <p className="text-sm text-muted-foreground">Up to 6 months • 5% interest • 2 guarantors</p>
                <p className="text-sm mt-2">Active: {eligibility.activeShortTermCount} / 2</p>
              </button>
              <button
                onClick={() => setFormData(prev => ({ ...prev, loanType: 'LONG_TERM', repaymentMonths: 12 }))}
                disabled={!eligibility.canApplyLongTerm}
                className={`p-6 border-2 rounded-lg text-left ${
                  formData.loanType === 'LONG_TERM' ? 'border-primary bg-primary/5' : 'border-border'
                } ${!eligibility.canApplyLongTerm ? 'opacity-50' : ''}`}
              >
                <h3 className="text-xl font-semibold mb-4">Long-Term Loan</h3>
                <p className="text-sm text-muted-foreground">Up to 12 months • 10% interest • 3 guarantors</p>
                <p className="text-sm mt-2">Active: {eligibility.activeLongTermCount} / 1</p>
              </button>
            </div>
          </div>
        )}


        {/* Step 2: Amount and Purpose */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Loan Amount and Purpose</h2>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (₦) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.principalKobo > 0 ? (formData.principalKobo / 100).toFixed(2) : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, principalKobo: Math.floor(parseFloat(e.target.value || '0') * 100) }))}
                className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.00"
              />
              <p className="mt-1 text-sm text-muted-foreground">Max: {eligibility.eligibilityFormatted}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Repayment Period (Months) *</label>
              <input
                type="number"
                min="1"
                max={maxMonths}
                value={formData.repaymentMonths}
                onChange={(e) => setFormData(prev => ({ ...prev, repaymentMonths: Math.min(maxMonths, Math.max(1, parseInt(e.target.value) || 1)) }))}
                className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-sm text-muted-foreground">Max: {maxMonths} months</p>
            </div>
            {loanTerms.totalRepayableKobo > 0 && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                <h3 className="font-semibold">Loan Terms Preview</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Principal</p>
                    <p className="font-mono font-semibold">{formatNaira(toKoboAmount(formData.principalKobo))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Interest ({loanTerms.interestRate}%)</p>
                    <p className="font-mono font-semibold">{formatNaira(toKoboAmount(loanTerms.interestKobo))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Repayable</p>
                    <p className="font-mono font-semibold text-primary">{formatNaira(toKoboAmount(loanTerms.totalRepayableKobo))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly Installment</p>
                    <p className="font-mono font-semibold">{formatNaira(toKoboAmount(loanTerms.monthlyInstallmentKobo))}</p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Purpose *</label>
              <select
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a purpose</option>
                {LOAN_PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Additional Details (Optional)</label>
              <textarea
                value={formData.purposeDetail}
                onChange={(e) => setFormData(prev => ({ ...prev, purposeDetail: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                maxLength={500}
              />
            </div>
          </div>
        )}

        {/* Step 3: Guarantor Selection */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Select Guarantors</h2>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold">{formData.guarantorIds.length} of {minGuarantors} required guarantors selected</p>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members..."
              className="w-full px-4 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredMembers.map(member => {
                const isSelected = formData.guarantorIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        guarantorIds: isSelected
                          ? prev.guarantorIds.filter(id => id !== member.id)
                          : [...prev.guarantorIds, member.id]
                      }));
                    }}
                    className={`w-full p-4 border-2 rounded-lg text-left ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        isSelected ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        {isSelected ? '✓' : member.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{member.fullName}</p>
                        <p className="text-sm text-muted-foreground">{member.memberId} {member.department && `• ${member.department}`}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Review Your Application</h2>
            <div className="p-6 bg-surface border border-border rounded-lg space-y-4">
              <h3 className="font-semibold text-lg">Loan Details</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Loan Type</p>
                  <p className="font-semibold">{formData.loanType === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repayment Period</p>
                  <p className="font-semibold">{formData.repaymentMonths} months</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <p className="font-semibold">{LOAN_PURPOSES.find(p => p.value === formData.purpose)?.label}</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <h3 className="font-semibold text-lg">Financial Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Principal</span>
                  <span className="font-mono font-semibold">{formatNaira(toKoboAmount(formData.principalKobo))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Interest ({loanTerms.interestRate}%)</span>
                  <span className="font-mono font-semibold">{formatNaira(toKoboAmount(loanTerms.interestKobo))}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">Total Repayable</span>
                  <span className="font-mono font-bold text-primary">{formatNaira(toKoboAmount(loanTerms.totalRepayableKobo))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Installment</span>
                  <span className="font-mono font-semibold">{formatNaira(toKoboAmount(loanTerms.monthlyInstallmentKobo))}</span>
                </div>
              </div>
            </div>
            <div className="p-6 bg-surface border border-border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Guarantors ({formData.guarantorIds.length})</h3>
              <div className="space-y-2">
                {members.filter(m => formData.guarantorIds.includes(m.id)).map((g, i) => (
                  <div key={g.id} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">{i + 1}</div>
                    <div>
                      <p className="font-semibold">{g.fullName}</p>
                      <p className="text-sm text-muted-foreground">{g.memberId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex gap-4">
        {currentStep > 1 && (
          <Button variant="secondary" onClick={() => setCurrentStep(prev => prev - 1)} disabled={submitting} className="flex-1">
            Back
          </Button>
        )}
        {currentStep < 4 ? (
          <Button
            variant="primary"
            onClick={() => {
              if (currentStep === 1 && !formData.loanType) return;
              if (currentStep === 2 && (formData.principalKobo <= 0 || !formData.purpose)) return;
              if (currentStep === 3 && formData.guarantorIds.length < minGuarantors) return;
              setCurrentStep(prev => prev + 1);
            }}
            className="flex-1"
          >
            Continue
          </Button>
        ) : (
          <Button variant="primary" onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        )}
      </div>
    </div>
  );
}
