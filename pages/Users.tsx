import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { IconUsers, IconTrash, IconPencil } from '../components/icons';
import { Modal } from '../components/Modal';
import { User, LogAction } from '../types';
import { useAuth } from '../context/AuthContext';
import { GRADE_LEVELS } from '../constants';

export const Users: React.FC = () => {
  const { state, editUser, deleteUser, markNotificationsAsRead } = useInventory();
  const { currentUser } = useAuth();
  const [isEditUserModalOpen, setEditUserModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unreadNotifications = state.notifications
        .filter(n => n.type === 'new_user' && !n.read)
        .map(n => n.id);
    if (unreadNotifications.length > 0) {
        markNotificationsAsRead(unreadNotifications);
    }
  }, [state.notifications, markNotificationsAsRead]);


  const openEditModal = (user: User) => {
    setUserToEdit(user);
    setError('');
    setEditUserModalOpen(true);
  };

  const closeEditModal = () => {
    setUserToEdit(null);
    setError('');
    setEditUserModalOpen(false);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (userToEdit && userToEdit.fullName.trim()) {
        try {
            await editUser(userToEdit);
            closeEditModal();
        } catch (err: any) {
            setError(err.message);
        }
    }
  };

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setUserToDelete(null);
    setDeleteModalOpen(false);
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
        try {
            await deleteUser(userToDelete.id);
            closeDeleteModal();
        } catch (error: any) {
            alert(error.message); // Basic error feedback
        }
    }
  };

  const userHasOutstandingLoans = useMemo(() => {
    if (!userToDelete) return false;
    const returnedLogIds = new Set(
        state.logs.filter(log => log.action === LogAction.RETURN).map(log => log.relatedLogId)
    );
    return state.logs.some(
        log => log.userId === userToDelete.id && log.action === LogAction.BORROW && !returnedLogIds.has(log.id)
    );
  }, [userToDelete, state.logs]);
  
  const isLastAdmin = useMemo(() => {
      if (!userToDelete || !userToDelete.isAdmin) return false;
      return state.users.filter(u => u.isAdmin).length <= 1;
  }, [userToDelete, state.users]);
  
  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
        return state.users;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return state.users.filter(user =>
        user.fullName.toLowerCase().includes(lowercasedFilter) ||
        user.username.toLowerCase().includes(lowercasedFilter) ||
        (user.lrn && user.lrn.includes(lowercasedFilter))
    );
  }, [state.users, searchTerm]);


  return (
    <div className="p-4 md:p-8">
       <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-white">User Accounts</h1>
        <div className="flex flex-col md:flex-row items-stretch gap-4">
            <input
                type="text"
                placeholder="Search by name, username, LRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <p className="text-sm text-slate-400 flex items-center">New users must register via the Sign Up page.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUsers.map(user => (
          <div key={user.id} className={`group bg-slate-800 p-5 rounded-lg border border-slate-700 shadow-md flex flex-col space-y-3 transition-all hover:shadow-emerald-500/20  relative ${user.isAdmin ? 'hover:border-emerald-500' : 'hover:border-slate-500'}`}>
            <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 bg-slate-700 rounded-full p-3">
                   <IconUsers />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate">{user.fullName}</h3>
                  <p className={`text-sm ${user.isAdmin ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>{user.role}</p>
                </div>
            </div>
            <div className="text-xs text-slate-400 space-y-1 pl-1">
                <p><span className="font-semibold text-slate-300">Username:</span> {user.username}</p>
                 <p className="truncate"><span className="font-semibold text-slate-300">Email:</span> {user.email}</p>
                {user.lrn && <p><span className="font-semibold text-slate-300">LRN:</span> {user.lrn}</p>}
                {user.gradeLevel && user.section && <p><span className="font-semibold text-slate-300">Section:</span> {user.gradeLevel} - {user.section}</p>}
            </div>
            <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button 
                    onClick={() => openEditModal(user)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-full transition-colors"
                    aria-label={`Edit user ${user.fullName}`}
                >
                    <IconPencil />
                </button>
                <button 
                    onClick={() => openDeleteModal(user)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-full transition-colors disabled:text-slate-600 disabled:cursor-not-allowed"
                    aria-label={`Delete user ${user.fullName}`}
                    disabled={user.id === currentUser?.id}
                >
                    <IconTrash />
                </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit User Modal */}
      <Modal isOpen={isEditUserModalOpen} onClose={closeEditModal} title="Edit User">
        {userToEdit && (
            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <input type="text" value={userToEdit.fullName} onChange={(e) => setUserToEdit(u => u ? { ...u, fullName: e.target.value } : null)} placeholder="Full Name" required className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5" />
              <input type="text" value={userToEdit.username} onChange={(e) => setUserToEdit(u => u ? { ...u, username: e.target.value } : null)} placeholder="Username" required className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5" />
              <input type="email" value={userToEdit.email} readOnly disabled className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-400 cursor-not-allowed" />
              
              <div className="flex items-center">
                <input id="editIsAdmin" type="checkbox" checked={userToEdit.isAdmin} onChange={e => setUserToEdit(u => u ? {...u, isAdmin: e.target.checked, role: e.target.checked ? 'Admin' : 'Member', gradeLevel: null, section: null, lrn: ''} : null)} className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"/>
                <label htmlFor="editIsAdmin" className="ml-2 text-sm font-medium text-slate-300">Grant Admin Privileges</label>
              </div>

            {!userToEdit.isAdmin && (
                <>
                    <input type="text" value={userToEdit.lrn ?? ''} onChange={(e) => setUserToEdit(u => u ? { ...u, lrn: e.target.value } : null)} placeholder="LRN (12 digits)" className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5" />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <select value={userToEdit.gradeLevel ?? ''} onChange={(e) => setUserToEdit(u => u ? { ...u, gradeLevel: e.target.value as User['gradeLevel'], section: null } : null)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5">
                            <option value="">Select Grade</option>
                            {Object.keys(GRADE_LEVELS).map(level => <option key={level} value={level}>{level}</option>)}
                        </select>
                        <select value={userToEdit.section ?? ''} onChange={(e) => setUserToEdit(u => u ? { ...u, section: e.target.value } : null)} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2.5" disabled={!userToEdit.gradeLevel}>
                            <option value="">Select Section</option>
                            {userToEdit.gradeLevel && GRADE_LEVELS[userToEdit.gradeLevel].map(sec => <option key={sec} value={sec}>{sec}</option>)}
                        </select>
                    </div>
                </>
             )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={closeEditModal} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">Save Changes</button>
              </div>
            </form>
        )}
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirm Deletion">
        {userToDelete && (
            <div>
                <p className="text-slate-300">Are you sure you want to delete the user profile for <strong className="text-white">{userToDelete.fullName}</strong>?</p>
                {userHasOutstandingLoans && (
                    <div className="mt-4 p-3 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-sm rounded-lg">
                        <strong>Warning:</strong> This user has outstanding borrowed items. They cannot be deleted until all items are returned.
                    </div>
                )}
                 {isLastAdmin && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-lg">
                        <strong>Warning:</strong> This is the last admin account. It cannot be deleted to prevent locking out administrators from the system.
                    </div>
                )}
                <p className="text-xs text-slate-500 mt-2">This action is irreversible and only deletes their profile data. It does not remove their login credentials from the authentication system.</p>
                <div className="flex justify-end gap-3 pt-6">
                    <button type="button" onClick={closeDeleteModal} className="py-2 px-4 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors">Cancel</button>
                    <button 
                        type="button" 
                        onClick={handleDeleteUser} 
                        disabled={userHasOutstandingLoans || isLastAdmin}
                        className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:bg-red-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                        Confirm Delete
                    </button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};