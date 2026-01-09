// ==========================================
// CONFIGURATION
// ==========================================
// REPLACE THIS URL WITH YOUR NEW DEPLOYMENT URL
const API_URL = "https://script.google.com/macros/s/AKfycbzIWLul3R9lFieZ7AfXgOHhxUyeO_5TNf53HEA9I2-qsJ_gP8BZ8KTvqRkWitAGQ1YI/exec";

// State
let currentReportData = []; // Store for CSV export

// SESSION MGMT
let sessionToken = localStorage.getItem('sessionToken');
let sessionTimeout;

window.onload = function () {
    checkSessionOnLoad();
    startIdleTimer();
};

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
            // Save Session
            sessionToken = result.token;
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('adminUser', result.username);

            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');

            // Initial Load
            loadDashboard();
            switchSection('home');
            startIdleTimer();
        } else {
            throw new Error(result.message || 'Invalid Credentials');
        }

    } catch (error) {
        console.error("Login Error:", error);
        errorMsg.textContent = error.message || "Connection Failed";
        errorMsg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = "Unlock System";
    }
}

async function checkSessionOnLoad() {
    const storedToken = localStorage.getItem('sessionToken');

    if (storedToken) {
        // Optimistic Load
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadDashboard();
        switchSection('home');

        // Verify
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'verifySession', token: storedToken })
            });
            const result = await response.json();
            if (result.status !== 'success') {
                logout();
            }
        } catch (e) { console.log('Offline/Error check'); }
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
}

function logout() {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('adminUser');
    location.reload();
}

// IDLE TIMER
function startIdleTimer() {
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    resetTimer();
}

function resetTimer() {
    clearTimeout(sessionTimeout);
    if (localStorage.getItem('sessionToken')) {
        // 10 Mins = 600000 ms
        sessionTimeout = setTimeout(lockScreen, 600000);
    }
}

function lockScreen() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-error').textContent = "Session Timed Out. Please login again.";
    document.getElementById('login-error').classList.remove('hidden');
    // We don't clear token immediately, but handleLogin will overwrite it. 
    // Or we force fully clear:
    // localStorage.removeItem('sessionToken'); 
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
    currentReportMeta = { date, intake, classId }; // Saving meta for emails

    // Reset Email Composer
    document.getElementById('email-composer').classList.add('hidden');
    document.getElementById('email-body').value = '';
    document.getElementById('email-status').classList.add('hidden');

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

        // Account Status Badge
        let accStatus = row.accountStatus || 'Active';
        let accBadgeClass = 'status-present';
        if (accStatus.toLowerCase() === 'postpond') accBadgeClass = 'status-absent';
        if (accStatus.toLowerCase() === 'reject') accBadgeClass = 'status-error';

        tr.innerHTML = `
            <td style="font-family: monospace;">${row.nic}</td>
            <td>${row.name}</td>
            <td><span class="status-pill ${accBadgeClass}" style="font-size: 0.75rem;">${accStatus}</span></td>
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

// 4. Tab Switching
// 4. Navigation & Dashboard Logic
function switchSection(sectionId) {
    // CONTENT
    document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`section-${sectionId}`).classList.remove('hidden');

    // SIDEBAR
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${sectionId}`).classList.add('active');
}

