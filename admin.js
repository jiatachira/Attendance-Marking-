// ==========================================
// CONFIGURATION
// ==========================================
// REPLACE THIS URL WITH YOUR NEW DEPLOYMENT URL
const API_URL = "https://script.google.com/macros/s/AKfycbxUv_0unVvqLPSHVsdA7XJ0RisLiaPvges4qoYC8Bi2RopSMR0mRLNiKGxbAQn3loVk/exec";

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

            // Initial Load
            loadDashboard();
            switchSection('home');
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
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 2rem;">No inactive students found. Great job!</td></tr>';
            } else {
                inactive.forEach(s => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-family: monospace;">${s.nic}</td>
                        <td>${s.name}</td>
                        <td>${s.intake}</td>
                        <td><span class="status-pill status-absent">${s.absentCount} Classes</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }

        }
    } catch (err) {
        console.error("Dashboard Load Error", err);
    }
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

        card.innerHTML = `
            <h3 style="color: var(--primary-color); font-size: 1.1rem;">${stu.name}</h3>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.25rem;">NIC: <span style="font-family: monospace; color: white;">${stu.nic}</span></p>
            <p style="color: #94a3b8; font-size: 0.8rem; margin-bottom: 1rem;">Intake: ${stu.intake}</p>
            <button onclick="viewStudentHistory('${stu.nic}')" class="btn btn-primary" style="width: 100%; font-size: 0.875rem;">
                View History
            </button>
        `;
        container.appendChild(card);
    });
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
                const isActive = s.status === 'Active';
                tr.innerHTML = `
                    <td style="font-family: monospace;">${s.nic}</td>
                    <td>${s.name}</td>
                    <td><span class="status-pill ${isActive ? 'status-present' : 'status-absent'}">${s.status}</span></td>
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
