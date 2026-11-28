document.addEventListener('DOMContentLoaded', () => {
    let allRecords = [];
    let allEmployees = [];
    let allSkills = [];

    const els = {
        statPending: document.getElementById('stat-comp-pending'),
        statVerified: document.getElementById('stat-comp-verified'),
        statSenior: document.getElementById('stat-comp-senior'),
        statRate: document.getElementById('stat-comp-rate'),
        tier1: document.getElementById('tier-count-1'),
        tier2: document.getElementById('tier-count-2'),
        tier3: document.getElementById('tier-count-3'),
        tier4: document.getElementById('tier-count-4'),
        search: document.getElementById('comp-search'),
        filterStatus: document.getElementById('comp-filter-status'),
        filterDept: document.getElementById('comp-filter-dept'),
        filterLevel: document.getElementById('comp-filter-level'),
        tbody: document.getElementById('comp-queue-rows'),
        deptList: document.getElementById('dept-readiness-list'),
        // Modal
        modal: document.getElementById('comp-review-modal'),
        modalTitle: document.getElementById('comp-modal-title'),
        form: document.getElementById('comp-review-form'),
        modalEmp: document.getElementById('comp-modal-emp'),
        modalSkill: document.getElementById('comp-modal-skill'),
        modalLevel: document.getElementById('comp-modal-level'),
        modalStatus: document.getElementById('comp-modal-status')
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function statusBadgeClass(status) {
        const s = (status || '').toLowerCase();
        if (s === 'verified') return 'active-status';
        if (s === 'rejected') return 'rejected-status';
        return 'pending-status';
    }

    function updateMetricsAndTiers() {
        const total = allRecords.length;
        const verified = allRecords.filter(r => (r.status || '').toLowerCase() === 'verified').length;
        const pending = allRecords.filter(r => {
            const s = (r.status || '').toLowerCase();
            return s === 'pending' || s === 'declared';
        }).length;

        let c1 = 0, c2 = 0, c3 = 0, c4 = 0;
        for (const r of allRecords) {
            const lvl = (r.level || '').toLowerCase();
            if (lvl.includes('expert') || lvl === '4') c4++;
            else if (lvl.includes('advanced') || lvl === '3') c3++;
            else if (lvl.includes('intermediate') || lvl === '2') c2++;
            else c1++;
        }

        els.statPending.textContent = pending;
        els.statVerified.textContent = verified;
        els.statSenior.textContent = c3 + c4;
        els.statRate.textContent = total > 0 ? `${Math.round((verified / total) * 100)}%` : '0%';

        els.tier1.textContent = c1;
        els.tier2.textContent = c2;
        els.tier3.textContent = c3;
        els.tier4.textContent = c4;
    }

    function renderDepartmentReadiness() {
        const depts = ['IT', 'HR', 'CCS', 'Operations'];

        els.deptList.innerHTML = depts.map(dept => {
            const deptRecords = allRecords.filter(r => r.employees?.department === dept);
            const verifiedCount = deptRecords.filter(r => (r.status || '').toLowerCase() === 'verified').length;
            const totalCount = deptRecords.length;
            const pct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

            return `
                <div class="dept-readiness-item">
                    <div class="dept-readiness-top">
                        <strong>${escapeHtml(dept)}</strong>
                        <span>${pct}% Verified</span>
                    </div>
                    <div class="dept-readiness-bar">
                        <div class="dept-readiness-fill" style="width: ${pct}%;"></div>
                    </div>
                    <div class="dept-readiness-meta">
                        <span>${verifiedCount} verified</span>
                        <span>${totalCount} total records</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderQueueTable() {
        const query = els.search.value.trim().toLowerCase();
        const statusFilter = els.filterStatus.value;
        const deptFilter = els.filterDept.value;
        const levelFilter = els.filterLevel.value;

        const filtered = allRecords.filter(rec => {
            const emp = rec.employees || {};
            const sk = rec.skills || {};
            const status = rec.status || 'Declared';

            if (statusFilter === 'needs_review') {
                if (status !== 'Pending' && status !== 'Declared') return false;
            } else if (statusFilter && status !== statusFilter) {
                return false;
            }

            if (deptFilter && emp.department !== deptFilter) return false;
            if (levelFilter && rec.level !== levelFilter) return false;

            if (query) {
                const haystack = `${emp.full_name || ''} ${emp.employee_no || ''} ${emp.department || ''} ${sk.name || ''} ${sk.category || ''}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            els.tbody.innerHTML = `
                <tr>
                    <td colspan="5">No competency records match the selected filters.</td>
                </tr>
            `;
            return;
        }

        els.tbody.innerHTML = filtered.map(rec => {
            const emp = rec.employees || {};
            const sk = rec.skills || {};
            const status = rec.status || 'Declared';
            const isVerified = status.toLowerCase() === 'verified';

            return `
                <tr>
                    <td>
                        <div class="matrix-emp-cell">
                            <a href="employees.html?id=${rec.employee_id}">${escapeHtml(emp.full_name || 'Unknown Employee')}</a>
                            <span class="matrix-emp-meta">${escapeHtml(emp.employee_no || '')} · ${escapeHtml(emp.department || 'Unassigned')}</span>
                        </div>
                    </td>
                    <td>
                        <strong>${escapeHtml(sk.name || 'Unknown Skill')}</strong>
                        <div class="matrix-emp-meta">${escapeHtml(sk.category || 'General')}</div>
                    </td>
                    <td>${escapeHtml(rec.level || 'Beginner')}</td>
                    <td>
                        <span class="status ${statusBadgeClass(status)}">${escapeHtml(status)}</span>
                    </td>
                    <td>
                        <div class="verify-action-group">
                            ${!isVerified ? `
                                <button type="button" class="btn-verify-approve" data-action="approve" data-id="${rec.id}">
                                    Verify
                                </button>
                            ` : ''}
                            ${status.toLowerCase() !== 'rejected' ? `
                                <button type="button" class="btn-verify-reject" data-action="reject" data-id="${rec.id}">
                                    Reject
                                </button>
                            ` : ''}
                            <button type="button" class="table-btn" data-action="edit" data-id="${rec.id}">
                                Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function populateModalDropdowns() {
        els.modalEmp.innerHTML = allEmployees.map(emp =>
            `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_no || '')})</option>`
        ).join('');

        els.modalSkill.innerHTML = allSkills.map(sk =>
            `<option value="${sk.id}">${escapeHtml(sk.name)} — ${escapeHtml(sk.category || 'General')}</option>`
        ).join('');
    }

    function openModal(record = null) {
        if (allEmployees.length === 0 || allSkills.length === 0) {
            alert('Please add at least one active employee and one skill first.');
            return;
        }

        if (record) {
            els.modalTitle.textContent = 'Review & Update Competency';
            els.modalEmp.value = record.employee_id;
            els.modalSkill.value = record.skill_id;
            els.modalLevel.value = record.level || 'Beginner';
            els.modalStatus.value = record.status || 'Verified';
        } else {
            els.modalTitle.textContent = 'Log Competency Submission';
            els.modalLevel.value = 'Beginner';
            els.modalStatus.value = 'Pending';
        }

        els.modal.style.display = 'flex';
    }

    function closeModal() {
        els.modal.style.display = 'none';
    }

    async function loadCompetencies() {
        try {
            const { records, employees, skills } = await api.getCompetencyRecords();
            allRecords = records || [];
            allEmployees = employees || [];
            allSkills = skills || [];

            updateMetricsAndTiers();
            renderDepartmentReadiness();
            populateModalDropdowns();
            renderQueueTable();
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error('Failed to load competencies:', err);
            els.tbody.innerHTML = `<tr><td colspan="5">Error loading competency records: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    // Filter listeners
    els.search.addEventListener('input', renderQueueTable);
    els.filterStatus.addEventListener('change', renderQueueTable);
    els.filterDept.addEventListener('change', renderQueueTable);
    els.filterLevel.addEventListener('change', renderQueueTable);

    // Table actions delegation
    els.tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        try {
            if (action === 'approve') {
                await api.updateCompetencyStatus(id, 'Verified');
                await loadCompetencies();
            } else if (action === 'reject') {
                await api.updateCompetencyStatus(id, 'Rejected');
                await loadCompetencies();
            } else if (action === 'edit') {
                const rec = allRecords.find(r => String(r.id) === String(id));
                if (rec) openModal(rec);
            }
        } catch (err) {
            alert('Failed to update competency record: ' + err.message);
        }
    });

    // Modal controls
    document.getElementById('btn-submit-competency').addEventListener('click', () => openModal());
    document.getElementById('close-comp-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-comp-modal').addEventListener('click', closeModal);

    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api.upsertEmployeeSkill({
                employee_id: els.modalEmp.value,
                skill_id: els.modalSkill.value,
                level: els.modalLevel.value,
                status: els.modalStatus.value
            });
            closeModal();
            await loadCompetencies();
        } catch (err) {
            alert('Failed to save competency record: ' + err.message);
        }
    });

    loadCompetencies();
});