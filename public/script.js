// Global variables
let domains = [];
let filteredDomains = [];
let serverTime = null;

// DOM elements
const domainsGrid = document.getElementById('domains-grid');
const loading = document.getElementById('loading');
const domainInput = document.getElementById('domain-input');
const domainTypeSelect = document.getElementById('domain-type-select');
const notesInput = document.getElementById('notes-input');
const addDomainBtn = document.getElementById('add-domain-btn');
const refreshAllBtn = document.getElementById('refresh-all-btn');
const exportBtn = document.getElementById('export-btn');
const domainTypeFilter = document.getElementById('domain-type-filter');
const statusFilter = document.getElementById('status-filter');
const sortFilter = document.getElementById('sort-filter');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('domain-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

// Stats elements
const totalDomains = document.getElementById('total-domains');
const expiringDomains = document.getElementById('expiring-domains');
const activeDomains = document.getElementById('active-domains');
const errorDomains = document.getElementById('error-domains');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Prevent audio/video autoplay errors
    document.addEventListener('play', function(e) {
        if (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO') {
            e.preventDefault();
        }
    }, true);
    
    // Handle unhandled promise rejections that might cause audio errors
    window.addEventListener('unhandledrejection', function(event) {
        if (event.reason && event.reason.name === 'AbortError') {
            console.log('Prevented audio AbortError:', event.reason.message);
            event.preventDefault();
        }
    });
    
    // Disable any audio context that might be created accidentally
    if (window.AudioContext || window.webkitAudioContext) {
        const originalAudioContext = window.AudioContext || window.webkitAudioContext;
        window.AudioContext = window.webkitAudioContext = function() {
            console.log('AudioContext creation prevented');
            return null;
        };
    }
    
    checkSystemTime();
    loadDomains();
    setupEventListeners();
    
    // Auto-refresh every 5 minutes
    setInterval(loadDomains, 5 * 60 * 1000);
});

