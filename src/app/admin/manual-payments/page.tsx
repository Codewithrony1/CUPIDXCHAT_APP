'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  User,
  ArrowLeft,
  Coins,
  QrCode,
  Lock,
  Edit,
  Flag,
  Calendar,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminConsolePage() {
  const [activeTab, setActiveTab] = useState<'VIP_REQUESTS' | 'USERS' | 'REPORTS'>('VIP_REQUESTS');
  
  // Data states
  const [requests, setRequests] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedReportSnapshot, setSelectedReportSnapshot] = useState<any[] | null>(null);

  // Reject modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // User override modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editGender, setEditGender] = useState<string>('');
  const [editDob, setEditDob] = useState<string>('');
  const [editLocked, setEditLocked] = useState<boolean>(false);
  const [editVip, setEditVip] = useState<boolean>(false);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'VIP_REQUESTS') {
        const res = await fetch('/api/admin/vip-requests');
        const data = await res.json();
        if (res.ok && data.requests) setRequests(data.requests);
      } else if (activeTab === 'USERS') {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (res.ok && data.users) setUsersList(data.users);
      } else if (activeTab === 'REPORTS') {
        const res = await fetch('/api/admin/reports');
        const data = await res.json();
        if (res.ok && data.reports) setReportsList(data.reports);
      }
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleVipAction = async (requestId: string, action: 'APPROVE' | 'REJECT', rejectionReason?: string) => {
    try {
      setProcessingId(requestId);
      const res = await fetch('/api/admin/vip-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, rejectionReason }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchData();
        setRejectingId(null);
        setRejectReason('');
      } else {
        alert(data.error || 'Action failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApplyUserOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setProcessingId(editingUser.id);
      const res = await fetch('/api/admin/users/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          gender: editGender,
          dob: editDob || undefined,
          genderDobLocked: editLocked,
          is_vip: editVip,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchData();
        setEditingUser(null);
      } else {
        alert(data.error || 'Override failed');
      }
    } catch (e) {
      console.error(e);
      alert('Error applying override');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter !== 'ALL' && r.status !== filter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchUtr = r.utrNumber?.toLowerCase().includes(term);
      const matchTx = r.txHash?.toLowerCase().includes(term);
      const matchUser = r.user?.username?.toLowerCase().includes(term) || r.user?.displayName?.toLowerCase().includes(term);
      return matchUtr || matchTx || matchUser;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A1128] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Admin Console Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                <span>CupidX Master Admin Console</span>
              </h1>
              <p className="text-xs text-slate-400">VIP Requests Queue, User Overrides & Trust & Safety Snapshot Reports</p>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex space-x-2 border-b border-white/10 pb-3">
          {[
            { id: 'VIP_REQUESTS', label: '💎 VIP Requests Queue', icon: Coins },
            { id: 'USERS', label: '👥 User List & Overrides', icon: Users },
            { id: 'REPORTS', label: '🚩 Trust & Safety Reports', icon: Flag },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: VIP REQUESTS QUEUE (QR & BTC) */}
        {activeTab === 'VIP_REQUESTS' && (
          <div className="space-y-5">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(['pending', 'approved', 'rejected', 'ALL'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filter === t
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10'
                    }`}
                  >
                    {t === 'pending' && '⏳ Pending Review'}
                    {t === 'approved' && '✓ Approved'}
                    {t === 'rejected' && '✕ Rejected'}
                    {t === 'ALL' && 'All Requests'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search UTR, Tx Hash, User..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-bold">Loading pending VIP requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-12 text-center bg-white/5 rounded-3xl border border-white/10 space-y-2">
                <Clock className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-bold text-white">No VIP requests in queue</h3>
                <p className="text-xs text-slate-400">All payment verification requests have been processed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                            <span>{req.user?.displayName || req.user?.fullName || 'User'}</span>
                            <span className="text-xs text-slate-400 font-mono font-normal">(@{req.user?.username})</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">{req.user?.email || 'No email associated'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3">
                        <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 uppercase tracking-wider">
                          Method: {req.method === 'btc' ? '₿ Bitcoin' : '📱 UPI / QR'}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          req.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                            : req.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>

                    {/* Proof & Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2 bg-white/5 p-3.5 rounded-xl border border-white/5">
                        {req.method === 'btc' ? (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Bitcoin Tx Hash (txid)</span>
                            <span className="font-mono text-xs font-bold text-amber-400 break-all">{req.txHash}</span>
                            <a
                              href={`https://mempool.space/tx/${req.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-bold hover:underline mt-1"
                            >
                              <span>Check on mempool.space</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted UTR / UPI Ref</span>
                            <span className="font-mono font-black text-sm text-yellow-300 tracking-wider">
                              {req.utrNumber || 'No UTR Submitted'}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between pt-1">
                          <span className="text-slate-400">Amount: <span className="text-emerald-400 font-bold">₹{req.amount}</span></span>
                          <span className="text-slate-400">Submitted: {new Date(req.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Screenshot Proof */}
                      <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Uploaded Screenshot Proof</span>
                        {req.proofUrl && (
                          <span className="text-[9px] font-mono text-emerald-400 block truncate mb-1" title={req.proofUrl.split('/').pop()}>
                            {req.proofUrl.split('/').pop()}
                          </span>
                        )}
                        {req.proofUrl ? (
                          <div
                            onClick={() => setSelectedImage(req.proofUrl)}
                            className="relative w-full h-24 rounded-lg overflow-hidden border border-white/10 cursor-pointer group"
                          >
                            <img src={req.proofUrl} alt="Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Expand Screenshot
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center text-slate-500 text-xs italic">No screenshot uploaded</div>
                        )}
                      </div>
                    </div>

                    {/* Admin Actions */}
                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end space-x-3 pt-2">
                        <button
                          disabled={processingId === req.id}
                          onClick={() => {
                            setRejectingId(req.id);
                            setRejectReason('Verification failed. Invalid proof or transaction hash.');
                          }}
                          className="px-4 py-2 rounded-xl bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Reject Request
                        </button>

                        <button
                          disabled={processingId === req.id}
                          onClick={() => handleVipAction(req.id, 'APPROVE')}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                        >
                          {processingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approve (30-Days VIP)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT & ADMIN OVERRIDES */}
        {activeTab === 'USERS' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span>User Management & Admin Overrides</span>
              </h3>
              <p className="text-xs text-slate-400">
                View registered users, DOB & Gender settings, and apply Admin Overrides (override gender/DOB or lock profile fields for report moderation).
              </p>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-3">
                {usersList.map((u) => (
                  <div key={u.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-white">{u.displayName || u.fullName}</h4>
                        <span className="text-xs text-slate-400 font-mono">(@{u.username})</span>
                        {u.is_vip && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-bold border border-yellow-500/30">💎 VIP</span>}
                        {u.genderDobLocked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">🔒 Locked</span>}
                      </div>
                      <p className="text-xs text-slate-400 pt-1">
                        Gender: <span className="font-bold text-slate-200 capitalize">{u.gender || 'unspecified'}</span> • DOB: <span className="font-bold text-slate-200">{u.dob ? new Date(u.dob).toLocaleDateString() : 'Not Set'}</span> • Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditGender(u.gender || 'male');
                        setEditDob(u.dob ? new Date(u.dob).toISOString().split('T')[0] : '');
                        setEditLocked(Boolean(u.genderDobLocked));
                        setEditVip(Boolean(u.is_vip));
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Admin Override</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRUST & SAFETY REPORTS */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-400" />
                <span>Trust & Safety Evidence Snapshots</span>
              </h3>
              <p className="text-xs text-slate-400">
                Reported profiles capture a JSON snapshot of the active chat conversation at report time to enable evidence moderation for fake or underage profiles.
              </p>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              </div>
            ) : reportsList.length === 0 ? (
              <div className="p-12 text-center bg-white/5 rounded-3xl border border-white/10 text-xs text-slate-400">
                No active user reports in queue.
              </div>
            ) : (
              <div className="space-y-3">
                {reportsList.map((rep) => (
                  <div key={rep.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="font-bold text-rose-400">Reason: {rep.reason}</span>
                      <span className="text-slate-500">{new Date(rep.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Reporter: <span className="font-bold text-white">@{rep.reporter?.username}</span></span>
                      <span>Reported: <span className="font-bold text-rose-300">@{rep.reported?.username}</span></span>
                    </div>

                    {rep.snapshotMessages && (
                      <button
                        onClick={() => {
                          try {
                            setSelectedReportSnapshot(JSON.parse(rep.snapshotMessages));
                          } catch (e) {
                            alert('Could not parse snapshot messages');
                          }
                        }}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View Conversation Snapshot</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Admin Override Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleApplyUserOverride} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 text-left">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-400" />
              <span>Admin Profile Override for @{editingUser.username}</span>
            </h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold">Gender</label>
              <select
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold">Date of Birth (DOB)</label>
              <input
                type="date"
                value={editDob}
                onChange={(e) => setEditDob(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-800">
              <label className="flex items-center space-x-2 text-xs font-bold text-rose-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editLocked}
                  onChange={(e) => setEditLocked(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>Lock Gender & DOB (Prevent User Edits)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-bold text-yellow-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editVip}
                  onChange={(e) => setEditVip(e.target.checked)}
                  className="rounded accent-yellow-500"
                />
                <span>Set VIP Membership Status</span>
              </label>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Apply Override
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Snapshot Modal */}
      {selectedReportSnapshot && (
        <div
          onClick={() => setSelectedReportSnapshot(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Captured Conversation Snapshot</h3>
            <div className="space-y-2">
              {selectedReportSnapshot.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/5 text-xs text-slate-200">
                  <span className="text-[10px] text-pink-300 font-bold block">{m.senderId}</span>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedReportSnapshot(null)} className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold text-xs">
              Close Snapshot
            </button>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={selectedImage} alt="Proof Full" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
}