// 5. Dashboard Data
async function loadDashboard() {
    // Set Date
    const today = new Date();
    document.getElementById('lbl-today-date').textContent = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('search-date').valueAsDate = today; // Pre-fill search

    // Load Intakes for Report Dropdown
    loadIntakes();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getDashboardData' })
        });
        const result = await response.json();

        if (result.status === 'success') {
            const { stats, chart, inactive } = result.data;

            // Stats
            document.getElementById('stat-total-students').textContent = stats.totalStudents;
            document.getElementById('stat-today-classes').textContent = stats.todayDate === stats.stats?.todayDate ? stats.todayClassesCount || 0 : "N/A";
            document.getElementById('stat-inactive').textContent = stats.inactiveCount;

            // Render Chart
            renderChart(chart.labels, chart.data);

            // Render Inactive Table
            const tbody = document.getElementById('inactive-table-body');
            tbody.innerHTML = '';
            if (inactive.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding: 2rem;">No inactive students found. Great job!</td></tr>';
            } else {
                inactive.forEach(s => {
                    const tr = document.createElement('tr');

                    const status = s.status || 'Active';
                    const isSel = (v) => (status.toLowerCase() === v.toLowerCase() ? 'selected' : '');

                    // Escape for Safety
                    const safeNic = String(s.nic).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const safeName = String(s.name).replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');

                    tr.innerHTML = `
                        <td style="font-family: monospace;">${s.nic}</td>
                        <td>
                            <div>${s.name}</div>
                            <small style="color:#94a3b8;">${s.intake}</small>
                        </td>
                        <td>${s.phone || 'N/A'}</td>
                        <td>
                           <div style="display: flex; gap: 0.25rem;">
                               <select id="status-dash-${safeNic}" class="search-input" style="padding: 0.2rem; font-size: 0.8rem; width: auto;">
                                    <option value="Active" ${isSel('Active')}>Active</option>
                                    <option value="Postpond" ${isSel('Postpond')}>Postpond</option>
                                    <option value="Reject" ${isSel('Reject')}>Reject</option>
                               </select>
                               <button onclick="saveDashStatus('${safeNic}')" class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Save</button>
                           </div>
                        </td>
                        <td style="max-width: 150px; font-size: 0.85rem; color: #cbd5e1;">${s.lastComment || 'Not Called'}</td>
                        <td>
                            <button onclick="openAddComment('${safeNic}', '${safeName}')" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                                Add Comment
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

        }
    } catch (err) {
        console.error("Dashboard Load Error", err);
    }
}

async function saveDashStatus(nic) {
    const select = document.getElementById(`status-dash-${nic}`);
    const newStatus = select.value;
    const btn = select.nextElementSibling;

    // UI Feedback
    const originalText = btn.textContent;
    btn.textContent = "...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateStudentStatus',
                nic: nic,
                status: newStatus
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert(`Success: ${result.message}`);
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to update status.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 6. COMMENTS LOGIC
let currentCommentNic = null;

async function openAddComment(nic, name) {
    currentCommentNic = nic;
    document.getElementById('comment-student-info').textContent = `${name} (${nic})`;
    document.getElementById('new-comment-text').value = '';

    const historyList = document.getElementById('add-comment-history-list');
    historyList.innerHTML = '<div class="loader-sm" style="margin: 1rem auto;"></div>'; // Simple loader

    document.getElementById('add-comment-modal').classList.remove('hidden');

    // Fetch History
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getCallHistory',
                nic: nic
            })
        });
        const result = await response.json();

        historyList.innerHTML = '';
        if (result.status === 'success' && result.data.length > 0) {
            result.data.forEach(c => {
                // Format Time
                let displayTime = c.time;
                try {
                    let dateObj;
                    if (String(c.time).includes('T') || c.time instanceof Date) {
                        dateObj = new Date(c.time);
                    } else {
                        // Assume HH:MM string
                        const parts = String(c.time).split(':');
                        if (parts.length >= 2) {
                            dateObj = new Date();
                            dateObj.setHours(parseInt(parts[0]));
                            dateObj.setMinutes(parseInt(parts[1]));
                        }
                    }

                    if (dateObj) {
                        let h = dateObj.getHours();
                        let m = dateObj.getMinutes();
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        h = h % 12;
                        h = h ? h : 12;
                        const hh = h < 10 ? '0' + h : h;
                        const mm = m < 10 ? '0' + m : m;
                        displayTime = `${hh}.${mm} ${ampm}`;
                    }
                } catch (e) { displayTime = c.time; }

                const displayDate = c.date ? String(c.date).split('T')[0] : '';

                const div = document.createElement('div');
                div.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
                div.style.padding = "0.5rem 0";
                div.innerHTML = `
                    <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.1rem;">${displayDate} &bull; ${displayTime}</div>
                    <div style="font-size: 0.85rem; color: #cbd5e1;">${c.comment}</div>
                `;
                historyList.appendChild(div);
            });
        } else {
            historyList.innerHTML = '<p style="text-align:center; color:#64748b; padding: 1rem; font-size: 0.8rem;">No previous comments.</p>';
        }

    } catch (e) {
        console.error(e);
        historyList.innerHTML = '<p style="text-align:center; color:#ef4444; font-size: 0.8rem;">Failed to load history.</p>';
    }
}

function closeAddComment() {
    document.getElementById('add-comment-modal').classList.add('hidden');
    currentCommentNic = null;
}

async function saveCheckComment() {
    const comment = document.getElementById('new-comment-text').value;
    if (!comment) return alert("Please enter a comment.");

    // UI Feedback is tricky without a specific button reference or status div in modal, 
    // let's use generic Loading or just alert for now.

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveCallComment',
                nic: currentCommentNic,
                comment: comment
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            alert("Comment Saved");
            closeAddComment();
            loadDashboard(); // Reload to update "Last Comment"
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Network Error");
    }
}

async function viewStudentComments(nic) {
    const modal = document.getElementById('view-comments-modal');
    const container = document.getElementById('comments-list-container');
    const info = document.getElementById('view-comments-info');

    modal.classList.remove('hidden');
    container.innerHTML = '<div class="loader"></div>';
    info.textContent = `NIC: ${nic}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getCallHistory',
                nic: nic
            })
        });
        const result = await response.json();

        container.innerHTML = '';
        if (result.status === 'success') {
            if (result.data.length === 0) {
                container.innerHTML = '<p style="text-align:center; color:#94a3b8;">No comments found.</p>';
            } else {
                result.data.forEach(c => {
                    // Format Time
                    let displayTime = c.time;
                    try {
                        let dateObj;
                        if (String(c.time).includes('T') || c.time instanceof Date) {
                            dateObj = new Date(c.time);
                        } else {
                            // Assume HH:MM string
                            const parts = String(c.time).split(':');
                            if (parts.length >= 2) {
                                dateObj = new Date();
                                dateObj.setHours(parseInt(parts[0]));
                                dateObj.setMinutes(parseInt(parts[1]));
                            }
                        }

                        if (dateObj) {
                            let h = dateObj.getHours();
                            let m = dateObj.getMinutes();
                            const ampm = h >= 12 ? 'PM' : 'AM';
                            h = h % 12;
                            h = h ? h : 12;
                            const hh = h < 10 ? '0' + h : h;
                            const mm = m < 10 ? '0' + m : m;
                            displayTime = `${hh}.${mm} ${ampm}`;
                        }
                    } catch (e) {
                        displayTime = c.time; // Fallback
                    }

                    const displayDate = c.date ? String(c.date).split('T')[0] : '';

                    const el = document.createElement('div');
                    el.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
                    el.style.padding = "0.75rem 0";
                    el.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom: 0.25rem;">
                            <span style="font-size: 0.8rem; color: #94a3b8;">${displayDate} &nbsp; ${displayTime}</span>
                        </div>
                        <p style="color: #e2e8f0; font-size: 0.9rem;">${c.comment}</p>
                    `;
                    container.appendChild(el);
                });
            }
        } else {
            container.innerHTML = `<p class="status-error">${result.message}</p>`;
        }

    } catch (e) {
        container.innerHTML = '<p class="status-error">Failed to load history.</p>';
    }
}

function closeViewComments() {
    document.getElementById('view-comments-modal').classList.add('hidden');
}

let dashboardChart = null;
function renderChart(labels, data) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');

    // Destroy if exists to prevent duplication on re-login
    if (dashboardChart) dashboardChart.destroy();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Student Attendance',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#8b5cf6',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#e2e8f0',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// 6. Student Search
async function searchStudent() {
    const query = document.getElementById('search-student-query').value;
    if (!query) return alert("Please enter a name or NIC.");

    const container = document.getElementById('student-list-container');
    const section = document.getElementById('student-results-section');
    const historyView = document.getElementById('student-history-view');

    container.innerHTML = '<div class="loader"></div>';
    section.classList.remove('hidden');
    historyView.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'searchStudents',
                query: query
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            renderStudentList(result.data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Student Search Error:", error);
        container.innerHTML = `<p class="status-error">Error: ${error.message}</p>`;
    }
}

function renderStudentList(students) {
    const container = document.getElementById('student-list-container');
    container.innerHTML = '';

    if (!students || students.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; col-span: 3;">No students found.</p>';
        return;
    }

    students.forEach(stu => {
        const card = document.createElement('div');
        card.className = 'glass-panel stat-card fade-in';
        card.style.textAlign = 'left';

        // Status Logic
        const status = stu.status || 'Active'; // Default if missing
        const isSelected = (val) => status.toLowerCase() === val.toLowerCase() ? 'selected' : '';

        // Badge Color
        let badgeClass = 'status-present'; // Green
        if (status.toLowerCase() === 'postpond') badgeClass = 'status-absent'; // Red/Orange (using absent style for now)
        if (status.toLowerCase() === 'reject') badgeClass = 'status-error';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <h3 style="color: var(--primary-color); font-size: 1.1rem; margin: 0;">${stu.name}</h3>
                <span class="status-pill ${badgeClass}" style="font-size: 0.7rem; text-transform: uppercase;">${status}</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; margin-bottom: 1rem;">
                <p style="color: #94a3b8; font-size: 0.85rem;">NIC: <span style="font-family: monospace; color: white;">${stu.nic}</span></p>
                <p style="color: #94a3b8; font-size: 0.85rem;">Intake: <span style="color: white;">${stu.intake}</span></p>
                <p style="color: #94a3b8; font-size: 0.85rem;">📞: <span style="color: white;">${stu.phone || 'N/A'}</span></p>
                <p style="color: #94a3b8; font-size: 0.85rem;">📧: <span style="color: white;">${stu.email || 'N/A'}</span></p>
            </div>
            
            <div style="margin-bottom: 1rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.25rem;">Change Status</label>
                <div style="display: flex; gap: 0.5rem;">
                    <select id="status-select-${stu.nic}" class="search-input" style="padding: 0.25rem; font-size: 0.85rem; height: auto;">
                        <option value="Active" ${isSelected('Active')}>Active</option>
                        <option value="Postpond" ${isSelected('Postpond')}>Postpond</option>
                        <option value="Reject" ${isSelected('Reject')}>Reject</option>
                    </select>
                    <button onclick="updateStatus('${stu.nic}')" class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">
                        Save
                    </button>
                </div>
            </div>

            <button onclick="viewStudentHistory('${stu.nic}')" class="btn btn-secondary" style="width: 100%; font-size: 0.875rem; margin-bottom: 0.5rem;">
                View History
            </button>
            <button onclick="viewStudentComments('${stu.nic}')" class="btn btn-secondary" style="width: 100%; font-size: 0.875rem;">
                View Comments
            </button>
        `;
        container.appendChild(card);
    });
}

async function updateStatus(nic) {
    const select = document.getElementById(`status-select-${nic}`);
    const newStatus = select.value;
    const btn = select.nextElementSibling;

    // UI Feedback
    const originalText = btn.textContent;
    btn.textContent = "...";
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateStudentStatus',
                nic: nic,
                status: newStatus
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert(`Success: ${result.message}`);
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to update status.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 6. View Student History
async function viewStudentHistory(nic) {
    const historyView = document.getElementById('student-history-view');
    const tbody = document.getElementById('history-body');
    const loading = document.getElementById('history-loading');
    const tableContainer = document.getElementById('history-table-container');

    historyView.classList.remove('hidden');
    loading.classList.remove('hidden');
    tableContainer.classList.add('hidden');
    tbody.innerHTML = ''; // Clear old

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getStudentHistory',
                nic: nic
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            const { student, history } = result.data;
            document.getElementById('history-student-name').textContent = student.name;
            document.getElementById('history-student-nic').textContent = `NIC: ${student.nic} | Intake: ${student.intake}`;

            renderStudentHistory(history);

            loading.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            historyView.scrollIntoView({ behavior: 'smooth' });
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("History Error:", error);
        loading.innerHTML = `<p class="status-error">${error.message}</p>`;
    }
}

function renderStudentHistory(history) {
    const tbody = document.getElementById('history-body');

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No class history found.</td></tr>';
        return;
    }

    history.forEach(row => {
        const tr = document.createElement('tr');
        const isPresent = row.status === 'Present';

        tr.innerHTML = `
            <td>${row.date}</td>
            <td>${row.className}</td>
            <td><span class="status-pill ${isPresent ? 'status-present' : 'status-absent'}">${row.status}</span></td>
            <td>${row.time}</td>
        `;
        tbody.appendChild(tr);
    });
}

