// ===== HỆ THỐNG KIỂM TRA NGUYÊN LIỆU - KovaNano =====

// Tạo danh sách bồn cố định từ 101-126 (26 bồn)
// Bồn 112, 124, 126 có tên đặc biệt: FM112, FM124, FM126
function generateDefaultTanks() {
    const tanks = [];
    for (let i = 101; i <= 126; i++) {
        const isSpecial = (i === 112 || i === 124 || i === 126);
        const name = isSpecial ? `FM${i}` : `Bồn ${i}`;
        const capacity = 1000;
        const currentVolume = 800; // Mặc 800L (còn nhiều)
        const density = 1.0;
        tanks.push({
            id: i,
            name: name,
            material: "",
            capacity: capacity,
            currentVolume: currentVolume,
            density: density,
            warningThreshold: 200,
            initialMass: currentVolume * density,
            lastUpdated: new Date().toISOString()
        });
    }
    return tanks;
}

const defaultTanks = generateDefaultTanks();

const defaultHistory = [
    {
        id: 1,
        timestamp: new Date().toISOString(),
        tankName: "Bồn A1",
        material: "",
        usedMass: 180,
        remainingMass: 1020
    }
];

// ===== LOCAL STORAGE FUNCTIONS =====
const TANKS_VERSION = 'v2_101_126'; // bản 26 bồn 101-126 với FM112, FM124, FM126

function loadTanks() {
    const savedVersion = localStorage.getItem('kovaNano_tanks_version');
    const saved = localStorage.getItem('kovaNano_tanks');

    // Nếu khác version (dữ liệu cũ) hoặc không có dữ liệu, reset lại
    if (!saved || savedVersion !== TANKS_VERSION) {
        localStorage.setItem('kovaNano_tanks', JSON.stringify(defaultTanks));
        localStorage.setItem('kovaNano_tanks_version', TANKS_VERSION);
        return [...defaultTanks];
    }

    const parsed = JSON.parse(saved);
    // Bảo vệ: nếu dữ liệu sai số lượng hoặc id sai, reset
    if (!Array.isArray(parsed) || parsed.length < 26 || parsed[0].id !== 101) {
        localStorage.setItem('kovaNano_tanks', JSON.stringify(defaultTanks));
        return [...defaultTanks];
    }
    return parsed;
}

function loadHistory() {
    const saved = localStorage.getItem('kovaNano_history');
    if (saved) {
        return JSON.parse(saved);
    }
    localStorage.setItem('kovaNano_history', JSON.stringify(defaultHistory));
    return [...defaultHistory];
}

function saveTanks() {
    localStorage.setItem('kovaNano_tanks', JSON.stringify(tanks));
}

function saveHistory() {
    localStorage.setItem('kovaNano_history', JSON.stringify(history));
}

// Lấy dữ liệu từ localStorage hoặc dùng dữ liệu mẫu
let tanks = loadTanks();
let history = loadHistory();
let editingTankId = null;

// ===== UTILITY FUNCTIONS =====
function formatNumber(num, decimals = 2) {
    return Number(num).toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    });
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Chuyển ngày input (YYYY-MM-DD) sang Date object (đặt về đầu ngày - 00:00)
function dateInputToDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date;
}

