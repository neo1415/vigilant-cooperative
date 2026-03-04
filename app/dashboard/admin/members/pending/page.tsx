'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { get, patch } from '@/lib/api-client';

interface PendingMember {
  id: string;
  memberId: string;
  fullName: string;
  email: string | null;
  department: string | null;
  dateJoined: string;
  createdAt: string;
}

export default function PendingMembersPage() {
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'bulk-approve' | null;
    memberId?: string;
    memberName?: string;
  }>({
    isOpen: false,
    type: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingMembers();
  }, []);

  const fetchPendingMembers = async () => {
    try {
      setLoading(true);
      const result = await get<PendingMember[]>('/api/v1/members/pending');
      
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to fetch pending members');
      }
      
      setMembers(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (memberId: string) => {
    setActionLoading(true);
    try {
      const result = await patch(`/api/v1/members/${memberId}/approve`);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to approve member');
      }

      await fetchPendingMembers();
      setConfirmModal({ isOpen: false, type: null });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    setActionLoading(true);
    try {
      const promises = Array.from(selectedMembers).map((memberId) =>
        patch(`/api/v1/members/${memberId}/approve`)
      );

      await Promise.all(promises);
      
      setSelectedMembers(new Set());
      await fetchPendingMembers();
      setConfirmModal({ isOpen: false, type: null });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map((m) => m.id)));
    }
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
          <p className="text-text-secondary">Loading pending members...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent>
            <p className="text-accent text-center">{error}</p>
            <Button onClick={fetchPendingMembers} className="mt-4 w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-text-primary">
              Pending Member Approvals
            </h1>
            <p className="text-text-secondary mt-1">
              Review and approve new member registrations
            </p>
          </div>
          {selectedMembers.size > 0 && (
            <Button
              onClick={() =>
                setConfirmModal({
                  isOpen: true,
                  type: 'bulk-approve',
                })
              }
            >
              Approve Selected ({selectedMembers.size})
            </Button>
          )}
        </div>

        {/* Members List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {members.length} Pending Registration{members.length !== 1 ? 's' : ''}
              </CardTitle>
              {members.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMembers.size === members.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-secondary">Select All</span>
                </label>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto text-text-tertiary mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-text-secondary text-lg">
                  No pending member registrations
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    {/* Member Row */}
                    <div className="p-4 bg-surface-elevated flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-text-secondary">Member ID</p>
                          <p className="font-mono font-semibold text-text-primary">
                            {member.memberId}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-text-secondary">Full Name</p>
                          <p className="font-semibold text-text-primary">
                            {member.fullName}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-text-secondary">Department</p>
                          <p className="text-text-primary">
                            {member.department || 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-text-secondary">Registered</p>
                          <p className="text-text-primary">
                            {formatDate(member.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              type: 'approve',
                              memberId: member.id,
                              memberName: member.fullName,
                            })
                          }
                        >
                          Approve
                        </Button>
                        <button
                          onClick={() =>
                            setExpandedMemberId(
                              expandedMemberId === member.id ? null : member.id
                            )
                          }
                          className="p-2 rounded-lg hover:bg-surface transition-colors"
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${
                              expandedMemberId === member.id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedMemberId === member.id && (
                      <div className="p-4 border-t border-border bg-surface">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-text-secondary">Email</p>
                            <p className="text-text-primary">
                              {member.email || 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-text-secondary">Date Joined</p>
                            <p className="text-text-primary">
                              {formatDate(member.dateJoined)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null })}
        title={
          confirmModal.type === 'bulk-approve'
            ? 'Approve Multiple Members'
            : 'Approve Member'
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            {confirmModal.type === 'bulk-approve'
              ? `Are you sure you want to approve ${selectedMembers.size} member${
                  selectedMembers.size !== 1 ? 's' : ''
                }? They will be able to log in immediately.`
              : `Are you sure you want to approve ${confirmModal.memberName}? They will be able to log in immediately.`}
          </p>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setConfirmModal({ isOpen: false, type: null })}
              className="flex-1"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmModal.type === 'bulk-approve') {
                  handleBulkApprove();
                } else if (confirmModal.memberId) {
                  handleApprove(confirmModal.memberId);
                }
              }}
              className="flex-1"
              disabled={actionLoading}
            >
              {actionLoading ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