// Check system time for potential issues
async function checkSystemTime() {
    try {
        const response = await fetch('/api/system-info');
        const info = await response.json();
        
        if (info.warning) {
            showNotification(`⚠️ ${info.warning}. Ngày hệ thống: ${info.system_date.split('T')[0]}`, 'warning');
        }
    } catch (error) {
        console.error('Error checking system time:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    addDomainBtn.addEventListener('click', addDomain);
    domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDomain();
    });
    
    refreshAllBtn.addEventListener('click', refreshAllDomains);
    exportBtn.addEventListener('click', exportToCSV);
    
    domainTypeFilter.addEventListener('change', loadDomains);
    statusFilter.addEventListener('change', filterDomains);
    sortFilter.addEventListener('change', loadDomains);
    searchInput.addEventListener('input', filterDomains);
    
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    notificationClose.addEventListener('click', hideNotification);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Load domains from API
async function loadDomains() {
    try {
        const domainType = domainTypeFilter.value;
        const sortBy = sortFilter.value;
        const sortOrder = 'ASC';
        
        const params = new URLSearchParams();
        if (domainType !== 'all') params.append('type', domainType);
        if (sortBy) params.append('sort', sortBy);
        if (sortOrder) params.append('order', sortOrder);
        
        const response = await fetch(`/api/domains?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load domains');
        
        const data = await response.json();
        
        // Handle new API response format
        if (data.domains) {
            domains = data.domains;
            serverTime = data.server_time;
            console.log(`Server time: ${serverTime}`);
            
            // Update server time display
            const serverTimeDisplay = document.getElementById('server-time-display');
            if (serverTimeDisplay && serverTime) {
                serverTimeDisplay.textContent = serverTime;
            }
        } else {
            // Fallback for old format
            domains = data;
        }
        
        filteredDomains = [...domains];
        
        updateStats();
        renderDomains();
        hideLoading();
    } catch (error) {
        console.error('Error loading domains:', error);
        showNotification('Lỗi khi tải danh sách domain', 'error');
        hideLoading();
    }
}

// Add new domain
async function addDomain() {
    const domainName = domainInput.value.trim();
    const domainType = domainTypeSelect.value;
    const notes = notesInput.value.trim();
    
    if (!domainName) {
        showNotification('Vui lòng nhập tên domain', 'warning');
        return;
    }
    
    try {
        addDomainBtn.disabled = true;
        addDomainBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang thêm...';
        
        const response = await fetch('/api/domains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                domain: domainName,
                domain_type: domainType,
                notes: notes
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to add domain');
        }
        
        domainInput.value = '';
        notesInput.value = '';
        domainTypeSelect.value = 'my_domain';
        showNotification(`Domain ${result.domain} đã được thêm thành công!`);
        
        // Refresh domains list
        setTimeout(loadDomains, 1000);
        
    } catch (error) {
        console.error('Error adding domain:', error);
        showNotification(error.message, 'error');
    } finally {
        addDomainBtn.disabled = false;
        addDomainBtn.innerHTML = '<i class="fas fa-plus"></i> Thêm Domain';
    }
}

// Delete domain
async function deleteDomain(id, domainName) {
    if (!confirm(`Bạn có chắc chắn muốn xóa domain "${domainName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/domains/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to delete domain');
        }
        
        showNotification(`Domain ${domainName} đã được xóa thành công!`);
        loadDomains();
        
    } catch (error) {
        console.error('Error deleting domain:', error);
        showNotification(error.message, 'error');
    }
}

// Refresh single domain
async function refreshDomain(id, domainName) {
    try {
        const response = await fetch(`/api/domains/${id}/refresh`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to refresh domain');
        }
        
        showNotification(`Đang cập nhật thông tin cho ${domainName}...`);
        
        // Refresh domains list after a delay
        setTimeout(loadDomains, 2000);
        
    } catch (error) {
        console.error('Error refreshing domain:', error);
        showNotification(error.message, 'error');
    }
}

// Refresh all domains
async function refreshAllDomains() {
    refreshAllBtn.disabled = true;
    refreshAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang cập nhật...';
    
    try {
        const refreshPromises = domains.map(domain => 
            fetch(`/api/domains/${domain.id}/refresh`, { method: 'POST' })
        );
        
        await Promise.all(refreshPromises);
        showNotification('Đang cập nhật thông tin tất cả domain...');
        
        // Refresh domains list after a delay
        setTimeout(loadDomains, 5000);
        
    } catch (error) {
        console.error('Error refreshing all domains:', error);
        showNotification('Lỗi khi cập nhật domain', 'error');
    } finally {
        setTimeout(() => {
            refreshAllBtn.disabled = false;
            refreshAllBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Cập nhật tất cả';
        }, 5000);
    }
}

// Filter domains
function filterDomains() {
    const statusValue = statusFilter.value;
    const searchValue = searchInput.value.toLowerCase();
    
    filteredDomains = domains.filter(domain => {
        const matchesStatus = statusValue === 'all' || 
            (statusValue === 'expiring' && domain.days_until_expiry !== null && domain.days_until_expiry <= 30) ||
            (statusValue === 'active' && domain.status === 'active') ||
            (statusValue === 'error' && domain.status === 'error');
            
        const matchesSearch = domain.domain.toLowerCase().includes(searchValue);
        
        return matchesStatus && matchesSearch;
    });
    
    renderDomains();
}

// Update statistics
function updateStats() {
    const total = domains.length;
    const expiring = domains.filter(d => d.days_until_expiry !== null && d.days_until_expiry <= 30).length;
    const active = domains.filter(d => d.status === 'active').length;
    const errors = domains.filter(d => d.status === 'error').length;
    
    // Update main stats
    totalDomains.textContent = total;
    expiringDomains.textContent = expiring;
    activeDomains.textContent = active;
    errorDomains.textContent = errors;
    
    // Add detailed stats tooltip
    const myDomains = domains.filter(d => d.domain_type === 'my_domain').length;
    const competitorDomains = domains.filter(d => d.domain_type === 'competitor_domain').length;
    
    totalDomains.title = `Domain của tôi: ${myDomains}, Domain đối thủ: ${competitorDomains}`;
}

// Render domains
function renderDomains() {
    if (filteredDomains.length === 0) {
        domainsGrid.innerHTML = `
            <div class="loading">
                <i class="fas fa-search"></i>
                <p>Không tìm thấy domain nào</p>
            </div>
        `;
        return;
    }
    
    domainsGrid.innerHTML = filteredDomains.map(domain => {
        const cardClass = getCardClass(domain);
        const expiryInfo = getExpiryInfo(domain);
        const statusBadge = getStatusBadge(domain.status);
        const domainTypeBadge = getDomainTypeBadge(domain.domain_type);
        
        return `
            <div class="domain-card ${cardClass} ${domain.domain_type}" data-domain-id="${domain.id}">
                <div class="domain-header">
                    <div class="domain-name" title="${domain.domain}">
                        ${domain.domain}
                        ${domainTypeBadge}
                    </div>
                    <div class="domain-actions">
                        <button class="action-btn" onclick="editDomain(${domain.id})" title="Chỉnh sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="refreshDomain(${domain.id}, '${domain.domain}')" title="Cập nhật">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="action-btn" onclick="showDomainDetails(${domain.id})" title="Chi tiết">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <button class="action-btn" onclick="deleteDomain(${domain.id}, '${domain.domain}')" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="domain-info">
                    <div class="info-row">
                        <span class="info-label">Trạng thái:</span>
                        <span class="info-value">${statusBadge}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Hết hạn:</span>
                        <span class="info-value">
                            ${domain.expiry_date ? formatDate(domain.expiry_date) : 'Đang cập nhật...'}
                        </span>
                    </div>
                    ${expiryInfo ? `
                    <div class="info-row">
                        <span class="info-label">Thời gian còn lại:</span>
                        <span class="info-value">${expiryInfo}</span>
                    </div>
                    ` : ''}
                    ${domain.registrar ? `
                    <div class="info-row">
                        <span class="info-label">Nhà đăng ký:</span>
                        <span class="info-value">${domain.registrar}</span>
                    </div>
                    ` : ''}
                    ${domain.notes ? `
                    <div class="info-row">
                        <span class="info-label">Ghi chú:</span>
                        <span class="info-value">${domain.notes}</span>
                    </div>
                    ` : ''}
                    <div class="info-row">
                        <span class="info-label">Cập nhật lần cuối:</span>
                        <span class="info-value">
                            ${domain.last_checked ? formatDateTime(domain.last_checked) : 'Chưa bao giờ'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Get card class based on domain status
function getCardClass(domain) {
    if (domain.status === 'error') return 'error';
    if (domain.days_until_expiry !== null && domain.days_until_expiry <= 30) return 'expiring';
    if (domain.status === 'active') return 'active';
    return '';
}

// Get expiry info
function getExpiryInfo(domain) {
    if (domain.status === 'error' || domain.status === 'not_found' || domain.status === 'no_data') {
        return `<span class="expiry-badge error">Không xác định</span>`;
    }
    
    if (domain.days_until_expiry === null) return null;
    
    if (domain.days_until_expiry < 0) {
        return `<span class="expiry-badge expired">Đã hết hạn ${Math.abs(domain.days_until_expiry)} ngày</span>`;
    } else if (domain.days_until_expiry <= 30) {
        return `<span class="expiry-badge expiring">${domain.days_until_expiry} ngày</span>`;
    } else {
        return `<span class="expiry-badge">${domain.days_until_expiry} ngày</span>`;
    }
}

// Get status badge
function getStatusBadge(status) {
    const statusMap = {
        'active': 'Hoạt động',
        'pending': 'Đang kiểm tra',
        'error': 'Lỗi/Không tồn tại',
        'not_found': 'Không tồn tại',
        'no_data': 'Không có dữ liệu'
    };
    
    return `<span class="status-badge ${status}">${statusMap[status] || status}</span>`;
}

// Get domain type badge
function getDomainTypeBadge(domainType) {
    const typeMap = {
        'my_domain': { text: 'Của tôi', class: 'my-domain' },
        'competitor_domain': { text: 'Đối thủ', class: 'competitor' }
    };
    
    const type = typeMap[domainType] || { text: domainType, class: 'default' };
    return `<span class="domain-type-badge ${type.class}">${type.text}</span>`;
}

// Edit domain
async function editDomain(id) {
    const domain = domains.find(d => d.id === id);
    if (!domain) return;
    
    const newType = prompt('Chọn loại domain:\nmy_domain = Domain của tôi\ncompetitor_domain = Domain đối thủ', domain.domain_type);
    const newNotes = prompt('Ghi chú:', domain.notes || '');
    
    if (newType === null) return; // User cancelled
    
    try {
        const response = await fetch(`/api/domains/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain_type: newType,
                notes: newNotes || ''
            })
        });
        
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to update domain');
        }
        
        showNotification(`Domain ${domain.domain} đã được cập nhật!`);
        loadDomains();
        
    } catch (error) {
        console.error('Error updating domain:', error);
        showNotification(error.message, 'error');
    }
}

