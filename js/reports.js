document.addEventListener('DOMContentLoaded', () => {
    let dataset = {
        employees: [],
        skills: [],
        employeeSkills: [],
        certifications: [],
        trainings: []
    };

    let currentExportHeaders = [];
    let currentExportRows = [];

    const els = {
        statCompleteness: document.getElementById('rep-stat-completeness'),
        statCompletenessSub: document.getElementById('rep-stat-completeness-sub'),
        statSkillRate: document.getElementById('rep-stat-skill-rate'),
        statSkillSub: document.getElementById('rep-stat-skill-sub'),
        statCertRate: document.getElementById('rep-stat-cert-rate'),
        statCertSub: document.getElementById('rep-stat-cert-sub'),
        statTrainRate: document.getElementById('rep-stat-train-rate'),
        statTrainSub: document.getElementById('rep-stat-train-sub'),
        levelBars: document.getElementById('rep-level-bars'),
        skillGaps: document.getElementById('rep-skill-gaps'),
        viewSelect: document.getElementById('rep-view-select'),
        deptFilter: document.getElementById('rep-dept-filter'),
        searchInput: document.getElementById('report-search'),
        tableTitle: document.getElementById('rep-table-title'),
        tableSubtitle: document.getElementById('rep-table-subtitle'),
        thead: document.getElementById('rep-thead'),
        tbody: document.getElementById('rep-tbody')
    };

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function certExpiryState(cert) {
        if (!cert.expires_on) return 'Active';
        const today = new Date().toISOString().slice(0, 10);
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (cert.expires_on < today) return 'Expired';
        if (cert.expires_on <= in30) return 'Expiring';
        return 'Active';
    }

    function renderKPIsAndCharts() {
        const activeEmps = dataset.employees.filter(e => e.status === 'Active');
        const totalSkills = dataset.employeeSkills.length;
        const verifiedSkills = dataset.employeeSkills.filter(s => (s.status || '').toLowerCase() === 'verified').length;

        const totalCerts = dataset.certifications.length;
        const validCerts = dataset.certifications.filter(c => certExpiryState(c) !== 'Expired').length;

        const totalTrains = dataset.trainings.length;
        const completedTrains = dataset.trainings.filter(t => t.status === 'Completed').length;

        // Profile completeness: active employees who have >= 1 skill AND (>= 1 cert OR >= 1 completed training)
        const completeEmps = activeEmps.filter(emp => {
            const hasSkill = dataset.employeeSkills.some(s => s.employee_id === emp.id);
            const hasCert = dataset.certifications.some(c => c.employee_id === emp.id);
            const hasTrain = dataset.trainings.some(t => t.employee_id === emp.id && t.status === 'Completed');
            return hasSkill && (hasCert || hasTrain);
        }).length;

        const compPct = activeEmps.length > 0 ? Math.round((completeEmps / activeEmps.length) * 100) : 0;
        const skillPct = totalSkills > 0 ? Math.round((verifiedSkills / totalSkills) * 100) : 0;
        const certPct = totalCerts > 0 ? Math.round((validCerts / totalCerts) * 100) : 0;
        const trainPct = totalTrains > 0 ? Math.round((completedTrains / totalTrains) * 100) : 0;

        els.statCompleteness.textContent = `${compPct}%`;
        els.statCompletenessSub.textContent = `${completeEmps} of ${activeEmps.length} active employees`;

        els.statSkillRate.textContent = `${skillPct}%`;
        els.statSkillSub.textContent = `${verifiedSkills} of ${totalSkills} records verified`;

        els.statCertRate.textContent = `${certPct}%`;
        els.statCertSub.textContent = `${validCerts} of ${totalCerts} non-expired`;

        els.statTrainRate.textContent = `${trainPct}%`;
        els.statTrainSub.textContent = `${completedTrains} of ${totalTrains} completed`;

        // Competency Level Distribution Bars
        const counts = { Beginner: 0, Intermediate: 0, Advanced: 0, Expert: 0 };
        for (const item of dataset.employeeSkills) {
            const lvl = (item.level || '').toLowerCase();
            if (lvl.includes('expert') || lvl === '4') counts.Expert++;
            else if (lvl.includes('advanced') || lvl === '3') counts.Advanced++;
            else if (lvl.includes('intermediate') || lvl === '2') counts.Intermediate++;
            else counts.Beginner++;
        }

        const tiers = [
            { label: 'Level 1 — Beginner', count: counts.Beginner, cls: 'lvl-1' },
            { label: 'Level 2 — Intermediate', count: counts.Intermediate, cls: 'lvl-2' },
            { label: 'Level 3 — Advanced', count: counts.Advanced, cls: 'lvl-3' },
            { label: 'Level 4 — Expert', count: counts.Expert, cls: 'lvl-4' }
        ];

        els.levelBars.innerHTML = tiers.map(t => {
            const pct = totalSkills > 0 ? Math.round((t.count / totalSkills) * 100) : 0;
            return `
                <div class="rep-bar-row">
                    <div class="rep-bar-labels">
                        <span>${t.label}</span>
                        <span>${t.count} (${pct}%)</span>
                    </div>
                    <div class="rep-bar-track">
                        <div class="rep-bar-fill ${t.cls}" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Skill Gap Watch (top 5 skills with lowest verified headcount)
        if (dataset.skills.length === 0) {
            els.skillGaps.innerHTML = `<span class="muted-text">No skills cataloged yet.</span>`;
            return;
        }

        const skillStats = dataset.skills.map(sk => {
            const verifiedCount = dataset.employeeSkills.filter(
                es => es.skill_id === sk.id && (es.status || '').toLowerCase() === 'verified'
            ).length;
            const totalAssigned = dataset.employeeSkills.filter(es => es.skill_id === sk.id).length;
            return { ...sk, verifiedCount, totalAssigned };
        }).sort((a, b) => a.verifiedCount - b.verifiedCount).slice(0, 5);

        els.skillGaps.innerHTML = skillStats.map(sk => `
            <div class="rep-gap-item">
                <div>
                    <strong>${escapeHtml(sk.name)}</strong>
                    <span>${escapeHtml(sk.category || 'General')} · ${sk.totalAssigned} total assigned</span>
                </div>
                <span class="rep-gap-pill ${sk.verifiedCount >= 3 ? 'ok' : ''}">
                    ${sk.verifiedCount} verified
                </span>
            </div>
        `).join('');
    }

    function renderActiveReport() {
        const view = els.viewSelect.value;
        const deptFilter = els.deptFilter.value;
        const query = els.searchInput.value.trim().toLowerCase();

        const empMap = new Map(dataset.employees.map(e => [e.id, e]));

        if (view === 'departments') {
            els.tableTitle.textContent = 'Department Readiness Summary';
            els.tableSubtitle.textContent = 'Headcount, verified skills, certification standing, and training completion by department.';

            const allDepts = ['IT', 'HR', 'CCS', 'Operations'];
            const targetDepts = deptFilter ? allDepts.filter(d => d === deptFilter) : allDepts;

            const headers = ['Department', 'Active Staff', 'Verified Skills', 'Active Certs', 'Expiring / Expired', 'Completed Trainings'];
            const rows = targetDepts.map(dept => {
                const emps = dataset.employees.filter(e => e.department === dept && e.status === 'Active');
                const empIds = new Set(emps.map(e => e.id));

                const verSkills = dataset.employeeSkills.filter(
                    s => empIds.has(s.employee_id) && (s.status || '').toLowerCase() === 'verified'
                ).length;

                const deptCerts = dataset.certifications.filter(c => empIds.has(c.employee_id));
                const activeCerts = deptCerts.filter(c => certExpiryState(c) === 'Active').length;
                const urgentCerts = deptCerts.filter(c => certExpiryState(c) !== 'Active').length;

                const doneTrains = dataset.trainings.filter(
                    t => empIds.has(t.employee_id) && t.status === 'Completed'
                ).length;

                return [dept, emps.length, verSkills, activeCerts, urgentCerts, doneTrains];
            }).filter(r => !query || r[0].toLowerCase().includes(query));

            currentExportHeaders = headers;
            currentExportRows = rows;

            els.thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
            els.tbody.innerHTML = rows.length
                ? rows.map(r => `
                    <tr>
                        <td><strong>${escapeHtml(r[0])}</strong></td>
                        <td>${r[1]}</td>
                        <td>${r[2]}</td>
                        <td>${r[3]}</td>
                        <td>${r[4] > 0 ? `<span class="status expiring-status">${r[4]}</span>` : '0'}</td>
                        <td>${r[5]}</td>
                    </tr>
                `).join('')
                : `<tr><td colspan="6">No departments match the current filter.</td></tr>`;
        } else if (view === 'skills') {
            els.tableTitle.textContent = 'Skill Coverage & Gap Analysis';
            els.tableSubtitle.textContent = 'Number of qualified employees per cataloged skill across proficiency tiers.';

            const headers = ['Skill Name', 'Category', 'Verified Staff', 'Pending / Declared', 'Advanced & Expert'];
            const filteredEmployees = deptFilter
                ? new Set(dataset.employees.filter(e => e.department === deptFilter).map(e => e.id))
                : null;

            const rows = dataset.skills.map(sk => {
                const records = dataset.employeeSkills.filter(es => {
                    if (es.skill_id !== sk.id) return false;
                    if (filteredEmployees && !filteredEmployees.has(es.employee_id)) return false;
                    return true;
                });

                const verified = records.filter(r => (r.status || '').toLowerCase() === 'verified').length;
                const pending = records.length - verified;
                const senior = records.filter(r => {
                    const lvl = (r.level || '').toLowerCase();
                    return lvl.includes('advanced') || lvl.includes('expert') || lvl === '3' || lvl === '4';
                }).length;

                return [sk.name, sk.category || 'General', verified, pending, senior];
            }).filter(r => !query || `${r[0]} ${r[1]}`.toLowerCase().includes(query));

            currentExportHeaders = headers;
            currentExportRows = rows;

            els.thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
            els.tbody.innerHTML = rows.length
                ? rows.map(r => `
                    <tr>
                        <td><strong>${escapeHtml(r[0])}</strong></td>
                        <td>${escapeHtml(r[1])}</td>
                        <td>${r[2]}</td>
                        <td>${r[3]}</td>
                        <td>${r[4]}</td>
                    </tr>
                `).join('')
                : `<tr><td colspan="5">No skills match the current filter.</td></tr>`;
        } else if (view === 'compliance') {
            els.tableTitle.textContent = 'Certification Expiration & Compliance Report';
            els.tableSubtitle.textContent = 'Complete audit trail of employee certifications and expiration states.';

            const headers = ['Employee No', 'Employee Name', 'Department', 'Certification', 'Issuer', 'Expires On', 'Status'];
            const rows = dataset.certifications.map(c => {
                const emp = empMap.get(c.employee_id) || {};
                return {
                    dept: emp.department || '',
                    cols: [
                        emp.employee_no || '',
                        emp.full_name || 'Unknown',
                        emp.department || 'Unassigned',
                        c.name || '',
                        c.issuer || '—',
                        c.expires_on || 'No expiry',
                        certExpiryState(c)
                    ]
                };
            }).filter(item => {
                if (deptFilter && item.dept !== deptFilter) return false;
                if (query && !item.cols.join(' ').toLowerCase().includes(query)) return false;
                return true;
            }).map(item => item.cols);

            currentExportHeaders = headers;
            currentExportRows = rows;

            els.thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
            els.tbody.innerHTML = rows.length
                ? rows.map(r => {
                    const badgeCls = r[6] === 'Expired'
                        ? 'expired-status'
                        : r[6] === 'Expiring'
                            ? 'expiring-status'
                            : 'active-status';
                    return `
                        <tr>
                            <td>${escapeHtml(r[0])}</td>
                            <td><strong>${escapeHtml(r[1])}</strong></td>
                            <td>${escapeHtml(r[2])}</td>
                            <td>${escapeHtml(r[3])}</td>
                            <td>${escapeHtml(r[4])}</td>
                            <td>${escapeHtml(r[5])}</td>
                            <td><span class="status ${badgeCls}">${escapeHtml(r[6])}</span></td>
                        </tr>
                    `;
                }).join('')
                : `<tr><td colspan="7">No certification records match the current filter.</td></tr>`;
        } else {
            els.tableTitle.textContent = 'Employee Qualification Roster';
            els.tableSubtitle.textContent = 'Individual summary of verified skills, certifications, and completed trainings per employee.';

            const headers = ['Employee No', 'Full Name', 'Department', 'Position', 'Verified Skills', 'Active Certs', 'Completed Trainings'];
            const rows = dataset.employees
                .filter(e => e.status === 'Active')
                .filter(e => !deptFilter || e.department === deptFilter)
                .map(emp => {
                    const verSkills = dataset.employeeSkills.filter(
                        s => s.employee_id === emp.id && (s.status || '').toLowerCase() === 'verified'
                    ).length;
                    const activeCerts = dataset.certifications.filter(
                        c => c.employee_id === emp.id && certExpiryState(c) !== 'Expired'
                    ).length;
                    const doneTrains = dataset.trainings.filter(
                        t => t.employee_id === emp.id && t.status === 'Completed'
                    ).length;

                    return [
                        emp.employee_no || '',
                        emp.full_name || '',
                        emp.department || 'Unassigned',
                        emp.position || '—',
                        verSkills,
                        activeCerts,
                        doneTrains
                    ];
                })
                .filter(r => !query || r.join(' ').toLowerCase().includes(query));

            currentExportHeaders = headers;
            currentExportRows = rows;

            els.thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
            els.tbody.innerHTML = rows.length
                ? rows.map(r => `
                    <tr>
                        <td>${escapeHtml(r[0])}</td>
                        <td><strong>${escapeHtml(r[1])}</strong></td>
                        <td>${escapeHtml(r[2])}</td>
                        <td>${escapeHtml(r[3])}</td>
                        <td>${r[4]}</td>
                        <td>${r[5]}</td>
                        <td>${r[6]}</td>
                    </tr>
                `).join('')
                : `<tr><td colspan="7">No active employees match the current filter.</td></tr>`;
        }
    }

    async function loadReports() {
        try {
            dataset = await api.getReportsDataset();
            renderKPIsAndCharts();
            renderActiveReport();
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error('Failed to load reports:', err);
            els.tbody.innerHTML = `<tr><td>Error loading reports: ${escapeHtml(err.message)}</td></tr>`;
        }
    }

    // Listeners
    els.viewSelect.addEventListener('change', renderActiveReport);
    els.deptFilter.addEventListener('change', renderActiveReport);
    els.searchInput.addEventListener('input', renderActiveReport);

    document.getElementById('btn-print-report').addEventListener('click', () => window.print());

    document.getElementById('btn-export-report').addEventListener('click', () => {
        const viewName = els.viewSelect.value;
        const csv = [currentExportHeaders, ...currentExportRows]
            .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcft-report-${viewName}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    loadReports();
});