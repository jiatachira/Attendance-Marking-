// ==========================================
// CONFIGURATION
// ==========================================
// REPLACE THIS URL WITH YOUR NEW DEPLOYMENT URL
const API_URL = "https://script.google.com/macros/s/AKfycbyyizBQxnRRCS7UB4rJP2Vyw_WYefG0tyOIJlxjRmHHv6JIDXFz8G_kBnbNp0SZolVY/exec";

// State
let currentReportData = []; // Store for CSV export

// Login
async function handleLogin(event) {
    event.preventDefault();
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const errorMsg = document.getElementById('login-error');
    const btn = event.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Verifying...";
        errorMsg.classList.add('hidden');

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'adminLogin',
                username: user,
                password: pass
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            // Set today as default date
            document.getElementById('search-date').valueAsDate = new Date();
        } else {
            throw new Error('Invalid Credentials');
        }

    } catch (error) {
        console.error("Login Error:", error);
        errorMsg.textContent = error.message;
        errorMsg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = "Unlock System";
    }
}

// 1. Search Classes
async function searchClasses() {
    const dateInput = document.getElementById('search-date').value;
    if (!dateInput) return alert("Please select a date first.");

    const container = document.getElementById('classes-container');
    const section = document.getElementById('class-list-section');
    const msg = document.getElementById('no-classes-msg');

    // Reset UI
    container.innerHTML = '<div class="loader"></div>';
    section.classList.remove('hidden');
    msg.classList.add('hidden');
    document.getElementById('report-view').classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getClasses',
                date: dateInput
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            renderClassList(result.data, dateInput);
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error("Search Error:", error);
        container.innerHTML = `<p class="status-error">Error: ${error.message}</p>`;
    }
}

function renderClassList(classes, dateStr) {
    const container = document.getElementById('classes-container');
    const msg = document.getElementById('no-classes-msg');

    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        msg.classList.remove('hidden');
        return;
    }

    classes.forEach(cls => {
        const card = document.createElement('div');
        card.className = 'glass-panel stat-card fade-in';
        card.style.textAlign = 'left';
        card.style.cursor = 'default';

        card.innerHTML = `
            <h3 style="color: var(--primary-color); font-size: 1.25rem;">${cls.intake}</h3>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.5rem; margin-bottom: 1.5rem;">
                Class ID: <span style="font-family: monospace; color: white;">${cls.classId}</span>
            </p>
            <button onclick="viewReport('${dateStr}', '${cls.intake}', '${cls.classId}')" class="btn btn-primary" style="width: 100%; font-size: 0.875rem;">
                View Report
            </button>
        `;
        container.appendChild(card);
    });
}

// 2. View Report
async function viewReport(date, intake, classId) {
    // Scroll to report view
    const reportView = document.getElementById('report-view');
    const tbody = document.getElementById('report-body');
    const loading = document.getElementById('report-loading');
    const tableContainer = document.getElementById('report-table-container');

    reportView.classList.remove('hidden');
    loading.classList.remove('hidden');
    tableContainer.classList.add('hidden');

    // Set Header Info
    document.getElementById('report-title').textContent = `${intake} Attendance`;
    document.getElementById('report-subtitle').textContent = `Date: ${date} | Class ID: ${classId}`;

    // Clear old data
    tbody.innerHTML = '';
    currentReportData = [];

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getClassReport',
                date: date,
                intake: intake,
                classId: classId
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            currentReportData = result.data; // Save for CSV
            renderReportTable(result.data);
            loading.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            reportView.scrollIntoView({ behavior: 'smooth' });
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error("Report Error:", error);
        loading.innerHTML = `<p class="status-error">${error.message}</p>`;
    }
}

function renderReportTable(data) {
    const tbody = document.getElementById('report-body');
    const summary = document.getElementById('report-summary');

    let presentCount = 0;

    data.forEach(row => {
        const tr = document.createElement('tr');
        const isPresent = row.status === 'Present';
        if (isPresent) presentCount++;

        tr.innerHTML = `
            <td style="font-family: monospace;">${row.nic}</td>
            <td>${row.name}</td>
            <td><span class="status-pill ${isPresent ? 'status-present' : 'status-absent'}">${row.status}</span></td>
            <td>${row.time || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    summary.innerHTML = `Total Students: ${data.length} | <strong>Present: ${presentCount}</strong> | Absent: ${data.length - presentCount}`;
}

function closeReport() {
    document.getElementById('report-view').classList.add('hidden');
}

// 3. Export CSV
function exportCSV() {
    if (!currentReportData || currentReportData.length === 0) return alert("No data to export.");

    const headers = ["NIC", "Name", "Status", "Time"];
    const rows = currentReportData.map(d => [d.nic, d.name, d.status, d.time]);

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\r\n";
    rows.forEach(r => {
        csvContent += r.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `attendance_report_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function logout() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('admin-user').value = '';
    document.getElementById('admin-pass').value = '';
}
