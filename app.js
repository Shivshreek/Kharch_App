// Firebase config file se app, db, aur auth ko import karein
import { app, db, auth } from './firebase-config.js';

// Baaki ke Firebase functions ko import karein
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, 
    onSnapshot, collection, query, addDoc, getDocs, 
    Timestamp, deleteDoc, writeBatch, orderBy 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


const appId = 'kharch-tracker-shivshree';

// Application State
const state = {
    currentUser: null,
    expenses: [],
    users: [],
    isAdmin: false,
    allUsersCache: new Map(),
    allExpensesCache: []
};

// DOM Elements
const elements = {
    loader: document.getElementById('loader'),
    authContainer: document.getElementById('auth-container'),
    dashboardContainer: document.getElementById('dashboard-container'),
    authError: document.getElementById('auth-error'),
    authForm: document.getElementById('auth-form'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    menuToggleBtn: document.getElementById('menu-toggle-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    pageTitle: document.getElementById('page-title'),
    userDisplayName: document.getElementById('user-display-name'),
    toast: document.getElementById('toast')
};

let categoryChartInstance = null;
let paidByChartInstance = null;

// Modal Functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Utility Functions
function showToast(message, type = 'success') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = '';
    toast.classList.add('show', `toast-${type}`);
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toggleButtonLoading(button, isLoading, originalText) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    } else {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        if (confirm(`${title}\n\n${message}`)) {
            resolve(true);
        } else {
            resolve(false);
        }
    });
}

// Page Navigation
function switchPage(pageId) {
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById(pageId).classList.add('active');
    
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
    
    const pageTitle = document.querySelector(`[data-page="${pageId}"] span`).textContent;
    elements.pageTitle.textContent = pageTitle;
    
    elements.sidebar.classList.add('-translate-x-full');
    elements.sidebarOverlay.classList.add('hidden');
    
    loadPageData(pageId);
}

function loadPageData(pageId) {
    switch(pageId) {
        case 'history-page':
            renderExpenseHistory();
            break;
        case 'hisab-page':
            calculateAndDisplaySettlements();
            break;
        case 'stats-page':
            generateStats();
            break;
        case 'profile-page':
            loadUserProfile();
            break;
        case 'admin-page':
            if(state.isAdmin) {
                fetchAndDisplayUsersForAdmin();
                fetchAndDisplayMessages();
            }
            break;
        case 'contact-us-page':
            loadContactFormDetails();
            break;
    }
}

// Expense Management
function addMember(name = '', amount = '') {
    const membersContainer = document.getElementById('members-container');
    const memberDiv = document.createElement('div');
    memberDiv.className = 'flex items-center gap-2 member-row';
    memberDiv.innerHTML = `
        <input type="text" value="${name}" class="form-input flex-grow" placeholder="Member Name" required>
        <input type="number" value="${amount}" class="form-input w-28" placeholder="Amount" step="0.01" required>
        <button type="button" class="remove-member-btn text-red-500 hover:text-red-700 font-bold text-xl px-2">&times;</button>
    `;
    membersContainer.appendChild(memberDiv);
    
    memberDiv.querySelector('.remove-member-btn').addEventListener('click', () => {
        memberDiv.remove();
    });
}

function splitEqually() {
    const totalAmount = parseFloat(document.getElementById('total-amount').value);
    const memberRows = document.querySelectorAll('.member-row');
    
    if (isNaN(totalAmount) || totalAmount <= 0) {
        showToast('Please enter a valid total amount first', 'error');
        return;
    }
    
    if (memberRows.length === 0) {
        showToast('Please add members first', 'error');
        return;
    }
    
    const amountPerPerson = (totalAmount / memberRows.length).toFixed(2);
    
    memberRows.forEach(row => {
        const amountInput = row.querySelector('input[type="number"]');
        amountInput.value = amountPerPerson;
    });
    
    showToast(`Split equally: ₹${amountPerPerson} per person`);
}

