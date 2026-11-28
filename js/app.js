function showText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}
function makeSafe(text) {
    if (text === null || text === undefined) {
        return '';
    }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
async function checkLogin() {
    const result = await db.auth.getSession();
    const session = result.data.session;
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    showText('user-name', session.user.email);
    return session;
}

function setupLogoutButton() {
    const button = document.getElementById('logout-button');
    if (!button) {
        return;
    }
    button.addEventListener('click', async function () {
        await db.auth.signOut();
        window.location.href = 'login.html';
    });
}
let latestSummary = null;

async function loadSummaryCards() {
    try {
        const s = await api.getSummary();
        latestSummary = s;
        showText('total-employees', s.totalEmployees);
        showText('employees-note', s.activeEmployees + ' Active · ' + s.inactiveEmployees + ' Inactive');
        showText('active-certifications', s.activeCerts);
        showText('active-certs-note', s.percentWithActiveCert + '% of total employees');
        showText('expiring-certifications', s.expiringCerts);
        showText('expired-certifications', s.expiredCerts);
        showText('pending-verification', s.pendingCerts);
        showText('training-completion', s.trainingRate + '%');
        showText('training-completed', s.trainingCompleted);
        showText('training-in-progress', s.trainingInProgress);
        showText('training-not-completed', s.trainingNotCompleted);
        showText('most-skill', s.mostSkill);
        showText('least-skill', s.leastSkill);
        showText('quality-score', s.qualityScore + '%');
        showText('missing-skills', s.missingSkills + '%');
        showText('missing-certifications', s.missingCerts + '%');
        showText('missing-training', s.missingTraining + '%');
        const bar = document.getElementById('quality-bar');
        if (bar) {
            bar.style.width = s.qualityScore + '%';
        }
    } catch (error) {
        console.error('Summary failed:', error.message);
        showText('employees-note', 'Error: ' + error.message);
    }
}
async function loadEmployees(searchText) {
    const tbody = document.getElementById('employee-rows');
    if (!tbody) {
        return;
    }

    try {
        const employees = await api.getEmployees(searchText, 10);

        if (employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No employees found</td></tr>';
            return;
        }

        let rowsHtml = '';
        for (const emp of employees) {
            const badgeClass = emp.status === 'Active' ? 'status active-status' : 'status';
            rowsHtml +=
                '<tr>' +
                    '<td>' + makeSafe(emp.full_name) + '</td>' +
                    '<td>' + makeSafe(emp.department) + '</td>' +
                    '<td>' + makeSafe(emp.position) + '</td>' +
                    '<td><span class="' + badgeClass + '">' + makeSafe(emp.status) + '</span></td>' +
                    '<td><a href="employees.html?id=' + encodeURIComponent(emp.id) + '">View</a></td>' +
                '</tr>';
        }
        tbody.innerHTML = rowsHtml;
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error: ' + makeSafe(error.message) + '</td></tr>';
    }
}

function setupSearchBox() {
    const searchInput = document.getElementById('employee-search-input');
    if (!searchInput) {
        return;
    }
    let waitTimer;
    searchInput.addEventListener('input', function () {
        clearTimeout(waitTimer);
        waitTimer = setTimeout(function () {
            loadEmployees(searchInput.value.trim());
        }, 300);
    });
}

const QUICK_ACTIONS = {
    'add-employee': {
        title: 'Add Employee',
        fields: [
            { name: 'employee_no', label: 'Employee number', type: 'text', required: true },
            { name: 'full_name',   label: 'Full name',       type: 'text', required: true },
            { name: 'department',  label: 'Department',      type: 'text' },
            { name: 'position',    label: 'Position',        type: 'text' }
        ],
        save: function (values) { return api.addEmployee(values); }
    },

    'record-skill': {
        title: 'Record Skill',
        fields: [
            { name: 'employee_id', label: 'Employee',        type: 'employee', required: true },
            { name: 'skill_name',  label: 'Skill',           type: 'text', required: true },
            { name: 'level',       label: 'Level (1 = beginner, 5 = expert)', type: 'select',
              options: ['1', '2', '3', '4', '5'] }
        ],
        save: function (values) { return api.recordSkill(values); }
    },

    'add-certification': {
        title: 'Add Certification',
        fields: [
            { name: 'employee_id', label: 'Employee',         type: 'employee', required: true },
            { name: 'name',        label: 'Certification name', type: 'text', required: true },
            { name: 'issued_on',   label: 'Issued on',        type: 'date' },
            { name: 'expires_on',  label: 'Expires on',       type: 'date' }
        ],
        save: function (values) { return api.addCertification(values); }
    },

    'add-training': {
        title: 'Add Training Record',
        fields: [
            { name: 'employee_id', label: 'Employee',       type: 'employee', required: true },
            { name: 'title',       label: 'Training title', type: 'text', required: true },
            { name: 'status',      label: 'Status',         type: 'select',
              options: ['Not Completed', 'In Progress', 'Completed'] }
        ],
        save: function (values) { return api.addTraining(values); }
    }
};
function buildFieldHtml(field, employees) {
    const id = 'field-' + field.name;
    let input = '';

    if (field.type === 'employee') {
        input = '<select id="' + id + '"><option value="">Choose employee...</option>';
        for (const e of employees) {
            input += '<option value="' + makeSafe(e.id) + '">' +
                     makeSafe(e.full_name) + ' (' + makeSafe(e.employee_no) + ')</option>';
        }
        input += '</select>';
    } else if (field.type === 'select') {
        input = '<select id="' + id + '">';
        for (const option of field.options) {
            input += '<option>' + makeSafe(option) + '</option>';
        }
        input += '</select>';
    } else {
        input = '<input id="' + id + '" type="' + field.type + '">';
    }

    return '<label>' + makeSafe(field.label) + (field.required ? ' *' : '') + input + '</label>';
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}
async function openQuickAction(actionKey) {
    const action = QUICK_ACTIONS[actionKey];
    if (!action) {
        return;
    }
    let employees = [];
    let needsEmployees = false;
    for (const f of action.fields) {
        if (f.type === 'employee') { needsEmployees = true; }
    }
    if (needsEmployees) {
        try {
            employees = await api.getEmployees('', 500);
        } catch (error) {
            alert('Could not load employees: ' + error.message);
            return;
        }
    }
    let fieldsHtml = '';
    for (const f of action.fields) {
        fieldsHtml += buildFieldHtml(f, employees);
    }

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
        '<form class="modal" id="modal-form">' +
            '<h3>' + makeSafe(action.title) + '</h3>' +
            fieldsHtml +
            '<p class="modal-error" id="modal-error"></p>' +
            '<div class="modal-buttons">' +
                '<button type="button" id="modal-cancel">Cancel</button>' +
                '<button type="submit" class="save-btn" id="modal-save">Save</button>' +
            '</div>' +
        '</form>';
    document.body.appendChild(overlay);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (event) {
        if (event.target === overlay) { closeModal(); }
    });
    document.getElementById('modal-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        const errorBox = document.getElementById('modal-error');
        errorBox.textContent = '';
        const values = {};
        for (const f of action.fields) {
            const text = document.getElementById('field-' + f.name).value.trim();
            if (f.required && text === '') {
                errorBox.textContent = f.label + ' is required.';
                return;
            }
            values[f.name] = text === '' ? null : text;
        }
        const saveButton = document.getElementById('modal-save');
        saveButton.disabled = true;
        try {
            await action.save(values);
            closeModal();
            loadSummaryCards();
            loadEmployees('');
        } catch (error) {
            errorBox.textContent = error.message;
            saveButton.disabled = false;
        }
    });
}
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeModal(); }
});
function setupQuickActions() {
    const buttons = document.querySelectorAll('[data-action]');
    for (const button of buttons) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            const key = button.getAttribute('data-action');
            if (key === 'generate-report') {
                downloadReport();
            } else {
                openQuickAction(key);
            }
        });
    }
}
async function downloadReport() {
    if (!latestSummary) {
        await loadSummaryCards();
    }
    if (!latestSummary) {
        alert('No data to report yet.');
        return;
    }

    const s = latestSummary;
    const rows = [
        ['Metric', 'Value'],
        ['Total employees', s.totalEmployees],
        ['Active employees', s.activeEmployees],
        ['Inactive employees', s.inactiveEmployees],
        ['Active certifications', s.activeCerts],
        ['Expiring within 30 days', s.expiringCerts],
        ['Expired certifications', s.expiredCerts],
        ['Pending verification', s.pendingCerts],
        ['Training completed', s.trainingCompleted],
        ['Training in progress', s.trainingInProgress],
        ['Training not completed', s.trainingNotCompleted],
        ['Training completion rate (%)', s.trainingRate],
        ['Most covered skill', s.mostSkill],
        ['Least covered skill', s.leastSkill],
        ['Profile completeness (%)', s.qualityScore]
    ];

    let csv = '';
    for (const row of rows) {
        csv += '"' + String(row[0]).replace(/"/g, '""') + '",' +
               '"' + String(row[1]).replace(/"/g, '""') + '"\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mcft-report-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}
document.addEventListener('DOMContentLoaded', async function () {
    const session = await checkLogin();
    if (!session) {
        return;
    }
    setupLogoutButton();
    setupSearchBox();
    setupQuickActions();
    loadSummaryCards();
    loadEmployees('');
});