// Lấy danh sách lịch sử đã lọc theo ngày
function getFilteredHistory() {
    const fromDateStr = document.getElementById('historyFromDate').value;
    const toDateStr = document.getElementById('historyToDate').value;

    let filtered = [...history];

    if (fromDateStr) {
        const fromDate = dateInputToDate(fromDateStr);
        filtered = filtered.filter(record => new Date(record.timestamp) >= fromDate);
    }

    if (toDateStr) {
        const toDate = dateInputToDate(toDateStr);
        // Đến ngày: đặt về cuối ngày (23:59:59) để bao gồm cả ngày đó
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(record => new Date(record.timestamp) <= toDate);
    }

    // Sắp xếp theo thời gian mới nhất
    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Khối lượng hiện tại (g) = thể tích (L) * khối lượng riêng (g/L)
function getCurrentMass(tank) {
    return tank.currentVolume * tank.density;
}

// Khối lượng đã dùng (g) = khối lượng ban đầu - khối lượng hiện tại
function getUsedMass(tank) {
    return tank.initialMass - getCurrentMass(tank);
}

// Chuyển đổi từ g sang kg khi hiển thị
function formatMassKg(massInG) {
    return formatNumber(massInG / 1000, 3);
}

// Trạng thái bồn
function getTankStatus(tank) {
    const currentMass = getCurrentMass(tank);
    if (currentMass <= 0) {
        return 'empty'; // Hết
    } else if (currentMass <= tank.warningThreshold) {
        return 'warning'; // Sắp hết
    } else {
        return 'available'; // Còn
    }
}

function getStatusBadge(status) {
    switch (status) {
        case 'available':
            return '<span class="status-badge status-available">✅ Còn</span>';
        case 'warning':
            return '<span class="status-badge status-warning">⚠️ Sắp hết</span>';
        case 'empty':
            return '<span class="status-badge status-empty">❌ Hết</span>';
        default:
            return '<span class="status-badge">Unknown</span>';
    }
}

// ===== PROFESSIONAL NOTIFICATION SYSTEM =====

// Hiển thị modal thông báo (thay alert) - có 1 nút Đóng
function showNotif(type, title, message) {
    return new Promise((resolve) => {
        const icons = { warning: '⚠️', danger: '⛔', info: 'ℹ️', success: '✅' };
        const icon = icons[type] || 'ℹ️';

        const modal = document.createElement('div');
        modal.className = 'notif-modal';
        modal.innerHTML = `
            <div class="notif-box">
                <div class="notif-header notif-${type}">
                    <span class="notif-icon">${icon}</span>
                    <span class="notif-title">${title}</span>
                </div>
                <div class="notif-body">${message}</div>
                <div class="notif-actions">
                    <button class="notif-btn notif-btn-confirm" id="notifCloseBtn">Đóng</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#notifCloseBtn');
        const close = () => {
            modal.remove();
            resolve(true);
        };
        closeBtn.addEventListener('click', close);

        // Đóng khi click ngoài
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    });
}

// Hiển thị modal xác nhận (thay confirm) - có 2 nút: Xác nhận (true) / Hủy (false)
function showConfirm(type, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', isDanger = false) {
    return new Promise((resolve) => {
        const icons = { warning: '⚠️', danger: '⛔', info: 'ℹ️', success: '✅' };
        const icon = icons[type] || 'ℹ️';

        const modal = document.createElement('div');
        modal.className = 'notif-modal';
        modal.innerHTML = `
            <div class="notif-box">
                <div class="notif-header notif-${type}">
                    <span class="notif-icon">${icon}</span>
                    <span class="notif-title">${title}</span>
                </div>
                <div class="notif-body">${message}</div>
                <div class="notif-actions">
                    <button class="notif-btn notif-btn-cancel" id="notifCancelBtn">${cancelText}</button>
                    <button class="notif-btn ${isDanger ? 'notif-btn-danger' : 'notif-btn-confirm'}" id="notifConfirmBtn">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const confirmBtn = modal.querySelector('#notifConfirmBtn');
        const cancelBtn = modal.querySelector('#notifCancelBtn');

        const close = (result) => {
            modal.remove();
            resolve(result);
        };

        confirmBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));

        // Đóng = Hủy khi click ngoài
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close(false);
        });
    });
}

// Hiển thị toast notification (góc phải, tự ẩn sau 4s)
function showToast(type, message) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = { warning: '⚠️', danger: '❌', success: '✅', info: 'ℹ️' };
    const icon = icons[type] || 'ℹ️';

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    // Tự ẩn sau 4 giây
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===== DATETIME DISPLAY =====
function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDateTime').textContent = '📅 ' + formatDateTime(now.toISOString());
}

// ===== SUMMARY CARDS =====
function updateSummaryCards() {
    const total = tanks.length;
    let available = 0, warning = 0, empty = 0;

    tanks.forEach(tank => {
        const status = getTankStatus(tank);
        if (status === 'available') available++;
        else if (status === 'warning') warning++;
        else if (status === 'empty') empty++;
    });

    document.getElementById('totalTanks').textContent = total;
    document.getElementById('availableTanks').textContent = available;
    document.getElementById('warningTanks').textContent = warning;
    document.getElementById('emptyTanks').textContent = empty;
}

