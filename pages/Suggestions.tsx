

import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Suggestion, SuggestionStatus, Comment, User } from '../types';
import { IconPlusCircle, IconChevronDown, IconChevronUp } from '../components/icons';
import { ITEM_CATEGORIES } from '../constants';

const StatusBadge: React.FC<{ status: SuggestionStatus }> = ({ status }) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    const statusMap = {
        [SuggestionStatus.PENDING]: { text: "Pending", classes: "bg-yellow-900 text-yellow-300" },
        [SuggestionStatus.APPROVED]: { text: "Approved", classes: "bg-green-900 text-green-300" },
        [SuggestionStatus.DENIED]: { text: "Denied", classes: "bg-red-900 text-red-300" },
    };
    const { text, classes } = statusMap[status];
    return <span className={`${baseClasses} ${classes}`}>{text}</span>;
};

const SuggestionComments: React.FC<{
    suggestion: Suggestion;
    currentUser: User;
}> = ({ suggestion, currentUser }) => {
    const { state, addComment } = useInventory();
    const [newCommentText, setNewCommentText] = useState('');

    const commentsForSuggestion = useMemo(() => {
        return state.comments
            .filter(c => c.suggestionId === suggestion.id)
            .map(c => ({
                ...c,
                user: state.users.find(u => u.id === c.userId)
            }))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [state.comments, state.users, suggestion.id]);

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCommentText.trim()) {
            await addComment({
                suggestionId: suggestion.id,
                userId: currentUser.id,
                text: newCommentText.trim()
            });
            setNewCommentText('');
        }
    };

    const canComment = currentUser.isAdmin || currentUser.id === suggestion.userId;

    return (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Commentary</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {commentsForSuggestion.length > 0 ? commentsForSuggestion.map(comment => (
                    <div key={comment.id} className="text-xs p-3 bg-slate-900/70 rounded-md">
                        <div className="flex justify-between items-center mb-1">
                            <span className={`font-bold ${comment.user?.isAdmin ? 'text-emerald-400' : 'text-slate-200'}`}>
                                {comment.user?.fullName || 'Unknown User'}
                            </span>
                            <span className="text-slate-500">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-300 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                )) : <p className="text-xs text-slate-500">No comments yet.</p>}
            </div>
            {canComment && (
                 <form onSubmit={handleCommentSubmit} className="mt-4 flex gap-2">
                    <textarea
                        value={newCommentText}
                        onChange={e => setNewCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        rows={2}
                        className="flex-grow bg-slate-700 border border-slate-600 rounded-lg p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm self-end">Post</button>
                </form>
            )}
        </div>
    );
};