// Firebase Data Management
async function fetchAndCacheUsers() {
    try {
        const snapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/credentials`));
        state.allUsersCache.clear();
        snapshot.forEach(doc => {
            state.allUsersCache.set(doc.id, { id: doc.id, ...doc.data() });
        });
        setupQuickAddButtons();
    } catch (error) {
        console.error("Error fetching users:", error);
        initializeDemoUsers();
    }
}

function fetchAndDisplayExpenses() {
    try {
        const q = query(collection(db, `/artifacts/${appId}/public/data/expenses`), orderBy("createdAt", "desc"));
        
        onSnapshot(q, (snapshot) => {
            state.allExpensesCache = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                createdAt: doc.data().createdAt || Timestamp.now(),
                paymentStatus: doc.data().paymentStatus || 'pending',
                paidAmount: doc.data().paidAmount || 0,
                paidBy: doc.data().paidBy || ''
            }));
            
            renderExpenseHistory();
            
            if (document.getElementById('hisab-page').classList.contains('active')) {
                calculateAndDisplaySettlements();
            }
            
            if (document.getElementById('stats-page').classList.contains('active')) {
                generateStats();
            }
        });
    } catch (error) {
        console.error("Error fetching expenses:", error);
        initializeDemoExpenses();
    }
}

// Demo Data Fallback
function initializeDemoUsers() {
    state.allUsersCache.set('john', { id: 'john', name: 'John Doe', password: '123', role: 'User', mobile: '9876543210', email: 'john@example.com', gender: 'Male' });
    state.allUsersCache.set('jane', { id: 'jane', name: 'Jane Smith', password: '123', role: 'User', mobile: '9876543211', email: 'jane@example.com', gender: 'Female' });
    state.allUsersCache.set('admin', { id: 'admin', name: 'Admin User', password: 'admin123', role: 'Admin', mobile: '9876543212', email: 'admin@example.com', gender: 'Male' });
    setupQuickAddButtons();
}

function initializeDemoExpenses() {
    state.allExpensesCache = [
        {
            id: '1',
            description: 'Dinner at Restaurant',
            totalAmount: 2500,
            category: 'Food',
            members: [
                { name: 'John Doe', amount: 1250 },
                { name: 'Jane Smith', amount: 1250 }
            ],
            addedBy: 'john',
            createdAt: Timestamp.fromDate(new Date('2024-01-15')),
            paymentStatus: 'pending',
            paidAmount: 0,
            paidBy: ''
        },
        {
            id: '2',
            description: 'Movie Tickets',
            totalAmount: 1200,
            category: 'Entertainment',
            members: [
                { name: 'John Doe', amount: 600 },
                { name: 'Jane Smith', amount: 600 }
            ],
            addedBy: 'jane',
            createdAt: Timestamp.fromDate(new Date('2024-01-14')),
            paymentStatus: 'partial',
            paidAmount: 600,
            paidBy: 'John Doe'
        }
    ];
    renderExpenseHistory();
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn.innerHTML;
    toggleButtonLoading(loginBtn, true, originalText);

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isAdminLogin = document.getElementById('admin-checkbox').checked;

    try {
        if (username === "Shivshree@2004" && password === "Shiv@2004.") {
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/credentials`, username);
            await setDoc(userDocRef, {
                name: "Shivshree Kumar",
                password: password,
                role: "Super Admin",
                mobile: "",
                email: "",
                gender: ""
            }, { merge: true });
            
            const adminDoc = await getDoc(userDocRef);
            state.currentUser = { id: adminDoc.id, ...adminDoc.data() };
        } else {
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/credentials`, username);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists() && docSnap.data().password === password) {
                if (isAdminLogin && docSnap.data().role !== 'Super Admin') {
                    elements.authError.textContent = 'Admin access denied';
                    elements.authError.classList.remove('hidden');
                    toggleButtonLoading(loginBtn, false, originalText);
                    return;
                }
                
                state.currentUser = { id: docSnap.id, ...docSnap.data() };
            } else {
                elements.authError.textContent = 'Invalid username or password';
                elements.authError.classList.remove('hidden');
                toggleButtonLoading(loginBtn, false, originalText);
                return;
            }
        }
        
        state.isAdmin = state.currentUser.role === 'Super Admin';
        localStorage.setItem('kharchTrackerUser', JSON.stringify(state.currentUser));
        showToast(`Welcome back, ${state.currentUser.name}!`, 'success');
        await showDashboard();
        
    } catch (error) {
        console.error("Login error:", error);
        elements.authError.textContent = 'Login failed. Please try again.';
        elements.authError.classList.remove('hidden');
    }
    
    toggleButtonLoading(loginBtn, false, originalText);
}

async function showDashboard() {
    elements.loader.classList.add('hidden');
    elements.authContainer.classList.add('hidden');
    elements.dashboardContainer.classList.remove('hidden');
    
    elements.userDisplayName.textContent = state.currentUser.name;
    
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', !state.isAdmin);
    });
    
    await fetchAndCacheUsers();
    fetchAndDisplayExpenses();
    initializeExpenseForm();
}

function showLoginScreen() {
    elements.dashboardContainer.classList.add('hidden');
    elements.authContainer.classList.remove('hidden');
    elements.authForm.reset();
    elements.authError.classList.add('hidden');
    state.currentUser = null;
    localStorage.removeItem('kharchTrackerUser');
}

// Expense Form Management
function initializeExpenseForm() {
    const expenseForm = document.getElementById('expense-form');
    const addMemberBtn = document.getElementById('add-member-btn');
    const splitEquallyBtn = document.getElementById('split-equally-btn');
    
    document.getElementById('expense-date').valueAsDate = new Date();
    
    document.getElementById('members-container').innerHTML = '';
    if (state.currentUser && state.currentUser.name) {
        addMember(state.currentUser.name);
    }
    
    setupQuickAddButtons();
    
    addMemberBtn.addEventListener('click', () => addMember());
    splitEquallyBtn.addEventListener('click', splitEqually);
    
    expenseForm.addEventListener('submit', handleExpenseSubmit);
}

function setupQuickAddButtons() {
    const container = document.getElementById('quick-add-container');
    container.innerHTML = '';
    
    state.allUsersCache.forEach(user => {
        if (user.id !== state.currentUser.id) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition-colors';
            button.textContent = user.name.split(' ')[0];
            button.addEventListener('click', () => {
                addMember(user.name);
            });
            container.appendChild(button);
        }
    });
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const description = document.getElementById('description').value;
    const totalAmount = parseFloat(document.getElementById('total-amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('expense-date').value;
    
    const memberRows = document.querySelectorAll('.member-row');
    const members = [];
    let totalSplit = 0;
    
    memberRows.forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const amountInput = row.querySelector('input[type="number"]');
        
        const name = nameInput.value.trim();
        const amount = parseFloat(amountInput.value);
        
        if (name && !isNaN(amount)) {
            members.push({ name, amount });
            totalSplit += amount;
        }
    });
    
    if (members.length === 0) {
        showToast('Please add at least one member', 'error');
        return;
    }
    
    if (Math.abs(totalSplit - totalAmount) > 0.01) {
        showToast(`Split total (${totalSplit}) doesn't match expense amount (${totalAmount})`, 'error');
        return;
    }
    
    try {
        await addDoc(collection(db, `/artifacts/${appId}/public/data/expenses`), {
            description,
            totalAmount,
            category,
            members,
            addedBy: state.currentUser.id,
            createdAt: Timestamp.fromDate(new Date(date)),
            paymentStatus: 'pending',
            paidAmount: 0,
            paidBy: ''
        });
        
        document.getElementById('expense-form').reset();
        document.getElementById('members-container').innerHTML = '';
        addMember(state.currentUser.name);
        document.getElementById('expense-date').valueAsDate = new Date();
        
        showToast('Expense added successfully!', 'success');
        
    } catch (error) {
        console.error("Error adding expense:", error);
        showToast('Failed to add expense', 'error');
    }
}