// ===== WARNING BANNER =====
function updateWarningBanner() {
    const warningTanks = tanks.filter(tank => {
        const status = getTankStatus(tank);
        return status === 'warning' || status === 'empty';
    });

    const banner = document.getElementById('warningBanner');
    const message = document.getElementById('warningMessage');

    if (warningTanks.length > 0) {
        const warningNames = warningTanks.map(t => {
            const mass = getCurrentMass(t);
            const status = getTankStatus(t);
            const statusText = status === 'empty' ? 'ĐÃ HẾT' : `còn ${formatMassKg(mass)}kg`;
            return `${t.name} - ${statusText}`;
        }).join('; ');

        message.textContent = `CẢNH BÁO: Các bồn nguyên liệu dưới ngưỡng ${formatMassKg(warningTanks[0].warningThreshold)}kg - ${warningNames}`;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

// Bộ lọc hiện tại
let currentFilter = { name: '', currentMass: 0, usedMass: 0, status: '' };

// ===== RENDER TANKS TABLE =====
function renderTanksTable() {
    const tbody = document.getElementById('tanksTableBody');
    tbody.innerHTML = '';

    let filteredTanks = tanks;
    const hasFilter = currentFilter.name || currentFilter.currentMass > 0 || currentFilter.usedMass > 0 || currentFilter.status;
    if (hasFilter) {
        filteredTanks = tanks.filter(tank => {
            const matchName = !currentFilter.name || tank.name.toLowerCase().includes(currentFilter.name.toLowerCase());
            const matchCurrentMass = !currentFilter.currentMass || getCurrentMass(tank) >= currentFilter.currentMass;
            const matchUsedMass = !currentFilter.usedMass || getUsedMass(tank) >= currentFilter.usedMass;
            const matchStatus = !currentFilter.status || getTankStatus(tank) === currentFilter.status;
            return matchName && matchCurrentMass && matchUsedMass && matchStatus;
        });
    }

    if (filteredTanks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Không tìm thấy bồn nguyên liệu phù hợp!</td></tr>';
        return;
    }

    filteredTanks.forEach((tank, index) => {
        const currentMass = getCurrentMass(tank);
        const usedMass = getUsedMass(tank);
        const status = getTankStatus(tank);

        // Highlight row nếu cảnh báo
        let rowClass = '';
        if (status === 'warning') rowClass = 'style="background-color: #fff8e1;"';
        else if (status === 'empty') rowClass = 'style="background-color: #fdecea;"';

        const row = `
            <tr ${rowClass}>
                <td>${index + 1}</td>
                <td><strong>${tank.name}</strong></td>
                <td>${formatMassKg(currentMass)} kg</td>
                <td>${formatMassKg(usedMass)} kg</td>
                <td>${getStatusBadge(status)}</td>
                <td>${formatDateTime(tank.lastUpdated)}</td>
                <td>
                    <button class="btn btn-use btn-small" onclick="openUsageModal(${tank.id})">Dùng</button>
                    <button class="btn btn-edit btn-small" onclick="editTank(${tank.id})">Sửa</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// ===== RENDER HISTORY TABLE =====
function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    const filteredHistory = getFilteredHistory();

    if (filteredHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Chưa có lịch sử sử dụng nguyên liệu trong khoảng thời gian này.</td></tr>';
        return;
    }

    filteredHistory.forEach((record, index) => {
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${formatDateTime(record.timestamp)}</td>
                <td><strong>${record.tankName}</strong></td>
                <td>${formatMassKg(record.usedMass)} kg</td>
                <td>${formatMassKg(record.remainingMass)} kg</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// ===== HISTORY DATE FILTER =====
function resetHistoryDateFilter() {
    document.getElementById('historyFromDate').value = '';
    document.getElementById('historyToDate').value = '';
    renderHistoryTable();
}

// ===== EXPORT HISTORY TO EXCEL =====
async function exportHistoryToExcel() {
    const filteredHistory = getFilteredHistory();

    if (filteredHistory.length === 0) {
        await showNotif('warning', 'Không có dữ liệu', 'Không có dữ liệu lịch sử để xuất ra file Excel!');
        return;
    }

    const statusEl = document.getElementById('exportStatus');

    try {
        // Tạo dữ liệu cho Excel
        const data = filteredHistory.map((record, index) => ({
            'STT': index + 1,
            'Thời gian': formatDateTime(record.timestamp),
            'Tên bồn': record.tankName,
            'Khối lượng dùng (kg)': formatMassKg(record.usedMass),
            'Khối lượng còn lại (kg)': formatMassKg(record.remainingMass)
        }));

        // Tạo worksheet
        const ws = XLSX.utils.json_to_sheet(data);

        // Cài đặt độ rộng cột tự động
        ws['!cols'] = [
            { wch: 6 },   // STT
            { wch: 22 },  // Thời gian
            { wch: 15 },  // Tên bồn
            { wch: 20 },  // Khối lượng dùng
            { wch: 22 }   // Khối lượng còn lại
        ];

        // Tạo workbook và thêm worksheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử sử dụng');

        // Tạo tên file với ngày tháng hiện tại
        const now = new Date();
        const fileName = `LichSuSuDung_NguyenLieu_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`;

        // Xuất file
        XLSX.writeFile(wb, fileName);

        // Hiển thị toast thành công
        showToast('success', `Đã xuất ${filteredHistory.length} bản ghi ra Excel!`);

        // Hiển thị trạng thái thành công
        statusEl.textContent = `✅ Đã xuất ${filteredHistory.length} bản ghi ra file: ${fileName}`;
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    } catch (error) {
        statusEl.textContent = '❌ Lỗi khi xuất file Excel!';
        console.error('Export error:', error);
        showToast('danger', 'Lỗi khi xuất file Excel!');
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }
}

// ===== FORM HANDLING =====
function handleTankFormSubmit(e) {
    e.preventDefault();

    const currentMassInput = parseFloat(document.getElementById('currentMassInput').value);
    const warningThreshold = parseFloat(document.getElementById('warningThreshold').value);

    // Chuyển từ kg sang g (1000g = 1kg) để lưu trữ
    const currentMassInputG = currentMassInput * 1000;
    const warningThresholdG = warningThreshold * 1000;

    const now = new Date().toISOString();

    if (editingTankId !== null) {
        // Chỉnh sửa bồn
        const tank = tanks.find(t => t.id === editingTankId);
        if (tank) {
            tank.warningThreshold = warningThresholdG;
            // Cập nhật: initialMass = currentMass + usedMass (giữ nguyên khối lượng đã dùng cũ)
            tank.initialMass = currentMassInputG + getUsedMass(tank);
            // Tính lại currentVolume dựa trên currentMass và density
            tank.currentVolume = tank.density > 0 ? currentMassInputG / tank.density : 0;
            tank.lastUpdated = now;
        }
        editingTankId = null;
        document.getElementById('formSection').style.display = 'none';
        showToast('success', 'Đã cập nhật thông tin bồn thành công!');
    }

    saveTanks();
    resetForm();
    updateAll();
}

function editTank(id) {
    const tank = tanks.find(t => t.id === id);
    if (!tank) return;

    editingTankId = id;
    document.getElementById('tankId').value = tank.id;
    document.getElementById('tankName').value = tank.name;
    document.getElementById('capacity').value = tank.capacity;
    document.getElementById('currentVolume').value = tank.currentVolume;
    document.getElementById('density').value = tank.density;
    document.getElementById('currentMassInput').value = formatMassKg(getCurrentMass(tank));
    document.getElementById('warningThreshold').value = formatMassKg(tank.warningThreshold);

    // Tiêu đề form hiển thị tên bồn
    document.getElementById('formTitle').textContent = `✏️ Chỉnh sửa: ${tank.name}`;
    document.getElementById('formSection').style.display = 'flex';
}

function closeEditModal() {
    editingTankId = null;
    resetForm();
    document.getElementById('formSection').style.display = 'none';
}

async function deleteTank(id) {
    const confirmed = await showConfirm('danger', 'Xác nhận xóa', 'Bạn có chắc chắn muốn xóa bồn này? Hành động này không thể hoàn tác.', 'Xóa', 'Hủy', true);
    if (!confirmed) return;

    tanks = tanks.filter(t => t.id !== id);
    saveTanks();
    updateAll();
    showToast('success', 'Đã xóa bồn thành công!');
}

function resetForm() {
    document.getElementById('tankForm').reset();
    document.getElementById('tankId').value = '';
    document.getElementById('density').value = '1';
    document.getElementById('warningThreshold').value = '0.2';
}

// ===== USAGE MODAL =====
function openUsageModal(id) {
    const tank = tanks.find(t => t.id === id);
    if (!tank) return;

    const currentMass = getCurrentMass(tank);

    document.getElementById('usageTankId').value = id;
    document.getElementById('modalTankInfo').innerHTML = `
        <strong>Bồn:</strong> ${tank.name}<br>
        <strong>Khối lượng hiện tại:</strong> ${formatMassKg(currentMass)} kg<br>
        <strong>Thể tích hiện tại:</strong> ${formatNumber(tank.currentVolume)} L
    `;
    document.getElementById('usageAmount').value = '';
    document.getElementById('usageModal').style.display = 'flex';
}

function closeUsageModal() {
    document.getElementById('usageModal').style.display = 'none';
}

async function handleUsageSubmit(e) {
    e.preventDefault();

    const tankId = parseInt(document.getElementById('usageTankId').value);
    const usedAmountKg = parseFloat(document.getElementById('usageAmount').value);

    const tank = tanks.find(t => t.id === tankId);
    if (!tank) return;

    // Chuyển từ kg sang g (1000g = 1kg) để tính toán
    const usedAmount = usedAmountKg * 1000;

    const currentMass = getCurrentMass(tank);
    if (usedAmount > currentMass) {
        await showNotif('danger', 'Lỗi nhập liệu', `Khối lượng sử dụng (<strong>${formatMassKg(usedAmount)}kg</strong>) vượt quá khối lượng hiện có trong bồn (<strong>${formatMassKg(currentMass)}kg</strong>)!`);
        return;
    }

    // Tính khối lượng sẽ còn lại SAU khi trừ (chưa lưu)
    const remainingAfter = currentMass - usedAmount;
    const willBeEmpty = remainingAfter <= 0;
    const willBeWarning = remainingAfter <= tank.warningThreshold;

    // Xác nhận trước khi lưu nếu sẽ cảnh báo hoặc hết
    if (willBeEmpty) {
        const confirmEmpty = await showConfirm(
            'danger',
            'Cảnh báo hết nguyên liệu',
            `Nếu sử dụng <strong>${formatMassKg(usedAmount)}kg</strong>, bồn <strong>${tank.name}</strong> sẽ <strong>HẾT nguyên liệu</strong> (còn ${formatMassKg(remainingAfter)}kg)!<br><br>Bấm <strong>Xác nhận</strong> để tiếp tục, hoặc <strong>Hủy</strong> để không cập nhật.`,
            'Xác nhận',
            'Hủy',
            true
        );
        if (!confirmEmpty) {
            return; // Không lưu nếu người dùng bấm Hủy
        }
    } else if (willBeWarning) {
        const confirmWarning = await showConfirm(
            'warning',
            'Cảnh báo sắp hết',
            `Nếu sử dụng <strong>${formatMassKg(usedAmount)}kg</strong>, bồn <strong>${tank.name}</strong> sẽ <strong>sắp hết nguyên liệu</strong> (còn ${formatMassKg(remainingAfter)}kg ≤ ${formatMassKg(tank.warningThreshold)}kg)!<br><br>Bấm <strong>Xác nhận</strong> để tiếp tục, hoặc <strong>Hủy</strong> để không cập nhật.`,
            'Xác nhận',
            'Hủy'
        );
        if (!confirmWarning) {
            return; // Không lưu nếu người dùng bấm Hủy
        }
    }

    // Áp dụng cập nhật
    const volumeToSubtract = usedAmount / tank.density;
    tank.currentVolume = Math.max(0, tank.currentVolume - volumeToSubtract);
    tank.lastUpdated = new Date().toISOString();

    // Thêm vào lịch sử
    const newHistoryRecord = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        tankName: tank.name,
        material: "",
        usedMass: usedAmount,
        remainingMass: getCurrentMass(tank)
    };
    history.push(newHistoryRecord);

    saveTanks();
    saveHistory();
    closeUsageModal();
    updateAll();
    showToast('success', `Đã cập nhật sử dụng ${formatMassKg(usedAmount)}kg cho bồn ${tank.name}`);
}

// ===== CLEAR HISTORY =====
async function clearHistory() {
    const confirmed = await showConfirm('danger', 'Xác nhận xóa lịch sử', 'Bạn có chắc chắn muốn xóa <strong>toàn bộ lịch sử</strong> sử dụng nguyên liệu? Hành động này không thể hoàn tác.', 'Xóa tất cả', 'Hủy', true);
    if (!confirmed) return;
    history = [];
    saveHistory();
    renderHistoryTable();
    showToast('success', 'Đã xóa toàn bộ lịch sử!');
}

// ===== FILTER MODAL =====
function openFilterModal() {
    document.getElementById('filterModal').style.display = 'flex';
}

function closeFilterModal() {
    document.getElementById('filterModal').style.display = 'none';
}

function applyFilter() {
    currentFilter.name = document.getElementById('filterName').value.trim();
    // Chuyển từ kg sang g (1000g = 1kg) để so sánh với dữ liệu lưu trữ
    currentFilter.currentMass = (parseFloat(document.getElementById('filterCurrentMass').value) || 0) * 1000;
    currentFilter.usedMass = (parseFloat(document.getElementById('filterUsedMass').value) || 0) * 1000;
    currentFilter.status = document.getElementById('filterStatus').value;
    closeFilterModal();
    renderTanksTable();
    showToast('info', 'Đã áp dụng bộ lọc!');
}

function clearFilter() {
    currentFilter = { name: '', currentMass: 0, usedMass: 0, status: '' };
    document.getElementById('filterName').value = '';
    document.getElementById('filterCurrentMass').value = '';
    document.getElementById('filterUsedMass').value = '';
    document.getElementById('filterStatus').value = '';
    closeFilterModal();
    renderTanksTable();
    showToast('info', 'Đã xóa bộ lọc!');
}

// ===== UPDATE ALL =====
function updateAll() {
    updateSummaryCards();
    updateWarningBanner();
    renderTanksTable();
    renderHistoryTable();
}

// ===== INITIALIZATION =====
function init() {
    // Cập nhật thời gian
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Form submit
    document.getElementById('tankForm').addEventListener('submit', handleTankFormSubmit);
    document.getElementById('usageForm').addEventListener('submit', handleUsageSubmit);

    // Nút hủy
    document.getElementById('cancelBtn').addEventListener('click', closeEditModal);

    // Click ngoài modal edit để đóng
    document.getElementById('formSection').addEventListener('click', (e) => {
        if (e.target.id === 'formSection') {
            closeEditModal();
        }
    });

    // Đóng modal usage
    document.getElementById('closeModalBtn').addEventListener('click', closeUsageModal);

    // Click ngoài modal usage để đóng
    document.getElementById('usageModal').addEventListener('click', (e) => {
        if (e.target.id === 'usageModal') {
            closeUsageModal();
        }
    });

    // Đóng modal filter
    document.getElementById('closeFilterBtn').addEventListener('click', closeFilterModal);

    // Click ngoài modal filter để đóng
    document.getElementById('filterModal').addEventListener('click', (e) => {
        if (e.target.id === 'filterModal') {
            closeFilterModal();
        }
    });

    // Lọc lịch sử theo ngày khi thay đổi date input
    document.getElementById('historyFromDate').addEventListener('change', renderHistoryTable);
    document.getElementById('historyToDate').addEventListener('change', renderHistoryTable);

    // Xóa lịch sử
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    // Render dữ liệu ban đầu
    updateAll();
}

// Khởi chạy khi trang đã tải
document.addEventListener('DOMContentLoaded', init);