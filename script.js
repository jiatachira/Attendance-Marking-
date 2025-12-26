// ==========================================
// CONFIGURATION
// ==========================================
// REPLACE THIS URL WITH YOUR NEW DEPLOYMENT URL
const API_URL = "https://script.google.com/macros/s/AKfycbwomYJlinNSHS4ygVErqmnWFTxLpkUFkouWIqt0P0Ds07fg7geh3ls2wz_5ubuBRV5q/exec";

/**
 * Main Logic for Student Portal
 */
async function handleAttendance(event) {
    event.preventDefault();

    const nicInput = document.getElementById('nic');
    const nic = nicInput.value.trim();
    const btn = event.target.querySelector('button');
    const statusDiv = document.getElementById('status-message');

    if (!nic) return;

    // UI: Loading State
    btn.disabled = true;
    btn.innerHTML = '<div class="loader" style="width:20px; height:20px; border-width:2px;"></div>';
    statusDiv.className = 'hidden';

    try {
        if (API_URL.includes("INSERT_YOUR")) {
            throw new Error("System Setup Incomplete: Please update the API_URL in script.js");
        }

        // Prepare request
        // We assume the backend handles 'action=mark' or similar logic, 
        // OR simply takes the data and processes it.
        // Based on prompt: "Matches Student Intake... with scheduled class".
        // We send NIC. The backend checks everything.

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'markAttendance',
                nic: nic,
                timestamp: new Date().toISOString()
            })
        });

        // Apps Script often redirects or returns JSON. 
        // We need to handle text/json response.
        const result = await response.json();

        if (result.status === 'success') {
            showStatus('Attendance Marked Successfully!', 'success');
            nicInput.value = ''; // Clear input
        } else {
            // Handle specific errors like "Duplicate", "No Class Found", "Invalid NIC"
            showStatus(result.message || 'Failed to mark attendance.', 'error');
        }

    } catch (error) {
        console.error("Attendance Error:", error);
        showStatus(error.message || 'Network Error. Please try again.', 'error');
    } finally {
        // UI: Reset
        btn.disabled = false;
        btn.innerHTML = '<span>Mark Attendance</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    }
}

function showStatus(msg, type) {
    const el = document.getElementById('status-message');
    el.textContent = msg;
    el.className = `status-message status-${type} fade-in`;
    el.classList.remove('hidden');
}

// Auto-focus input on load for speed
window.addEventListener('load', () => {
    document.getElementById('nic').focus();
});
