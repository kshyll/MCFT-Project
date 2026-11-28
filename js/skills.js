document.addEventListener('DOMContentLoaded', () => {
    let allEmployees = [];
    let allSkills = [];
    let allAssignments = [];

    const els = {
        totalSkills: document.getElementById('stat-total-skills'),
        verifiedSkills: document.getElementById('stat-verified-skills'),
        pendingSkills: document.getElementById('stat-pending-skills'),
        skillCategories: document.getElementById('stat-skill-categories'),
        search: document.getElementById('matrix-search'),
        filterDept: document.getElementById('matrix-filter-dept'),
        filterCategory: document.getElementById('matrix-filter-category'),
        filterStatus: document.getElementById('matrix-filter-status'),
        thead: document.getElementById('matrix-thead'),
        tbody: document.getElementById('matrix-tbody'),
        taxonomyGrid: document.getElementById('skill-taxonomy-grid'),
        taxonomyCountLabel: document.getElementById('taxonomy-count-label'),
        // Assign modal
        assignModal: document.getElementById('assign-skill-modal'),
        assignTitle: document.getElementById('assign-modal-title'),
        assignForm: document.getElementById('assign-skill-form'),
        modalEmp: document.getElementById('modal-emp-select'),
        modalSkill: document.getElementById('modal-skill-select'),
        modalLevel: document.getElementById('modal-level-select'),
        modalStatus: document.getElementById('modal-status-select'),
        // New skill modal
        newSkillModal: document.getElementById('new-skill-modal'),
        newSkillForm: document.getElementById('new-skill-form'),
        newSkillName: document.getElementById('new-skill-name'),
        newSkillCategory: document.getElementById('new-skill-category')
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function levelClass(level) {
        const norm = (level || '').toLowerCase();
        if (norm.includes('expert') || norm === '4') return 'cell-lvl-expert';
        if (norm.includes('advanced') || norm === '3') return 'cell-lvl-advanced';
        if (norm.includes('intermediate') || norm === '2') return 'cell-lvl-intermediate';
        return 'cell-lvl-beginner';
    }

    function updateSummaryCards() {
        const categories = new Set(allSkills.map(s => s.category || 'General'));
        const verified = allAssignments.filter(a => (a.status || '').toLowerCase() === 'verified').length;
        const pending = allAssignments.filter(a => (a.status || '').toLowerCase() === 'pending').length;

        els.totalSkills.textContent = allSkills.length;
        els.verifiedSkills.textContent = verified;
        els.pendingSkills.textContent = pending;
        els.skillCategories.textContent = categories.size;
    }

    function populateFilterAndModalOptions() {
        // Categories dropdown
        const categories = [...new Set(allSkills.map(s => s.category || 'General'))].sort();
        const currentCat = els.filterCategory.value;
        els.filterCategory.innerHTML = '<option value="">All Skill Categories</option>' +
            categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        els.filterCategory.value = currentCat;

        // Modal employee dropdown
        els.modalEmp.innerHTML = allEmployees.map(emp =>
            `<option value="${emp.id}">${escapeHtml(emp.full_name)} (${escapeHtml(emp.employee_no || '')})</option>`
        ).join('');

        // Modal skill dropdown
        els.modalSkill.innerHTML = allSkills.map(sk =>
            `<option value="${sk.id}">${escapeHtml(sk.name)} — ${escapeHtml(sk.category || 'General')}</option>`
        ).join('');
    }

    function renderMatrix() {
        const query = els.search.value.trim().toLowerCase();
        const deptFilter = els.filterDept.value;
        const catFilter = els.filterCategory.value;
        const statusFilter = els.filterStatus.value;

        const visibleSkills = allSkills.filter(sk => {
            if (catFilter && (sk.category || 'General') !== catFilter) return false;
            return true;
        });

        const visibleEmployees = allEmployees.filter(emp => {
            if (deptFilter && emp.department !== deptFilter) return false;
            if (!query) return true;

            const matchesEmp =
                (emp.full_name || '').toLowerCase().includes(query) ||
                (emp.employee_no || '').toLowerCase().includes(query) ||
                (emp.position || '').toLowerCase().includes(query);

            const matchesSkill = visibleSkills.some(sk =>
                (sk.name || '').toLowerCase().includes(query)
            );

            return matchesEmp || matchesSkill;
        });

        // Build lookup map: `${employee_id}_${skill_id}` -> assignment
        const assignmentMap = new Map();
        for (const item of allAssignments) {
            assignmentMap.set(`${item.employee_id}_${item.skill_id}`, item);
        }

        // Render table header
        if (visibleSkills.length === 0) {
            els.thead.innerHTML = `<tr><th class="sticky-col">Employee</th><th>No skills in selected category</th></tr>`;
            els.tbody.innerHTML = `<tr><td colspan="2">Add a skill or change your category filter.</td></tr>`;
            return;
        }

        els.thead.innerHTML = `
            <tr>
                <th class="sticky-col">Employee (${visibleEmployees.length})</th>
                ${visibleSkills.map(sk => `
                    <th class="skill-col-header">
                        <span class="skill-col-cat">${escapeHtml(sk.category || 'General')}</span>
                        <span class="skill-col-name">${escapeHtml(sk.name)}</span>
                    </th>
                `).join('')}
            </tr>
        `;

        if (visibleEmployees.length === 0) {
            els.tbody.innerHTML = `
                <tr>
                    <td colspan="${visibleSkills.length + 1}">No active employees match the current filters.</td>
                </tr>
            `;
            return;
        }

        els.tbody.innerHTML = visibleEmployees.map(emp => {
            const cells = visibleSkills.map(sk => {
                const record = assignmentMap.get(`${emp.id}_${sk.id}`);

                if (!record || (statusFilter && record.status !== statusFilter)) {
                    return `
                        <td>
                            <button type="button"
                                class="matrix-cell-btn matrix-cell-empty"
                                data-emp-id="${emp.id}"
                                data-skill-id="${sk.id}"
                                title="Assign ${escapeHtml(sk.name)} to ${escapeHtml(emp.full_name)}">
                                + Assign
                            </button>
                        </td>
                    `;
                }

                return `
                    <td>
                        <button type="button"
                            class="matrix-cell-btn ${levelClass(record.level)}"
                            data-emp-id="${emp.id}"
                            data-skill-id="${sk.id}"
                            data-level="${escapeHtml(record.level || 'Beginner')}"
                            data-status="${escapeHtml(record.status || 'Verified')}"
                            title="Edit ${escapeHtml(sk.name)} for ${escapeHtml(emp.full_name)}">
                            <span>${escapeHtml(record.level || 'Assigned')}</span>
                            <span class="cell-status-tag">${escapeHtml(record.status || 'Verified')}</span>
                        </button>
                    </td>
                `;
            }).join('');

            return `
                <tr>
                    <td class="sticky-col">
                        <div class="matrix-emp-cell">
                            <a href="employees.html?id=${emp.id}">${escapeHtml(emp.full_name)}</a>
                            <span class="matrix-emp-meta">${escapeHtml(emp.employee_no || '')} · ${escapeHtml(emp.department || 'Unassigned')}</span>
                        </div>
                    </td>
                    ${cells}
                </tr>
            `;
        }).join('');
    }

    function renderTaxonomy() {
        els.taxonomyCountLabel.textContent = `${allSkills.length} skill${allSkills.length === 1 ? '' : 's'}`;

        if (allSkills.length === 0) {
            els.taxonomyGrid.innerHTML = `<span class="muted-text">No skills defined yet. Click "+ New Skill" to create one.</span>`;
            return;
        }

        els.taxonomyGrid.innerHTML = allSkills.map(sk => {
            const count = allAssignments.filter(a => a.skill_id === sk.id).length;
            const verifiedCount = allAssignments.filter(
                a => a.skill_id === sk.id && (a.status || '').toLowerCase() === 'verified'
            ).length;

            return `
                <div class="taxonomy-card">
                    <div class="taxonomy-card-top">
                        <span class="taxonomy-cat-badge">${escapeHtml(sk.category || 'General')}</span>
                        <span class="muted-text">${count} assigned</span>
                    </div>
                    <h4>${escapeHtml(sk.name)}</h4>
                    <p>${verifiedCount} verified · ${count - verifiedCount} pending/declared</p>
                </div>
            `;
        }).join('');
    }

    function openAssignModal(empId = '', skillId = '', level = 'Beginner', status = 'Verified') {
        if (allEmployees.length === 0 || allSkills.length === 0) {
            alert('Please make sure at least one active employee and one skill exist first.');
            return;
        }

        els.assignTitle.textContent = empId && skillId ? 'Update Employee Skill' : 'Assign Employee Skill';
        if (empId) els.modalEmp.value = empId;
        if (skillId) els.modalSkill.value = skillId;
        els.modalLevel.value = level || 'Beginner';
        els.modalStatus.value = status || 'Verified';

        els.assignModal.style.display = 'flex';
    }

    function closeAssignModal() {
        els.assignModal.style.display = 'none';
    }

    function openNewSkillModal() {
        els.newSkillForm.reset();
        els.newSkillModal.style.display = 'flex';
    }

    function closeNewSkillModal() {
        els.newSkillModal.style.display = 'none';
    }

    function exportMatrixCSV() {
        const assignmentMap = new Map();
        for (const item of allAssignments) {
            assignmentMap.set(`${item.employee_id}_${item.skill_id}`, item);
        }

        const headers = ['Employee No', 'Full Name', 'Department', 'Position', ...allSkills.map(s => s.name)];
        const rows = allEmployees.map(emp => {
            const skillCols = allSkills.map(sk => {
                const rec = assignmentMap.get(`${emp.id}_${sk.id}`);
                return rec ? `${rec.level} (${rec.status})` : '';
            });
            return [emp.employee_no, emp.full_name, emp.department, emp.position, ...skillCols];
        });

        const csv = [headers, ...rows]
            .map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mcft-skills-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function loadMatrix() {
        try {
            const { employees, skills, assignments } = await api.getSkillsMatrixData();
            allEmployees = employees || [];
            allSkills = skills || [];
            allAssignments = assignments || [];

            updateSummaryCards();
            populateFilterAndModalOptions();
            renderMatrix();
            renderTaxonomy();
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error('Failed to load skills matrix:', err);
            els.tbody.innerHTML = `<tr><td colspan="2">Error loading skills matrix: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    // Filter & Search Listeners
    els.search.addEventListener('input', renderMatrix);
    els.filterDept.addEventListener('change', renderMatrix);
    els.filterCategory.addEventListener('change', renderMatrix);
    els.filterStatus.addEventListener('change', renderMatrix);

    // Table Cell Click Delegation
    els.tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.matrix-cell-btn');
        if (!btn) return;
        openAssignModal(
            btn.dataset.empId,
            btn.dataset.skillId,
            btn.dataset.level || 'Beginner',
            btn.dataset.status || 'Verified'
        );
    });

    // Header Action Buttons
    document.getElementById('btn-assign-skill').addEventListener('click', () => openAssignModal());
    document.getElementById('btn-new-skill-catalog').addEventListener('click', openNewSkillModal);
    document.getElementById('btn-export-matrix').addEventListener('click', exportMatrixCSV);

    // Modal Controls
    document.getElementById('close-assign-modal').addEventListener('click', closeAssignModal);
    document.getElementById('cancel-assign-modal').addEventListener('click', closeAssignModal);
    document.getElementById('close-new-skill-modal').addEventListener('click', closeNewSkillModal);
    document.getElementById('cancel-new-skill-modal').addEventListener('click', closeNewSkillModal);

    // Submit: Assign / Update Employee Skill
    els.assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api.upsertEmployeeSkill({
                employee_id: els.modalEmp.value,
                skill_id: els.modalSkill.value,
                level: els.modalLevel.value,
                status: els.modalStatus.value
            });
            closeAssignModal();
            await loadMatrix();
        } catch (err) {
            alert('Failed to save skill record: ' + err.message);
        }
    });

    // Submit: New Skill in Master Catalog
    els.newSkillForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = els.newSkillName.value.trim();
        const category = els.newSkillCategory.value;
        if (!name) return;

        try {
            await api.createSkill({ name, category });
            closeNewSkillModal();
            await loadMatrix();
        } catch (err) {
            alert('Failed to create skill: ' + err.message);
        }
    });

    loadMatrix();
});