function closeStudentHistory() {
    document.getElementById('student-history-view').classList.add('hidden');
}


// 7. Intake Report
async function generateIntakeReport() {
    const intake = document.getElementById('report-intake-select').value;
    if (!intake) return alert("Please select an intake/batch code.");

    const container = document.getElementById('intake-report-container');
    const loading = document.getElementById('intake-report-loading');
    const tbody = document.getElementById('intake-report-body');
    const title = document.getElementById('intake-report-title');

    container.classList.remove('hidden');
    loading.classList.remove('hidden');
    tbody.innerHTML = '';
    title.textContent = `Report: ${intake}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getIntakeReport',
                intake: intake
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            loading.classList.add('hidden');
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No students found for this intake.</td></tr>';
                return;
            }

            result.data.forEach(s => {
                const tr = document.createElement('tr');

                let badgeClass = 'status-present'; // Default Green (Active)
                const lowerStatus = s.status.toLowerCase();

                if (lowerStatus === 'continuous absence') badgeClass = 'status-error'; // Red
                else if (lowerStatus === 'reject') badgeClass = 'status-error';
                else if (lowerStatus === 'postpond') badgeClass = 'status-absent'; // Orange

                tr.innerHTML = `
                    <td style="font-family: monospace;">${s.nic}</td>
                    <td>${s.name}</td>
                    <td><span class="status-pill ${badgeClass}">${s.status}</span></td>
                    <td style="text-align: center;">${s.absences}</td>
                `;
                tbody.appendChild(tr);
            });

            // Scroll
            container.scrollIntoView({ behavior: 'smooth' });

        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        console.error("Intake Report Error", err);
        loading.innerHTML = `<p class="status-error">${err.message}</p>`;
    }
}

function closeIntakeReport() {
    document.getElementById('intake-report-container').classList.add('hidden');
    document.getElementById('report-intake-select').value = '';
}

async function loadIntakes() {
    const select = document.getElementById('report-intake-select');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUniqueIntakes' })
        });
        const result = await response.json();

        if (result.status === 'success') {
            // Clear existing options except first
            select.innerHTML = '<option value="" disabled selected>Select an Intake</option>';

            result.data.forEach(intake => {
                const opt = document.createElement('option');
                opt.value = intake;
                opt.textContent = intake;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Failed to load intakes", e);
    }
}

function logout() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('admin-user').value = '';
    document.getElementById('admin-pass').value = '';
}

// ==========================================
// PASSWORD RESET UI
// ==========================================

function showForgotPassword() {
    document.getElementById('forgot-password-overlay').classList.remove('hidden');
    document.getElementById('reset-step-1').classList.remove('hidden');
    document.getElementById('reset-step-2').classList.add('hidden');
    document.getElementById('reset-step-3').classList.add('hidden');
    document.getElementById('reset-msg').classList.add('hidden');
    document.getElementById('reset-step-desc').textContent = "Enter your username";
}

function closeForgotPassword() {
    document.getElementById('forgot-password-overlay').classList.add('hidden');
}

async function sendResetCode() {
    const user = document.getElementById('reset-username').value;
    const msg = document.getElementById('reset-msg');

    if (!user) return alert("Please enter username");
    msg.textContent = "Sending code...";
    msg.className = "status-message status-present"; // Yellowish/Blueish
    msg.classList.remove('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'sendAdminOTP', username: user })
        });
        const result = await response.json();

        if (result.status === 'success') {
            msg.textContent = result.message;
            msg.className = "status-message status-present";

            // Move to Step 2
            document.getElementById('reset-step-1').classList.add('hidden');
            document.getElementById('reset-step-2').classList.remove('hidden');
            document.getElementById('reset-step-desc').textContent = "Verify the code sent to your email";
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        msg.textContent = e.message;
        msg.className = "status-message status-error";
        msg.classList.remove('hidden');
    }
}

async function verifyResetCode() {
    const user = document.getElementById('reset-username').value;
    const otp = document.getElementById('reset-otp').value;
    const msg = document.getElementById('reset-msg');

    if (!otp) return alert("Enter code");
    msg.textContent = "Verifying...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'verifyResetOTP', username: user, otp: otp })
        });
        const result = await response.json();

        if (result.status === 'success') {
            msg.textContent = "Code Verified.";

            // Move to Step 3
            document.getElementById('reset-step-2').classList.add('hidden');
            document.getElementById('reset-step-3').classList.remove('hidden');
            document.getElementById('reset-step-desc').textContent = "Set a new password";
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        msg.textContent = e.message;
        msg.className = "status-message status-error";
    }
}

async function resetPassword() {
    const user = document.getElementById('reset-username').value;
    const otp = document.getElementById('reset-otp').value;
    const p1 = document.getElementById('reset-pass-new').value;
    const p2 = document.getElementById('reset-pass-confirm').value;
    const msg = document.getElementById('reset-msg');

    if (!p1 || !p2) return alert("Enter passwords");
    if (p1 !== p2) return alert("Passwords do not match");

    msg.textContent = "Updating password...";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'resetAdminPassword',
                username: user,
                otp: otp,
                newPassword: p1
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            alert("Password Reset Successful! Please login.");
            closeForgotPassword();
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        msg.textContent = e.message;
        msg.className = "status-message status-error";
    }
}

// 8. Send Emails to Absent Students
let currentReportMeta = null;

function toggleEmailComposer() {
    const el = document.getElementById('email-composer');
    el.classList.toggle('hidden');
}

async function sendAbsenteeEmails() {
    if (!currentReportMeta) return alert("Report context missing. Please reload report.");

    const body = document.getElementById('email-body').value;
    if (!body) return alert("Please enter a message.");

    const btn = document.getElementById('btn-send-email');
    const status = document.getElementById('email-status');

    btn.disabled = true;
    btn.textContent = "Sending...";
    status.textContent = "";
    status.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'sendAbsentEmails',
                date: currentReportMeta.date,
                intake: currentReportMeta.intake,
                classId: currentReportMeta.classId,
                message: body
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            status.textContent = result.message;
            status.className = "status-message status-present";
            status.classList.remove('hidden');
            document.getElementById('email-body').value = ''; // clear
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        console.error(e);
        status.textContent = "Error: " + e.message;
        status.className = "status-message status-error";
        status.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = "Send Emails";
    }
}