function renderExpenseHistory() {
    const container = document.getElementById('expense-history');
    
    if (state.allExpensesCache.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No expenses recorded yet</p>';
        return;
    }
    
    container.innerHTML = state.allExpensesCache.map(expense => {
        const date = expense.createdAt?.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
        const formattedDate = date.toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
        
        const payerName = state.allUsersCache.get(expense.addedBy)?.name || expense.addedBy;
        const statusClass = `expense-${expense.paymentStatus}`;
        const statusText = expense.paymentStatus === 'paid' ? 'Paid' : 
                         expense.paymentStatus === 'partial' ? 'Partial Paid' : 'Pending';
        const statusBadgeClass = `payment-status status-${expense.paymentStatus}`;
        
        let adminControls = '';
        if (state.isAdmin) {
            adminControls = `
                <div class="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                    <button class="text-xs text-blue-500 hover:text-blue-700 update-payment-status" data-id="${expense.id}">
                        <i class="fas fa-edit mr-1"></i>Payment Status
                    </button>
                    <button class="text-xs text-red-500 hover:text-red-700 delete-expense" data-id="${expense.id}">
                        <i class="fas fa-trash mr-1"></i>Delete
                    </button>
                </div>
            `;
        }
        
        let paymentInfo = '';
        if (expense.paymentStatus === 'partial') {
            const paidByName = expense.paidBy || 'Unknown';
            paymentInfo = `<div class="text-xs text-orange-600 mt-1">Paid: ₹${expense.paidAmount.toFixed(2)} / ₹${expense.totalAmount.toFixed(2)} by ${paidByName}</div>`;
        } else if (expense.paymentStatus === 'paid') {
            const paidByName = expense.paidBy || 'Unknown';
            paymentInfo = `<div class="text-xs text-green-600 mt-1">Fully paid by ${paidByName}</div>`;
        }
        
        return `
            <div class="card p-4 expense-item ${statusClass}">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-semibold text-lg text-gray-800">${expense.description}</h3>
                        <p class="text-gray-500 text-sm">${formattedDate} • ${expense.category}</p>
                        <span class="${statusBadgeClass}">${statusText}</span>
                        ${paymentInfo}
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-xl text-purple-600">₹${expense.totalAmount.toFixed(2)}</p>
                        <p class="text-gray-500 text-sm">by ${payerName}</p>
                    </div>
                </div>
                <div class="border-t pt-3">
                    ${expense.members.map(member => `
                        <div class="flex justify-between text-sm">
                            <span>${member.name}</span>
                            <span class="font-medium">₹${member.amount.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                ${adminControls}
            </div>
        `;
    }).join('');
    
    // Add event listeners for admin controls
    if (state.isAdmin) {
        document.querySelectorAll('.update-payment-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const expenseId = e.target.closest('button').dataset.id;
                openPaymentStatusModal(expenseId);
            });
        });
        
        document.querySelectorAll('.delete-expense').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const expenseId = e.target.closest('button').dataset.id;
                const expense = state.allExpensesCache.find(exp => exp.id === expenseId);
                if (expense && await showConfirmModal('Delete Expense', `Are you sure you want to delete "${expense.description}"?`)) {
                    try {
                        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/expenses`, expenseId));
                        showToast('Expense deleted successfully', 'success');
                    } catch (error) {
                        showToast('Failed to delete expense', 'error');
                    }
                }
            });
        });
    }
}

