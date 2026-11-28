document.addEventListener('DOMContentLoaded', () => {
    let allCerts = [];
    let allEmployees = [];

    const els = {
        statActive: document.getElementById('stat-cert-active'),
        statExpiring: document.getElementById('stat-cert-expiring'),
        statExpired: document.getElementById('stat-cert-expired'),
        statUnverified: document.getElementById('stat-cert-unverified'),
        alertBanner: document.getElementById('cert-alert-banner'),
        alertTitle: document.getElementById('cert-alert-title'),
        alertText: document.getElementById('cert-alert-text'),
        search: document.getElementById('cert-search'),
        filterExpiry: document.getElementById('cert-filter-expiry'),
        filterVerified: document.getElementById('cert-filter-verified'),
        filterDept: document.getElementById('cert-filter-dept'),
        tbody: document.getElementById('cert-table-rows'),
        // Modal
        modal: document.getElementById('cert-modal'),
        modalTitle: document.getElementById('cert-modal-title'),
        form: document.getElementById('cert-modal-form'),
        recordId: document.getElementById('cert-record-id'),
        modalEmp: document.getElementById('cert-modal-emp'),
        modalName: document.getElementById('cert-modal-name'),
        modalIssuer: document.getElementById('cert-modal-issuer'),
        modalIssued: document.getElementById('cert-modal-issued'),
        modalExpires: document.getElementById('cert-modal-expires'),
        modalVerified: document.getElementById('cert-modal-verified'),
        modalFile: document.getElementById('cert-modal-file'),
        existingEvidence: document.getElementById('cert-existing-evidence'),
        saveBtn: document.getElementById('save-cert-btn')
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getExpiryState(cert) {
        if (!cert.expires_on) return 'Active';
        const today = new Date().toISOString().slice(0, 10);
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        if (cert.expires_on < today) return 'Expired';
        if (cert.expires_on <= in30) return 'Expiring';
        return 'Active';
    }

    function getDaysRemainingLabel(expiresOn) {
        if (!expiresOn) return 'No expiration';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(expiresOn + 'T00:00:00');
        const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
        if (diffDays === 0) return 'Expires today';
        if (diffDays <= 30) return `In ${diffDays}d`;
        return expiresOn;
    }

    function updateSummaryAndAlerts() {
        let active = 0;
        let expiring = 0;
        let expired = 0;
        let unverified = 0;

        for (const c of allCerts) {
            const state = getExpiryState(c);
            if (state === 'Expired') expired++;
            else if (state === 'Expiring') expiring++;
            else active++;

            if (!c.verified) unverified++;
        }

        els.statActive.textContent = active;
        els.statExpiring.textContent = expiring;
        els.statExpired.textContent = expired;
        els.statUnverified.textContent = unverified;

        if (expired > 0 || expiring > 0) {
            els.alertBanner.style.display = 'flex';
            els.alertTitle.textContent = `${expired} Expired · ${expiring} Expiring Within 30 Days`;
            els.alertText.textContent = 'Review upcoming credential renewals to maintain operational compliance.';
        } else {
            els.alertBanner.style.display = 'none';
        }
    }

    function populateEmployeeSelect() {
        els.modalEmp.innerHTML = allEmployees.map(emp =>
            `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_no || '')})</option>`
        ).join('');
    }

    function renderTable() {
        const query = els.search.value.trim().toLowerCase();
        const expiryFilter = els.filterExpiry.value;
        const verifiedFilter = els.filterVerified.value;
        const deptFilter = els.filterDept.value;

        const filtered = allCerts.filter(cert => {
            const emp = cert.employees || {};
            const state = getExpiryState(cert);

            if (expiryFilter === 'urgent') {
                if (state !== 'Expiring' && state !== 'Expired') return false;
            } else if (expiryFilter && state !== expiryFilter) {
                return false;
            }

            if (verifiedFilter === 'verified' && !cert.verified) return false;
            if (verifiedFilter === 'pending' && cert.verified) return false;

            if (deptFilter && emp.department !== deptFilter) return false;

            if (query) {
                const haystack = `${emp.full_name || ''} ${emp.employee_no || ''} ${emp.department || ''} ${cert.name || ''} ${cert.issuer || ''}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }

            return true;
        });

        if (filtered.length === 0) {
            els.tbody.innerHTML = `<tr><td colspan="7">No certification records match the current filters.</td></tr>`;
            return;
        }

        els.tbody.innerHTML = filtered.map(cert => {
            const emp = cert.employees || {};
            const state = getExpiryState(cert);

            let stateClass = 'active-status';
            if (state === 'Expiring') stateClass = 'expiring-status';
            if (state === 'Expired') stateClass = 'expired-status';

            const verifyBadge = cert.verified
                ? `<span class="status active-status">Verified</span>`
                : `<span class="status pending-status">Pending</span>`;

            const evidenceCell = cert.evidence_url
                ? `<a href="${escapeHtml(cert.evidence_url)}" target="_blank" rel="noopener" class="evidence-link">View File</a>`
                : `<span class="muted-text">None</span>`;

            return `
                <tr>
                    <td>
                        <div class="matrix-emp-cell">
                            <a href="employees.html?id=${cert.employee_id}">${escapeHtml(emp.full_name || 'Unknown Employee')}</a>
                            <span class="matrix-emp-meta">${escapeHtml(emp.employee_no || '')} · ${escapeHtml(emp.department || 'Unassigned')}</span>
                        </div>
                    </td>
                    <td>
                        <strong>${escapeHtml(cert.name)}</strong>
                        <div class="matrix-emp-meta">${escapeHtml(cert.issuer || 'No issuer specified')}</div>
                    </td>
                    <td>
                        <div>Issued: ${escapeHtml(cert.issued_on || '—')}</div>
                        <div class="matrix-emp-meta">Expires: ${escapeHtml(cert.expires_on || 'No expiry')} (${escapeHtml(getDaysRemainingLabel(cert.expires_on))})</div>
                    </td>
                    <td>
                        <span class="status ${stateClass}">${state}</span>
                    </td>
                    <td>${verifyBadge}</td>
                    <td>${evidenceCell}</td>
                    <td>
                        <div class="verify-action-group">
                            ${!cert.verified ? `
                                <button type="button" class="btn-verify-approve" data-action="verify" data-id="${cert.id}">
                                    Verify
                                </button>
                            ` : ''}
                            <button type="button" class="table-btn" data-action="edit" data-id="${cert.id}">
                                Edit
                            </button>
                            <button type="button" class="btn-verify-reject" data-action="delete" data-id="${cert.id}">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openModal(cert = null) {
        if (allEmployees.length === 0) {
            alert('Please add at least one active employee first.');
            return;
        }

        els.form.reset();
        if (cert) {
            els.modalTitle.textContent = 'Edit Certification Record';
            els.recordId.value = cert.id;
            els.modalEmp.value = cert.employee_id;
            els.modalName.value = cert.name || '';
            els.modalIssuer.value = cert.issuer || '';
            els.modalIssued.value = cert.issued_on || '';
            els.modalExpires.value = cert.expires_on || '';
            els.modalVerified.value = cert.verified ? 'true' : 'false';
            els.existingEvidence.textContent = cert.evidence_url
                ? 'Current evidence file is attached. Upload a new file to replace it.'
                : '';
        } else {
            els.modalTitle.textContent = 'Add Employee Certification';
            els.recordId.value = '';
            els.modalVerified.value = 'false';
            els.existingEvidence.textContent = '';
        }

        els.modal.style.display = 'flex';
    }

    function closeModal() {
        els.modal.style.display = 'none';
    }

    async function loadCertifications() {
        try {
            const { certifications, employees } = await api.getAllCertifications();
            allCerts = certifications || [];
            allEmployees = employees || [];

            updateSummaryAndAlerts();
            populateEmployeeSelect();
            renderTable();
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error('Failed to load certifications:', err);
            els.tbody.innerHTML = `<tr><td colspan="7">Error loading certifications: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    // Filter listeners
    els.search.addEventListener('input', renderTable);
    els.filterExpiry.addEventListener('change', renderTable);
    els.filterVerified.addEventListener('change', renderTable);
    els.filterDept.addEventListener('change', renderTable);

    document.getElementById('btn-filter-urgent').addEventListener('click', () => {
        els.filterExpiry.value = 'urgent';
        renderTable();
    });

    // Table row action delegation
    els.tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const record = allCerts.find(c => String(c.id) === String(id));

        try {
            if (action === 'verify') {
                await api.updateCertification(id, { verified: true });
                await loadCertifications();
            } else if (action === 'edit' && record) {
                openModal(record);
            } else if (action === 'delete') {
                if (!confirm('Delete this certification record?')) return;
                await api.deleteCertification(id);
                await loadCertifications();
            }
        } catch (err) {
            alert('Action failed: ' + err.message);
        }
    });

    // Modal controls
    document.getElementById('btn-new-cert').addEventListener('click', () => openModal());
    document.getElementById('close-cert-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-cert-modal').addEventListener('click', closeModal);

    els.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const existingId = els.recordId.value;
        const existingRecord = existingId
            ? allCerts.find(c => String(c.id) === String(existingId))
            : null;

        els.saveBtn.disabled = true;
        els.saveBtn.textContent = 'Saving...';

        try {
            let evidenceUrl = existingRecord ? existingRecord.evidence_url : null;
            const file = els.modalFile.files[0];
            if (file) {
                evidenceUrl = await api.uploadCertificationEvidence(els.modalEmp.value, file);
            }

            const payload = {
                employee_id: els.modalEmp.value,
                name: els.modalName.value.trim(),
                issuer: els.modalIssuer.value.trim() || null,
                issued_on: els.modalIssued.value || null,
                expires_on: els.modalExpires.value || null,
                verified: els.modalVerified.value === 'true',
                evidence_url: evidenceUrl
            };

            if (existingId) {
                await api.updateCertification(existingId, payload);
            } else {
                await api.addCertification(payload);
            }

            closeModal();
            await loadCertifications();
        } catch (err) {
            alert('Failed to save certification: ' + err.message);
        } finally {
            els.saveBtn.disabled = false;
            els.saveBtn.textContent = 'Save Certification';
        }
    });

    // Export CSV
    document.getElementById('btn-export-certs').addEventListener('click', () => {
        const headers = ['Employee No', 'Employee Name', 'Department', 'Certification', 'Issuer', 'Issued On', 'Expires On', 'Validity Status', 'Verified'];
        const rows = allCerts.map(c => {
            const emp = c.employees || {};
            return [
                emp.employee_no || '',
                emp.full_name || '',
                emp.department || '',
                c.name || '',
                c.issuer || '',
                c.issued_on || '',
                c.expires_on || '',
                getExpiryState(c),
                c.verified ? 'Yes' : 'No'
            ];
        });

        const csv = [headers, ...rows]
            .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcft-certifications-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    loadCertifications();
});