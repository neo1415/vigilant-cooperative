'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface MemberProfile {
  id: string;
  memberId: string;
  fullName: string;
  email: string | null;
  department: string | null;
  employmentStatus: string | null;
  dateJoined: string;
  isApproved: boolean;
  roles: string[];
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SavingsAccount {
  id: string;
  accountType: string;
  balanceKobo: number;
}

interface ActiveLoan {
  id: string;
  loanReference: string;
  loanType: string;
  principalKobo: number;
  outstandingKobo: number;
  status: string;
}

interface ProfileData {
  profile: MemberProfile;
  savingsAccounts: SavingsAccount[];
  activeLoans: ActiveLoan[];
}

export default function MemberProfilePage() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    email: '',
    department: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('http://localhost:3001/api/v1/members/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const result = await response.json();
      setProfileData(result.data);
      setEditForm({
        email: result.data.profile.email || '',
        department: result.data.profile.department || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('http://localhost:3001/api/v1/members/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editForm,
          version: profileData?.profile ? 1 : 0, // Simplified version handling
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update profile');
      }

      await fetchProfile();
      setIsEditModalOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setEditLoading(false);
    }
  };

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(kobo / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent>
            <p className="text-accent text-center">{error || 'Failed to load profile'}</p>
            <Button onClick={fetchProfile} className="mt-4 w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, savingsAccounts, activeLoans } = profileData;
  const normalSavings = savingsAccounts.find((acc) => acc.accountType === 'NORMAL');
  const specialSavings = savingsAccounts.find((acc) => acc.accountType === 'SPECIAL');

  return (
    <div className="min-h-screen bg-base p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-text-primary">
              Member Profile
            </h1>
            <p className="text-text-secondary mt-1">
              View and manage your cooperative account
            </p>
          </div>
          <Button onClick={() => setIsEditModalOpen(true)}>
            Edit Profile
          </Button>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-text-secondary">Member ID</p>
                <p className="font-mono text-lg font-semibold text-text-primary">
                  {profile.memberId}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Full Name</p>
                <p className="text-lg font-semibold text-text-primary">
                  {profile.fullName}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Email</p>
                <p className="text-lg text-text-primary">
                  {profile.email || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Department</p>
                <p className="text-lg text-text-primary">
                  {profile.department || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Employment Status</p>
                <p className="text-lg text-text-primary">
                  {profile.employmentStatus || 'Active'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Date Joined</p>
                <p className="text-lg text-text-primary">
                  {formatDate(profile.dateJoined)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Savings Accounts Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Savings Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-surface-elevated">
                <p className="text-sm text-text-secondary mb-2">Normal Savings</p>
                <p className="font-mono text-2xl font-bold text-primary">
                  {normalSavings ? formatCurrency(normalSavings.balanceKobo) : '₦0.00'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-surface-elevated">
                <p className="text-sm text-text-secondary mb-2">Special Deposits</p>
                <p className="font-mono text-2xl font-bold text-secondary">
                  {specialSavings ? formatCurrency(specialSavings.balanceKobo) : '₦0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Loans Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            {activeLoans.length === 0 ? (
              <p className="text-text-secondary text-center py-8">
                No active loans
              </p>
            ) : (
              <div className="space-y-4">
                {activeLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-4 rounded-lg bg-surface-elevated flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono font-semibold text-text-primary">
                        {loan.loanReference}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {loan.loanType.replace('_', ' ')} • {loan.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-text-secondary">Outstanding</p>
                      <p className="font-mono text-lg font-bold text-text-primary">
                        {formatCurrency(loan.outstandingKobo)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent">
              <p className="text-sm text-accent">{editError}</p>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="your.email@example.com"
          />

          <Input
            label="Department"
            type="text"
            value={editForm.department}
            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            placeholder="Your department"
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1"
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={editLoading}
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
