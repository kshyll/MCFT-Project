function makeSafe(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

async function checkLogin() {
    const { data } = await db.auth.getSession();
    if (!data.session) {
        window.location.href = 'login.html';
        return null;
    }
    showText('user-name', data.session.user.email);
    return data.session;
}

function setupLogout() {
    const btn = document.getElementById('logout-button');
    if (btn) {
        btn.addEventListener('click', async () => {
            await db.auth.signOut();
            window.location.href = 'login.html';
        });
    }
}

let allEmployeesCache = [];
let selectedEmployeeId = null;

function getCertStatusBadge(cert) {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (cert.expires_on && cert.expires_on < today) {
        return '<span class="status expired-status">Expired</span>';
    }
    if (cert.expires_on && cert.expires_on <= in30) {
        return '<span class="status expiring-status">Expiring</span>';
    }
    return '<span class="status active-status">Active</span>';
}

async function loadDirectory() {
    const tbody = document.getElementById('emp-directory-rows');
    const search = document.getElementById('emp-page-search').value.trim();
    const department = document.getElementById('filter-dept').value;
    const status = document.getElementById('filter-status').value;

    try {
        const list = await api.getAllEmployees({ search, department, status });
        allEmployeesCache = list;

        // Update summary cards when viewing unfiltered list
        if (!search && !department && !status) {
            const active = list.filter(e => e.status === 'Active').length;
            showText('emp-total-count', list.length);
            showText('emp-active-count', active);
            showText('emp-inactive-count', list.length - active);
        }

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No matching employees found.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(emp => {
            const badgeClass = emp.status === 'Active' ? 'status active-status' : 'status inactive-status';
            const isSelected = emp.id === selectedEmployeeId ? ' active-row-btn' : '';
            return `
                <tr>
                    <td><strong>${makeSafe(emp.employee_no)}</strong></td>
                    <td>${makeSafe(emp.full_name)}</td>
                    <td>${makeSafe(emp.department || '-')}</td>
                    <td>${makeSafe(emp.position || '-')}</td>
                    <td><span class="${badgeClass}">${makeSafe(emp.status)}</span></td>
                    <td>
                        <div class="table-action-group">
                            <button type="button" class="table-btn${isSelected}" data-view-id="${makeSafe(emp.id)}">Profile</button>
                            <button type="button" class="table-btn" data-edit-id="${makeSafe(emp.id)}">Edit</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('[data-view-id]').forEach(btn => {
            btn.addEventListener('click', () => selectEmployeeProfile(btn.getAttribute('data-view-id')));
        });

        tbody.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const emp = allEmployeesCache.find(e => e.id === btn.getAttribute('data-edit-id'));
                if (emp) openEmployeeModal(emp);
            });
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6">Error: ${makeSafe(err.message)}</td></tr>`;
    }
}

async function selectEmployeeProfile(employeeId) {
    selectedEmployeeId = employeeId;
    loadDirectory();

    const emptyState = document.getElementById('profile-empty-state');
    const loadedState = document.getElementById('profile-loaded-state');

    try {
        const profile = await api.getEmployeeProfile(employeeId);
        const emp = profile.employee;

        emptyState.style.display = 'none';
        loadedState.style.display = 'block';

        showText('prof-emp-no', emp.employee_no);
        showText('prof-full-name', emp.full_name);
        showText('prof-role-dept', `${emp.position || 'No Position'} · ${emp.department || 'No Department'}`);

        const badge = document.getElementById('prof-status-badge');
        badge.textContent = emp.status;
        badge.className = emp.status === 'Active' ? 'status active-status' : 'status inactive-status';

        document.getElementById('btn-edit-employee').onclick = () => openEmployeeModal(emp);
        document.getElementById('prof-add-skill').onclick = () => openQuickRecordModal('skill', emp);
        document.getElementById('prof-add-cert').onclick = () => openQuickRecordModal('cert', emp);
        document.getElementById('prof-add-training').onclick = () => openQuickRecordModal('training', emp);

        // Render Skills
        const skillsBox = document.getElementById('prof-skills-list');
        if (profile.skills.length === 0) {
            skillsBox.innerHTML = '<span class="muted-text">No skills recorded yet.</span>';
        } else {
            skillsBox.innerHTML = profile.skills.map(s => `
                <div class="skill-chip">
                    <span>${makeSafe(s.skills ? s.skills.name : 'Skill')}</span>
                    <strong>Lvl ${makeSafe(s.level)}/5</strong>
                </div>
            `).join('');
        }

        // Render Certifications
        const certsBox = document.getElementById('prof-certs-list');
        if (profile.certifications.length === 0) {
            certsBox.innerHTML = '<span class="muted-text">No certifications recorded yet.</span>';
        } else {
            certsBox.innerHTML = profile.certifications.map(c => `
                <div class="record-item">
                    <div>
                        <strong>${makeSafe(c.name)}</strong>
                        <div class="record-item-meta">
                            Expires: ${makeSafe(c.expires_on || 'No expiry')} · ${c.verified ? 'Verified' : 'Pending Verification'}
                        </div>
                    </div>
                    ${getCertStatusBadge(c)}
                </div>
            `).join('');
        }

        // Render Trainings
        const trainBox = document.getElementById('prof-trainings-list');
        if (profile.trainings.length === 0) {
            trainBox.innerHTML = '<span class="muted-text">No training records yet.</span>';
        } else {
            trainBox.innerHTML = profile.trainings.map(t => `
                <div class="record-item">
                    <div>
                        <strong>${makeSafe(t.title)}</strong>
                        <div class="record-item-meta">Status: ${makeSafe(t.status)}</div>
                    </div>
                    <span class="status ${t.status === 'Completed' ? 'active-status' : 'expiring-status'}">
                        ${makeSafe(t.status)}
                    </span>
                </div>
            `).join('');
        }
    } catch (err) {
        alert('Failed to load employee profile: ' + err.message);
    }
}

function closeModal() {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();
}

function openEmployeeModal(existingEmp = null) {
    const isEdit = Boolean(existingEmp);
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <form class="modal" id="emp-modal-form">
            <h3>${isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
            <label>Employee Number *
                <input id="m-emp-no" type="text" value="${makeSafe(existingEmp?.employee_no || '')}" required>
            </label>
            <label>Full Name *
                <input id="m-full-name" type="text" value="${makeSafe(existingEmp?.full_name || '')}" required>
            </label>
            <label>Email
                <input id="m-email" type="email" value="${makeSafe(existingEmp?.email || '')}">
            </label>
            <label>Department
                <input id="m-dept" type="text" value="${makeSafe(existingEmp?.department || '')}" placeholder="e.g. IT, HR, CCS">
            </label>
            <label>Position
                <input id="m-pos" type="text" value="${makeSafe(existingEmp?.position || '')}" placeholder="e.g. Field Engineer">
            </label>
            <label>Status
                <select id="m-status">
                    <option value="Active" ${existingEmp?.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Inactive" ${existingEmp?.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </label>
            <p class="modal-error" id="modal-error"></p>
            <div class="modal-buttons">
                <button type="button" id="modal-cancel">Cancel</button>
                <button type="submit" class="save-btn" id="modal-save">Save</button>
            </div>
        </form>
    `;
    document.body.appendChild(overlay);

    document.getElementById('modal-cancel').onclick = closeModal;
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };

    document.getElementById('emp-modal-form').onsubmit = async e => {
        e.preventDefault();
        const payload = {
            employee_no: document.getElementById('m-emp-no').value.trim(),
            full_name: document.getElementById('m-full-name').value.trim(),
            email: document.getElementById('m-email').value.trim() || null,
            department: document.getElementById('m-dept').value.trim() || null,
            position: document.getElementById('m-pos').value.trim() || null,
            status: document.getElementById('m-status').value
        };

        const saveBtn = document.getElementById('modal-save');
        saveBtn.disabled = true;
        try {
            if (isEdit) {
                await api.updateEmployee(existingEmp.id, payload);
            } else {
                await api.addEmployee(payload);
            }
            closeModal();
            await loadDirectory();
            if (isEdit && selectedEmployeeId === existingEmp.id) {
                selectEmployeeProfile(existingEmp.id);
            }
        } catch (err) {
            document.getElementById('modal-error').textContent = err.message;
            saveBtn.disabled = false;
        }
    };
}

function openQuickRecordModal(type, emp) {
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';

    let title = '';
    let fields = '';
    if (type === 'skill') {
        title = `Record Skill for ${emp.full_name}`;
        fields = `
            <label>Skill Name *<input id="qr-skill" type="text" required></label>
            <label>Competency Level (1–5)
                <select id="qr-level">
                    <option value="1">1 - Beginner</option>
                    <option value="2">2 - Basic</option>
                    <option value="3">3 - Intermediate</option>
                    <option value="4">4 - Advanced</option>
                    <option value="5">5 - Expert</option>
                </select>
            </label>
        `;
    } else if (type === 'cert') {
        title = `Add Certification for ${emp.full_name}`;
        fields = `
            <label>Certification Name *<input id="qr-cert-name" type="text" required></label>
            <label>Issued On<input id="qr-issued" type="date"></label>
            <label>Expires On<input id="qr-expires" type="date"></label>
        `;
    } else {
        title = `Add Training for ${emp.full_name}`;
        fields = `
            <label>Training Title *<input id="qr-train-title" type="text" required></label>
            <label>Status
                <select id="qr-train-status">
                    <option value="Not Completed">Not Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                </select>
            </label>
        `;
    }

    overlay.innerHTML = `
        <form class="modal" id="qr-form">
            <h3>${makeSafe(title)}</h3>
            ${fields}
            <p class="modal-error" id="modal-error"></p>
            <div class="modal-buttons">
                <button type="button" id="modal-cancel">Cancel</button>
                <button type="submit" class="save-btn" id="modal-save">Save</button>
            </div>
        </form>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-cancel').onclick = closeModal;
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };

    document.getElementById('qr-form').onsubmit = async e => {
        e.preventDefault();
        const saveBtn = document.getElementById('modal-save');
        saveBtn.disabled = true;
        try {
            if (type === 'skill') {
                await api.recordSkill({
                    employee_id: emp.id,
                    skill_name: document.getElementById('qr-skill').value.trim(),
                    level: document.getElementById('qr-level').value
                });
            } else if (type === 'cert') {
                await api.addCertification({
                    employee_id: emp.id,
                    name: document.getElementById('qr-cert-name').value.trim(),
                    issued_on: document.getElementById('qr-issued').value || null,
                    expires_on: document.getElementById('qr-expires').value || null
                });
            } else {
                await api.addTraining({
                    employee_id: emp.id,
                    title: document.getElementById('qr-train-title').value.trim(),
                    status: document.getElementById('qr-train-status').value
                });
            }
            closeModal();
            selectEmployeeProfile(emp.id);
        } catch (err) {
            document.getElementById('modal-error').textContent = err.message;
            saveBtn.disabled = false;
        }
    };
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
});

document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkLogin();
    if (!session) return;

    setupLogout();
    document.getElementById('btn-new-employee').addEventListener('click', () => openEmployeeModal(null));

    let searchTimer;
    document.getElementById('emp-page-search').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadDirectory, 250);
    });
    document.getElementById('filter-dept').addEventListener('change', loadDirectory);
    document.getElementById('filter-status').addEventListener('change', loadDirectory);

    await loadDirectory();

    const params = new URLSearchParams(window.location.search);
    const initialId = params.get('id');
    if (initialId) {
        selectEmployeeProfile(initialId);
    }
});