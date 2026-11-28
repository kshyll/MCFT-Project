document.addEventListener('DOMContentLoaded', () => {
    let allTrainings = [];
    let allEmployees = [];

    const els = {
        statCompleted: document.getElementById('stat-train-completed'),
        statProgress: document.getElementById('stat-train-progress'),
        statPending: document.getElementById('stat-train-pending'),
        statRate: document.getElementById('stat-train-rate'),
        search: document.getElementById('training-search'),
        filterStatus: document.getElementById('train-filter-status'),
        filterVerified: document.getElementById('train-filter-verified'),
        filterDept: document.getElementById('train-filter-dept'),
        tbody: document.getElementById('training-table-rows'),
        // Modal
        modal: document.getElementById('training-modal'),
        modalTitle: document.getElementById('train-modal-title'),
        form: document.getElementById('train-modal-form'),
        recordId: document.getElementById('train-record-id'),
        modalEmp: document.getElementById('train-modal-emp'),
        modalTitleInput: document.getElementById('train-modal-title-input'),
        modalProvider: document.getElementById('train-modal-provider'),
        modalStatus: document.getElementById('train-modal-status'),
        modalCompletedOn: document.getElementById('train-modal-completed-on'),
        modalVerified: document.getElementById('train-modal-verified'),
        modalRemarks: document.getElementById('train-modal-remarks'),
        saveBtn: document.getElementById('save-train-btn')
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function statusBadgeClass(status) {
        if (status === 'Completed') return 'active-status';
        if (status === 'In Progress') return 'in-progress-status';
        return 'not-completed-status';
    }

    function updateSummaryCards() {
        const total = allTrainings.length;
        const completed = allTrainings.filter(t => t.status === 'Completed').length;
        const inProgress = allTrainings.filter(t => t.status === 'In Progress').length;
        const notCompleted = allTrainings.filter(t => t.status === 'Not Completed' || !t.status).length;

        els.statCompleted.textContent = completed;
        els.statProgress.textContent = inProgress;
        els.statPending.textContent = notCompleted;
        els.statRate.textContent = total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%';
    }

    function populateEmployeeSelect() {
        els.modalEmp.innerHTML = allEmployees.map(emp =>
            `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_no || '')})</option>`
        ).join('');
    }

    function renderTable() {
        const query = els.search.value.trim().toLowerCase();
        const statusFilter = els.filterStatus.value;
        const verifiedFilter = els.filterVerified.value;
        const deptFilter = els.filterDept.value;

        const filtered = allTrainings.filter(item => {
            const emp = item.employees || {};
            const status = item.status || 'Not Completed';

            if (statusFilter && status !== statusFilter) return false;
            if (verifiedFilter === 'verified' && !item.verified) return false;
            if (verifiedFilter === 'pending' && item.verified) return false;
            if (deptFilter && emp.department !== deptFilter) return false;

            if (query) {
                const haystack = `${emp.full_name || ''} ${emp.employee_no || ''} ${emp.department || ''} ${item.title || ''} ${item.provider || ''}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            els.tbody.innerHTML = `<tr><td colspan="6">No training records match the current filters.</td></tr>`;
            return;
        }

        els.tbody.innerHTML = filtered.map(item => {
            const emp = item.employees || {};
            const status = item.status || 'Not Completed';
            const isCompleted = status === 'Completed';

            const verifyBadge = item.verified
                ? `<span class="status active-status">Verified</span>`
                : `<span class="status pending-status">Pending</span>`;

            return `
                <tr>
                    <td>
                        <div class="matrix-emp-cell">
                            <a href="employees.html?id=${item.employee_id}">${escapeHtml(emp.full_name || 'Unknown Employee')}</a>
                            <span class="matrix-emp-meta">${escapeHtml(emp.employee_no || '')} · ${escapeHtml(emp.department || 'Unassigned')}</span>
                        </div>
                    </td>
                    <td>
                        <strong>${escapeHtml(item.title)}</strong>
                        <div class="matrix-emp-meta">${escapeHtml(item.provider || 'Internal / Unspecified provider')}</div>
                        ${item.remarks ? `<div class="training-remarks-note">${escapeHtml(item.remarks)}</div>` : ''}
                    </td>
                    <td>${escapeHtml(item.completed_on || '—')}</td>
                    <td>
                        <span class="status ${statusBadgeClass(status)}">${escapeHtml(status)}</span>
                    </td>
                    <td>${verifyBadge}</td>
                    <td>
                        <div class="verify-action-group">
                            ${!isCompleted ? `
                                <button type="button" class="btn-verify-approve" data-action="complete" data-id="${item.id}">
                                    Mark Complete
                                </button>
                            ` : ''}
                            ${!item.verified ? `
                                <button type="button" class="table-btn" data-action="verify" data-id="${item.id}">
                                    Verify
                                </button>
                            ` : ''}
                            <button type="button" class="table-btn" data-action="edit" data-id="${item.id}">
                                Edit
                            </button>
                            <button type="button" class="btn-verify-reject" data-action="delete" data-id="${item.id}">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openModal(record = null) {
        if (allEmployees.length === 0) {
            alert('Please add at least one active employee first.');
            return;
        }

        els.form.reset();
        if (record) {
            els.modalTitle.textContent = 'Edit Training Record';
            els.recordId.value = record.id;
            els.modalEmp.value = record.employee_id;
            els.modalTitleInput.value = record.title || '';
            els.modalProvider.value = record.provider || '';
            els.modalStatus.value = record.status || 'Not Completed';
            els.modalCompletedOn.value = record.completed_on || '';
            els.modalVerified.value = record.verified ? 'true' : 'false';
            els.modalRemarks.value = record.remarks || '';
        } else {
            els.modalTitle.textContent = 'Log Training Record';
            els.recordId.value = '';
            els.modalStatus.value = 'In Progress';
            els.modalVerified.value = 'false';
        }

        els.modal.style.display = 'flex';
    }

    function closeModal() {
        els.modal.style.display = 'none';
    }

    async function loadTrainings() {
        try {
            const { trainings, employees } = await api.getAllTrainings();
            allTrainings = trainings || [];
            allEmployees = employees || [];

            updateSummaryCards();
            populateEmployeeSelect();
            renderTable();
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error('Failed to load trainings:', err);
            els.tbody.innerHTML = `<tr><td colspan="6">Error loading training records: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    // Auto-fill completion date when status changes to Completed
    els.modalStatus.addEventListener('change', () => {
        if (els.modalStatus.value === 'Completed' && !els.modalCompletedOn.value) {
            els.modalCompletedOn.value = new Date().toISOString().slice(0, 10);
        }
    });

    // Filter listeners
    els.search.addEventListener('input', renderTable);
    els.filterStatus.addEventListener('change', renderTable);
    els.filterVerified.addEventListener('change', renderTable);
    els.filterDept.addEventListener('change', renderTable);

    // Table action delegation
    els.tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const record = allTrainings.find(t => String(t.id) === String(id));

        try {
            if (action === 'complete') {
                const today = new Date().toISOString().slice(0, 10);
                await api.updateTraining(id, {
                    status: 'Completed',
                    completed_on: record?.completed_on || today
                });
                await loadTrainings();
            } else if (action === 'verify') {
                await api.updateTraining(id, { verified: true });
                await loadTrainings();
            } else if (action === 'edit' && record) {
                openModal(record);
            } else if (action === 'delete') {
                if (!confirm('Delete this training record?')) return;
                await api.deleteTraining(id);
                await loadTrainings();
            }
        } catch (err) {
            alert('Action failed: ' + err.message);
        }
    });

    // Modal controls
    document.getElementById('btn-new-training').addEventListener('click', () => openModal());
    document.getElementById('close-train-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-train-modal').addEventListener('click', closeModal);

    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const existingId = els.recordId.value;
        const status = els.modalStatus.value;
        let completedOn = els.modalCompletedOn.value || null;

        if (status === 'Completed' && !completedOn) {
            completedOn = new Date().toISOString().slice(0, 10);
        }

        els.saveBtn.disabled = true;
        els.saveBtn.textContent = 'Saving...';

        try {
            const payload = {
                employee_id: els.modalEmp.value,
                title: els.modalTitleInput.value.trim(),
                provider: els.modalProvider.value.trim() || null,
                status,
                completed_on: completedOn,
                verified: els.modalVerified.value === 'true',
                remarks: els.modalRemarks.value.trim() || null
            };

            if (existingId) {
                await api.updateTraining(existingId, payload);
            } else {
                await api.addTraining(payload);
            }

            closeModal();
            await loadTrainings();
        } catch (err) {
            alert('Failed to save training record: ' + err.message);
        } finally {
            els.saveBtn.disabled = false;
            els.saveBtn.textContent = 'Save Training Record';
        }
    });

    // Export CSV
    document.getElementById('btn-export-training').addEventListener('click', () => {
        const headers = ['Employee No', 'Employee Name', 'Department', 'Training Title', 'Provider', 'Status', 'Completed On', 'Verified', 'Remarks'];
        const rows = allTrainings.map(t => {
            const emp = t.employees || {};
            return [
                emp.employee_no || '',
                emp.full_name || '',
                emp.department || '',
                t.title || '',
                t.provider || '',
                t.status || 'Not Completed',
                t.completed_on || '',
                t.verified ? 'Yes' : 'No',
                t.remarks || ''
            ];
        });

        const csv = [headers, ...rows]
            .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcft-training-records-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    loadTrainings();
});
