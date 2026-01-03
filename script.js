// ==========================================
// CONFIGURATION
// ==========================================
// REPLACE THIS URL WITH YOUR NEW DEPLOYMENT URL
const API_URL = "https://script.google.com/macros/s/AKfycbxUv_0unVvqLPSHVsdA7XJ0RisLiaPvges4qoYC8Bi2RopSMR0mRLNiKGxbAQn3loVk/exec";

/**
 * Main Logic for Student Portal
 */
async function searchClasses(event) {
    event.preventDefault();

    const nicInput = document.getElementById('nic');
    const nic = nicInput.value.trim();
    const btn = event.target.querySelector('button');
    const statusDiv = document.getElementById('status-message');
    const container = document.getElementById('classes-container');

    if (!nic) return;

    // Reset UI
    container.innerHTML = '';
    statusDiv.className = 'hidden';

    // UI: Loading State
    btn.disabled = true;
    const originalBtnContent = btn.innerHTML;
    btn.innerHTML = '<div class="loader" style="width:20px; height:20px; border-width:2px;"></div>';

    try {
        if (API_URL.includes("INSERT_YOUR")) {
            throw new Error("System Setup Incomplete: Please update the API_URL in script.js");
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: "follow",
            body: JSON.stringify({
                action: 'getStudentClasses',
                nic: nic
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            if (result.data.length === 0) {
                showStatus('No classes found for you today.', 'error');
            } else {
                renderClasses(result.data, nic);
            }
        } else {
            showStatus(result.message || 'Failed to search classes.', 'error');
        }

    } catch (error) {
        console.error("Search Error:", error);
        showStatus(error.message || 'Network Error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}

function renderClasses(classes, nic) {
    const container = document.getElementById('classes-container');

    classes.forEach(cls => {
        const card = document.createElement('div');
        // Styling matches glass-panel class but simpler for inner cards
        card.style.padding = "1.5rem";
        card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        card.style.background = "rgba(255, 255, 255, 0.03)";
        card.style.borderRadius = "12px";
        card.className = "fade-in";

        let actionBtn;
        let resourceBtn = '';

        // Prepare Resource Button HTML if link exists
        if (cls.resourceLink) {
            const link = cls.resourceLink;
            resourceBtn = `<a href="${link}" target="_blank" class="btn" style="width:100%; background: #3b82f6; border: none; margin-top: 10px; display: block; text-align: center; text-decoration: none; color: white;">View Resources</a>`;
        }

        if (cls.isMarked) {
            actionBtn = `<button disabled class="btn" style="width:100%; background: #10b981; color: white; border: none; cursor: default; opacity: 0.8;">Attendance Marked</button>`;
            // If marked and has resource, show resource button
            if (cls.resourceLink) {
                actionBtn += resourceBtn;
            }
        } else {
            // Pass resourceLink to the function safely
            const cleanLink = cls.resourceLink ? cls.resourceLink.replace(/'/g, "%27") : "";
            actionBtn = `<button onclick="markAttendance('${cls.id}', '${nic}', this, '${cleanLink}')" class="btn btn-primary" style="width:100%;">Mark Attendance</button>`;
        }

        card.innerHTML = `
            <div style="margin-bottom: 1rem; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h3 style="margin: 0; font-size: 1.25rem; color: #fff; font-weight: 600;">${cls.id}</h3>
                    <span style="font-size: 0.8rem; padding: 0.2rem 0.6rem; background: rgba(255,255,255,0.1); border-radius: 20px; color: #cbd5e1;">${cls.intake}</span>
                </div>
                <p style="margin: 0; color: #94a3b8; font-size: 0.9rem;">Date: ${cls.date}</p>
            </div>
            <div class="action-container">
                ${actionBtn}
            </div>
        `;
        container.appendChild(card);
    });
}

async function markAttendance(classId, nic, btn, resourceLink) {
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Processing...';

    const statusDiv = document.getElementById('status-message');
    statusDiv.className = 'hidden';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            redirect: "follow",
            body: JSON.stringify({
                action: 'markAttendance',
                nic: nic,
                classId: classId,
                timestamp: new Date().toISOString()
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            btn.innerHTML = 'Attendance Marked';
            btn.style.background = '#10b981';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.onclick = null; // Remove handler
            showStatus('Attendance marked successfully!', 'success');

            // Show resource button if link exists
            if (resourceLink) {
                const linkBtn = document.createElement('a');
                linkBtn.href = resourceLink;
                linkBtn.target = "_blank";
                linkBtn.className = "btn";
                linkBtn.style.width = "100%";
                linkBtn.style.background = "#3b82f6";
                linkBtn.style.color = "white";
                linkBtn.style.border = "none";
                linkBtn.style.marginTop = "10px";
                linkBtn.style.display = "block";
                linkBtn.style.textAlign = "center";
                linkBtn.style.textDecoration = "none";
                linkBtn.innerText = "View Resources";

                // Append after the attendance button. 
                // Note: btn is inside a div.action-container now because of my renderClasses change.
                btn.parentNode.appendChild(linkBtn);
            }

        } else {
            showStatus(result.message || 'Failed to mark attendance', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    } catch (e) {
        console.error(e);
        showStatus('Network error while marking attendance.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
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