// Show domain details
function showDomainDetails(id) {
    const domain = domains.find(d => d.id === id);
    if (!domain) return;
    
    const expiryInfo = getExpiryInfo(domain);
    
    modalBody.innerHTML = `
        <div class="domain-details">
            <h3>${domain.domain}</h3>
            <div class="detail-grid">
                <div class="detail-row">
                    <strong>Trạng thái:</strong>
                    ${getStatusBadge(domain.status)}
                </div>
                <div class="detail-row">
                    <strong>Ngày hết hạn:</strong>
                    ${domain.expiry_date ? formatDate(domain.expiry_date) : 'Chưa xác định'}
                </div>
                ${expiryInfo ? `
                <div class="detail-row">
                    <strong>Thời gian còn lại:</strong>
                    ${expiryInfo}
                </div>
                ` : ''}
                <div class="detail-row">
                    <strong>Nhà đăng ký:</strong>
                    ${domain.registrar || 'Chưa xác định'}
                </div>
                <div class="detail-row">
                    <strong>Ngày tạo:</strong>
                    ${formatDateTime(domain.created_at)}
                </div>
                <div class="detail-row">
                    <strong>Cập nhật lần cuối:</strong>
                    ${domain.last_checked ? formatDateTime(domain.last_checked) : 'Chưa bao giờ'}
                </div>
            </div>
            <div class="modal-actions">
                <button onclick="refreshDomain(${domain.id}, '${domain.domain}'); modal.style.display = 'none';" class="btn-secondary">
                    <i class="fas fa-sync-alt"></i> Cập nhật
                </button>
                <button onclick="deleteDomain(${domain.id}, '${domain.domain}'); modal.style.display = 'none';" class="btn-secondary" style="background: #dc3545; color: white;">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Export to CSV
function exportToCSV() {
    const headers = ['Domain', 'Trạng thái', 'Ngày hết hạn', 'Số ngày còn lại', 'Nhà đăng ký', 'Cập nhật lần cuối'];
    const csvContent = [
        headers.join(','),
        ...domains.map(domain => [
            domain.domain,
            domain.status,
            domain.expiry_date || '',
            domain.days_until_expiry || '',
            domain.registrar || '',
            domain.last_checked || ''
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `domains_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('File CSV đã được tải xuống!');
}

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('vi-VN');
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('vi-VN');
}

function hideLoading() {
    loading.style.display = 'none';
}

function showNotification(message, type = 'success') {
    notification.className = `notification ${type}`;
    notificationMessage.textContent = message;
    notification.style.display = 'flex';
    
    // Auto hide after 5 seconds
    setTimeout(hideNotification, 5000);
}

function hideNotification() {
    notification.style.display = 'none';
}

// Add CSS for modal actions
const style = document.createElement('style');
style.textContent = `
    .domain-details h3 {
        margin-bottom: 20px;
        color: #2c3e50;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
    }
    
    .detail-grid {
        display: grid;
        gap: 15px;
        margin-bottom: 30px;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #f8f9fa;
    }
    
    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        border-top: 2px solid #e9ecef;
        padding-top: 20px;
    }
`;
document.head.appendChild(style); 