export const Suggestions: React.FC = () => {
    const { state, addSuggestion, approveSuggestion, denySuggestion } = useInventory();
    const { currentUser } = useAuth();
    
    const [isSuggestModalOpen, setSuggestModalOpen] = useState(false);
    const [suggestionForm, setSuggestionForm] = useState({ itemName: '', category: ITEM_CATEGORIES[0], reason: '' });
    
    const [isApproveModalOpen, setApproveModalOpen] = useState(false);
    const [isDenyModalOpen, setDenyModalOpen] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
    const [approveQuantity, setApproveQuantity] = useState(10);
    const [adminTab, setAdminTab] = useState<'pending' | 'processed'>('pending');
    const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null);

    const handleSuggestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        await addSuggestion({ ...suggestionForm, userId: currentUser.id });
        setSuggestModalOpen(false);
        setSuggestionForm({ itemName: '', category: ITEM_CATEGORIES[0], reason: '' });
    };

    const openApproveModal = (suggestion: Suggestion) => {
        setSelectedSuggestion(suggestion);
        setApproveModalOpen(true);
    };

    const handleApproveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSuggestion) return;
        await approveSuggestion({
             suggestion: selectedSuggestion, totalQuantity: approveQuantity 
        });
        setApproveModalOpen(false);
        setSelectedSuggestion(null);
    };

    const openDenyModal = (suggestion: Suggestion) => {
        setSelectedSuggestion(suggestion);
        setDenyModalOpen(true);
    };

    const handleDenyConfirm = async () => {
        if (!selectedSuggestion) return;
        await denySuggestion(selectedSuggestion.id);
        setDenyModalOpen(false);
        setSelectedSuggestion(null);
    };

    const toggleComments = (suggestionId: string) => {
        setExpandedSuggestionId(prev => (prev === suggestionId ? null : suggestionId));
    };

    const mySuggestions = useMemo(() => {
        if (!currentUser) return [];
        return state.suggestions
            .filter(s => s.userId === currentUser.id)
            .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [state.suggestions, currentUser]);
    
    type SuggestionWithUser = Suggestion & { userName: string; commentCount: number; };

    const { pendingSuggestions, processedSuggestions } = useMemo(() => {
        const pending: SuggestionWithUser[] = [];
        const processed: SuggestionWithUser[] = [];
        
        const suggestionsWithUser: SuggestionWithUser[] = state.suggestions.map(suggestion => {
            const user = state.users.find(u => u.id === suggestion.userId);
            const commentCount = state.comments.filter(c => c.suggestionId === suggestion.id).length;
            return { ...suggestion, userName: user?.fullName || 'Unknown User', commentCount };
        });

        suggestionsWithUser.forEach(s => {
            if (s.status === SuggestionStatus.PENDING) {
                pending.push(s);
            } else {
                processed.push(s);
            }
        });

        pending.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        processed.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { pendingSuggestions: pending, processedSuggestions: processed };
    }, [state.suggestions, state.users, state.comments]);

    if (!currentUser) return null;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Item Suggestions</h1>
                {!currentUser.isAdmin && (
                    <button onClick={() => setSuggestModalOpen(true)} className="flex items-center justify-center bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-700 transition-colors">
                        <IconPlusCircle />
                        Suggest New Item
                    </button>
                )}
            </div>

            {currentUser.isAdmin && (
                <>
                    <div className="border-b border-slate-700 mb-6">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setAdminTab('pending')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${adminTab === 'pending' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>
                                Pending ({pendingSuggestions.length})
                            </button>
                            <button onClick={() => setAdminTab('processed')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${adminTab === 'processed' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>
                                Processed
                            </button>
                        </nav>
                    </div>

                    <div className="space-y-4">
                        {(adminTab === 'pending' ? pendingSuggestions : processedSuggestions).map(suggestion => (
                            <div key={suggestion.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 transition-all">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-semibold text-white">{suggestion.itemName}</h3>
                                            <StatusBadge status={suggestion.status} />
                                        </div>
                                        <p className="text-sm text-slate-400">Category: {suggestion.category}</p>
                                        <p className="text-sm text-slate-300 mt-2">Reason: <span className="font-normal text-slate-400 whitespace-pre-wrap">{suggestion.reason}</span></p>
                                        <p className="text-xs text-slate-500 mt-2">Suggested by {suggestion.userName} on {new Date(suggestion.timestamp).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                                         {suggestion.status === SuggestionStatus.PENDING && (
                                            <div className="flex gap-2">
                                                <button onClick={() => openApproveModal(suggestion)} className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-md text-sm font-semibold">Approve</button>
                                                <button onClick={() => openDenyModal(suggestion)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-sm font-semibold">Deny</button>
                                            </div>
                                        )}
                                        <button onClick={() => toggleComments(suggestion.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                                            <span>{suggestion.commentCount} Comments</span>
                                            {expandedSuggestionId === suggestion.id ? <IconChevronUp /> : <IconChevronDown />}
                                        </button>
                                    </div>
                                </div>
                                {expandedSuggestionId === suggestion.id && <SuggestionComments suggestion={suggestion} currentUser={currentUser} />}
                            </div>
                        ))}
                         {adminTab === 'pending' && pendingSuggestions.length === 0 && <p className="text-slate-400 text-center py-8">No pending suggestions.</p>}
                         {adminTab === 'processed' && processedSuggestions.length === 0 && <p className="text-slate-400 text-center py-8">No suggestions have been processed yet.</p>}
                    </div>
                </>
            )}

            {!currentUser.isAdmin && (
                 <div className="space-y-4">
                    {mySuggestions.map(suggestion => (
                        <div key={suggestion.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 transition-all">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-semibold text-white">{suggestion.itemName}</h3>
                                        <StatusBadge status={suggestion.status} />
                                    </div>
                                    <p className="text-xs text-slate-500">Suggested on {new Date(suggestion.timestamp).toLocaleDateString()}</p>
                                </div>
                                <button onClick={() => toggleComments(suggestion.id)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
                                     <span>Commentary</span>
                                     {expandedSuggestionId === suggestion.id ? <IconChevronUp /> : <IconChevronDown />}
                                </button>
                            </div>
                            {expandedSuggestionId === suggestion.id && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                     <p className="text-sm text-slate-300 mt-2">Reason: <span className="font-normal text-slate-400 whitespace-pre-wrap">{suggestion.reason}</span></p>
                                     <SuggestionComments suggestion={suggestion} currentUser={currentUser} />
                                </div>
                            )}
                        </div>
                    ))}
                    {mySuggestions.length === 0 && (
                        <div className="text-center py-10 px-6 bg-slate-800 rounded-lg border border-slate-700">
                             <p className="text-slate-400">You haven't made any suggestions yet.</p>
                        </div>
                    )}
                 </div>
            )}
            
            {/* --- Modals --- */}
            <Modal isOpen={isSuggestModalOpen} onClose={() => setSuggestModalOpen(false)} title="Suggest a New Item">
                <form onSubmit={handleSuggestSubmit} className="space-y-4">
                    <input type="text" value={suggestionForm.itemName} onChange={e => setSuggestionForm(f => ({...f, itemName: e.target.value}))} placeholder="Item Name" required className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5" />
                    <select value={suggestionForm.category} onChange={e => setSuggestionForm(f => ({...f, category: e.target.value}))} required className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5">
                        {ITEM_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <textarea value={suggestionForm.reason} onChange={e => setSuggestionForm(f => ({...f, reason: e.target.value}))} placeholder="Reason for suggesting, or other commentaries..." required rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5" />
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setSuggestModalOpen(false)} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">Submit Suggestion</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isApproveModalOpen} onClose={() => setApproveModalOpen(false)} title={`Approve: ${selectedSuggestion?.itemName}`}>
                <form onSubmit={handleApproveSubmit} className="space-y-4">
                    <p>This will add the item to the inventory. Please specify the initial quantity.</p>
                    <div>
                        <label htmlFor="quantity" className="block mb-2 text-sm font-medium text-slate-300">Total Quantity</label>
                        <input type="number" id="quantity" value={approveQuantity} onChange={(e) => setApproveQuantity(parseInt(e.target.value, 10))} min="1" className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2.5" required />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setApproveModalOpen(false)} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors">Cancel</button>
                        <button type="submit" className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">Approve & Add Item</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isDenyModalOpen} onClose={() => setDenyModalOpen(false)} title="Confirm Denial">
                <p>Are you sure you want to deny the suggestion for <strong className="text-white">{selectedSuggestion?.itemName}</strong>?</p>
                <div className="flex justify-end gap-3 pt-6">
                    <button type="button" onClick={() => setDenyModalOpen(false)} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleDenyConfirm} className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Confirm Deny</button>
                </div>
            </Modal>

        </div>
    );
};