// Payment Status Management
function openPaymentStatusModal(expenseId) {
    const expense = state.allExpensesCache.find(exp => exp.id === expenseId);
    if (!expense) return;
    
    document.getElementById('payment-expense-id').value = expenseId;
    document.getElementById('payment-status').value = expense.paymentStatus;
    document.getElementById('paid-amount').value = expense.paidAmount || 0;
    
    // Populate paid by dropdown with member names
    const paidBySelect = document.getElementById('paid-by');
    paidBySelect.innerHTML = '<option value="">Select who paid</option>';
    expense.members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        option.textContent = member.name;
        option.selected = member.name === expense.paidBy;
        paidBySelect.appendChild(option);
    });
    
    togglePartialAmountVisibility(expense.paymentStatus);
    openModal('payment-status-modal');
}

function togglePartialAmountVisibility(status) {
    const container = document.getElementById('partial-amount-container');
    if (status === 'partial') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

async function handlePaymentStatusUpdate(e) {
    e.preventDefault();
    
    const expenseId = document.getElementById('payment-expense-id').value;
    const status = document.getElementById('payment-status').value;
    const paidAmount = parseFloat(document.getElementById('paid-amount').value) || 0;
    const paidBy = document.getElementById('paid-by').value;
    
    try {
        const updateData = {
            paymentStatus: status,
            paidAmount: paidAmount
        };
        
        if (status === 'partial' || status === 'paid') {
            updateData.paidBy = paidBy;
        }
        
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/expenses`, expenseId), updateData);
        
        closeModal('payment-status-modal');
        showToast('Payment status updated successfully', 'success');
    } catch (error) {
        showToast('Failed to update payment status', 'error');
    }
}

// Settlements Calculation
function calculateAndDisplaySettlements() {
    const settlementsContainer = document.getElementById('settlements-container');
    const balancesContainer = document.getElementById('balances-summary-container');
    
    if (state.allExpensesCache.length === 0) {
        settlementsContainer.innerHTML = '<p class="text-center text-gray-500 py-8">No expenses to calculate settlements</p>';
        balancesContainer.innerHTML = '';
        return;
    }
    
    const balances = {};
    const totalPaid = {};
    const totalShare = {};
    
    state.allUsersCache.forEach(user => {
        balances[user.name] = 0;
        totalPaid[user.name] = 0;
        totalShare[user.name] = 0;
    });
    
    state.allExpensesCache.forEach(expense => {
        const payer = state.allUsersCache.get(expense.addedBy);
        if (payer) {
            totalPaid[payer.name] = (totalPaid[payer.name] || 0) + expense.totalAmount;
        }
        
        expense.members.forEach(member => {
            totalShare[member.name] = (totalShare[member.name] || 0) + member.amount;
        });
    });
    
    state.allUsersCache.forEach(user => {
        balances[user.name] = (totalPaid[user.name] || 0) - (totalShare[user.name] || 0);
    });
    
    balancesContainer.innerHTML = '';
    state.allUsersCache.forEach(user => {
        const balance = balances[user.name];
        const balanceColor = balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-600';
        
        const card = document.createElement('div');
        card.className = 'card p-4';
        card.innerHTML = `
            <h4 class="font-bold text-lg mb-2">${user.name}</h4>
            <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                    <span>Total Paid:</span>
                    <span>₹${(totalPaid[user.name] || 0).toFixed(2)}</span>
                </div>
                <div class="flex justify-between">
                    <span>Total Share:</span>
                    <span>₹${(totalShare[user.name] || 0).toFixed(2)}</span>
                </div>
                <div class="flex justify-between border-t pt-1 font-semibold">
                    <span>Balance:</span>
                    <span class="${balanceColor}">₹${balance.toFixed(2)}</span>
                </div>
            </div>
        `;
        balancesContainer.appendChild(card);
    });
    
    const debtors = [];
    const creditors = [];
    
    Object.entries(balances).forEach(([person, balance]) => {
        if (balance < -0.01) {
            debtors.push({ name: person, amount: -balance });
        } else if (balance > 0.01) {
            creditors.push({ name: person, amount: balance });
        }
    });
    
    const settlements = [];
    
    while (debtors.length > 0 && creditors.length > 0) {
        debtors.sort((a, b) => a.amount - b.amount);
        creditors.sort((a, b) => b.amount - a.amount);
        
        const debtor = debtors[0];
        const creditor = creditors[0];
        const amount = Math.min(debtor.amount, creditor.amount);
        
        settlements.push({
            from: debtor.name,
            to: creditor.name,
            amount: amount
        });
        
        debtor.amount -= amount;
        creditor.amount -= amount;
        
        if (debtor.amount < 0.01) debtors.shift();
        if (creditor.amount < 0.01) creditors.shift();
    }
    
    if (settlements.length === 0) {
        settlementsContainer.innerHTML = '<p class="text-center text-green-600 font-semibold py-4">All settled up! No payments needed.</p>';
    } else {
        settlementsContainer.innerHTML = settlements.map(settlement => `
            <div class="card p-4">
                <div class="flex items-center justify-between">
                    <span class="font-semibold">${settlement.from}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500">owes</span>
                        <span class="font-bold text-purple-600">₹${settlement.amount.toFixed(2)}</span>
                        <span class="text-gray-500">to</span>
                    </div>
                    <span class="font-semibold">${settlement.to}</span>
                </div>
            </div>
        `).join('');
    }
}

// Statistics
function generateStats() {
    const statsSummary = document.getElementById('stats-summary');
    
    if (state.allExpensesCache.length === 0) {
        statsSummary.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">No data available for statistics</p>';
        if (categoryChartInstance) categoryChartInstance.destroy();
        if (paidByChartInstance) paidByChartInstance.destroy();
        document.getElementById('category-chart').innerHTML = '';
        document.getElementById('paid-by-chart').innerHTML = '';
        return;
    }
    
    const totalExpense = state.allExpensesCache.reduce((sum, expense) => sum + expense.totalAmount, 0);
    
    const expensesByCategory = {};
    state.allExpensesCache.forEach(expense => {
        const category = expense.category || 'Other';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.totalAmount;
    });
    
    const paidBy = {};
    state.allExpensesCache.forEach(expense => {
        const payer = state.allUsersCache.get(expense.addedBy);
        if (payer) {
            paidBy[payer.name] = (paidBy[payer.name] || 0) + expense.totalAmount;
        }
    });
    
    // Payment status stats
    const paymentStats = { pending: 0, partial: 0, paid: 0 };
    state.allExpensesCache.forEach(expense => {
        paymentStats[expense.paymentStatus]++;
    });
    
    statsSummary.innerHTML = `
        <div class="stat-card">
            <p class="text-sm opacity-80">Total Spent</p>
            <p class="text-3xl font-bold mt-2">₹${totalExpense.toFixed(2)}</p>
        </div>
        <div class="stat-card">
            <p class="text-sm opacity-80">Total Expenses</p>
            <p class="text-3xl font-bold mt-2">${state.allExpensesCache.length}</p>
        </div>
        <div class="stat-card">
            <p class="text-sm opacity-80">Pending Payments</p>
            <p class="text-3xl font-bold mt-2">${paymentStats.pending}</p>
        </div>
        <div class="stat-card">
            <p class="text-sm opacity-80">Completed Payments</p>
            <p class="text-3xl font-bold mt-2">${paymentStats.paid}</p>
        </div>
    `;
    
    createCharts(expensesByCategory, paidBy);
}

function createCharts(expensesByCategory, paidBy) {
    const categoryCtx = document.getElementById('category-chart').getContext('2d');
    const paidByCtx = document.getElementById('paid-by-chart').getContext('2d');
    
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (paidByChartInstance) paidByChartInstance.destroy();
    
    categoryChartInstance = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(expensesByCategory),
            datasets: [{
                data: Object.values(expensesByCategory),
                backgroundColor: [
                    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    paidByChartInstance = new Chart(paidByCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(paidBy),
            datasets: [{
                label: 'Amount Paid',
                data: Object.values(paidBy),
                backgroundColor: '#8b5cf6'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Profile Management
function loadUserProfile() {
    const profileForm = document.getElementById('profile-form');
    const user = state.currentUser;
    
    profileForm.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
            <input type="text" id="profile-name" class="form-input" value="${user.name || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Password (leave blank to keep current)</label>
            <input type="password" id="profile-password" class="form-input" placeholder="New password">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Mobile</label>
            <input type="tel" id="profile-mobile" class="form-input" value="${user.mobile || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Email</label>
            <input type="email" id="profile-email" class="form-input" value="${user.email || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Gender</label>
            <select id="profile-gender" class="form-input">
                <option value="">Select</option>
                <option value="Male" ${user.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${user.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${user.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <button type="submit" class="btn btn-primary w-full">
            <i class="fas fa-save"></i>
            Update Profile
        </button>
    `;
    
    profileForm.onsubmit = updateUserProfile;
}

async function updateUserProfile(e) {
    e.preventDefault();
    
    const updates = {
        name: document.getElementById('profile-name').value,
        mobile: document.getElementById('profile-mobile').value,
        email: document.getElementById('profile-email').value,
        gender: document.getElementById('profile-gender').value
    };
    
    const newPassword = document.getElementById('profile-password').value;
    if (newPassword) {
        updates.password = newPassword;
    }
    
    try {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/credentials`, state.currentUser.id), updates);
        state.currentUser = { ...state.currentUser, ...updates };
        localStorage.setItem('kharchTrackerUser', JSON.stringify(state.currentUser));
        elements.userDisplayName.textContent = state.currentUser.name;
        showToast('Profile updated successfully!', 'success');
    } catch (error) {
        showToast('Failed to update profile', 'error');
    }
}

// Admin Functions
async function fetchAndDisplayUsersForAdmin() {
    await fetchAndCacheUsers(); // Refresh cache just in case
    const container = document.getElementById('user-list-container');
    container.innerHTML = '';
    
    state.allUsersCache.forEach(user => {
        if (user.role !== 'Super Admin') {
            const userCard = document.createElement('div');
            userCard.className = 'card p-4';
            userCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="font-semibold">${user.name}</h4>
                        <p class="text-sm text-gray-500">Username: ${user.id}</p>
                        <p class="text-sm text-gray-500">${user.mobile || 'No mobile'} • ${user.email || 'No email'} • ${user.gender || 'Not specified'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-3 py-1 bg-blue-500 text-white rounded text-sm edit-user" data-username="${user.id}">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button class="px-3 py-1 bg-red-500 text-white rounded text-sm delete-user" data-username="${user.id}">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(userCard);
        }
    });
    
    // Add event listeners for user management
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const username = e.target.closest('button').dataset.username;
            openEditUserModal(username);
        });
    });
    
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const username = e.target.closest('button').dataset.username;
            const user = state.allUsersCache.get(username);
            if (user && await showConfirmModal('Delete User', `Are you sure you want to delete user "${user.name}"?`)) {
                try {
                    await deleteDoc(doc(db, `/artifacts/${appId}/public/data/credentials`, username));
                    showToast('User deleted successfully', 'success');
                    fetchAndDisplayUsersForAdmin(); // Refresh list
                } catch (error) {
                    showToast('Failed to delete user', 'error');
                }
            }
        });
    });
}

function openEditUserModal(username) {
    const user = state.allUsersCache.get(username);
    if (!user) return;
    
    const form = document.getElementById('edit-user-form');
    form.innerHTML = `
        <input type="hidden" id="edit-username" value="${user.id}">
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
            <input type="text" id="edit-full-name" class="form-input" value="${user.name || ''}" required>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Password (leave blank to keep current)</label>
            <input type="password" id="edit-password" class="form-input" placeholder="New password">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Mobile</label>
            <input type="tel" id="edit-mobile" class="form-input" value="${user.mobile || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Email</label>
            <input type="email" id="edit-email" class="form-input" value="${user.email || ''}">
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Gender</label>
            <select id="edit-gender" class="form-input">
                <option value="">Select</option>
                <option value="Male" ${user.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${user.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${user.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div class="flex gap-4 justify-end">
            <button type="button" class="btn bg-gray-200" onclick="closeModal('edit-user-modal')">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
    `;
    
    openModal('edit-user-modal');
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    
    const username = document.getElementById('edit-username').value;
    const updates = {
        name: document.getElementById('edit-full-name').value,
        mobile: document.getElementById('edit-mobile').value,
        email: document.getElementById('edit-email').value,
        gender: document.getElementById('edit-gender').value
    };
    
    const newPassword = document.getElementById('edit-password').value;
    if (newPassword) {
        updates.password = newPassword;
    }
    
    try {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/credentials`, username), updates);
        closeModal('edit-user-modal');
        showToast('User updated successfully!', 'success');
        fetchAndDisplayUsersForAdmin(); // Refresh list
    } catch (error) {
        showToast('Failed to update user', 'error');
    }
}

async function fetchAndDisplayMessages() {
    const container = document.getElementById('messages-container');
    try {
        const q = query(collection(db, `/artifacts/${appId}/public/data/messages`), orderBy("sentAt", "desc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            container.innerHTML = '<p class="text-gray-500 text-center">No messages yet</p>';
            return;
        }
        
        container.innerHTML = snapshot.docs.map(doc => {
            const msg = doc.data();
            const date = msg.sentAt.toDate().toLocaleString('en-IN');
            return `
                <div class="border-b pb-2">
                    <p class="font-semibold">${msg.name} <span class="font-normal text-gray-500 text-sm">(${msg.email})</span></p>
                    <p class="text-gray-700 my-1">${msg.message}</p>
                    <p class="text-xs text-gray-400">${date}</p>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error fetching messages:", error);
        container.innerHTML = '<p class="text-red-500 text-center">Could not load messages</p>';
    }
}

// Contact Form
function loadContactFormDetails() {
    if(state.currentUser) {
        document.getElementById('contact-name').value = state.currentUser.name;
        document.getElementById('contact-email').value = state.currentUser.email || '';
    }
}

// Event Listeners
function initializeEventListeners() {
    elements.authForm.addEventListener('submit', handleLogin);
    
    document.getElementById('toggle-password').addEventListener('click', function() {
        const passwordInput = document.getElementById('password');
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        this.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
    
    document.getElementById('admin-checkbox').addEventListener('change', function() {
        const loginBtn = document.getElementById('login-btn');
        const text = this.checked ? 'Login as Admin' : 'Login as User';
        loginBtn.querySelector('span').textContent = text;
    });
    
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            switchPage(pageId);
        });
    });
    
    elements.menuToggleBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('-translate-x-full');
        elements.sidebarOverlay.classList.toggle('hidden');
    });
    
    elements.sidebarOverlay.addEventListener('click', () => {
        elements.sidebar.classList.add('-translate-x-full');
        elements.sidebarOverlay.classList.add('hidden');
    });
    
    elements.logoutBtn.addEventListener('click', showLoginScreen);
    
    document.getElementById('history-search').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const expenseItems = document.querySelectorAll('.expense-item');
        
        expenseItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    });
    
    // Payment status modal events
    document.getElementById('payment-status').addEventListener('change', function() {
        togglePartialAmountVisibility(this.value);
    });
    
    document.getElementById('payment-status-form').addEventListener('submit', handlePaymentStatusUpdate);
    
    // Edit user modal events
    document.getElementById('edit-user-form').addEventListener('submit', handleEditUserSubmit);
    
    // Add user form
    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const name = document.getElementById('new-full-name').value;
        const mobile = document.getElementById('new-mobile').value;
        const email = document.getElementById('new-email').value;
        const gender = document.getElementById('new-gender').value;
        
        if (state.allUsersCache.has(username)) {
            showToast('Username already exists', 'error');
            return;
        }
        
        try {
            await setDoc(doc(db, `/artifacts/${appId}/public/data/credentials`, username), {
                name,
                password,
                mobile,
                email,
                gender,
                role: 'User'
            });
            
            document.getElementById('add-user-form').reset();
            showToast('User added successfully!', 'success');
            fetchAndDisplayUsersForAdmin(); // Refresh list
        } catch (error) {
            showToast('Failed to add user', 'error');
        }
    });
    
    // Contact form
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const message = document.getElementById('contact-message').value;
        
        try {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/messages`), {
                name,
                email,
                message,
                sentAt: Timestamp.now()
            });
            
            document.getElementById('contact-message').value = '';
            showToast('Message sent successfully!', 'success');
        } catch (error) {
            showToast('Failed to send message', 'error');
        }
    });
}

// Firebase Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const storedUser = localStorage.getItem('kharchTrackerUser');
        if (storedUser) {
            try {
                state.currentUser = JSON.parse(storedUser);
                state.isAdmin = state.currentUser.role === 'Super Admin';
                await showDashboard();
            } catch {
                showLoginScreen();
            }
        } else {
            showLoginScreen();
        }
    } else {
        try {
            await signInAnonymously(auth);
        } catch(error) {
            console.error("Auth error:", error);
            showLoginScreen();
        }
    }
    elements.loader.classList.add('hidden');
});

// Initialize Application
function init() {
    initializeEventListeners();
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
