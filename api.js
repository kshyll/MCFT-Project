const SUPABASE_URL = "https://pmnkooqadiukqvinxyny.supabase.co";
const SUPABASE_KEY = "sb_publishable__xcv8rWT-h-EEDuhFqSBAA_w5kdf_PR";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
async function run(query) {
    const result = await query;
    if (result.error) {
        throw new Error(result.error.message);
    }
    return result.data;
}
function pct(part, whole) {
    if (whole === 0) {
        return 0;
    }
    return Math.round((part / whole) * 100);
}

const api = {
    async getEmployees(searchText, limit) {
        let query = db
            .from('employees')
            .select('id, employee_no, full_name, department, position, status')
            .order('full_name')
            .limit(limit || 10);

        if (searchText) {
            const clean = searchText.replace(/[,()%*]/g, ' ');
            query = query.or('full_name.ilike.%' + clean + '%,employee_no.ilike.%' + clean + '%');
        }
        return run(query);
    },
    addEmployee(values) {
        return run(db.from('employees').insert(values));
    },
    addCertification(values) {
        return run(db.from('certifications').insert(values));
    },
    addTraining(values) {
        return run(db.from('trainings').insert(values));
    },
    async recordSkill(values) {
        const skillName = values.skill_name.trim();
        const found = await run(db.from('skills').select('id').eq('name', skillName).limit(1));

        let skillId;
        if (found.length > 0) {
            skillId = found[0].id;
        } else {
            const created = await run(db.from('skills').insert({ name: skillName }).select('id').single());
            skillId = created.id;
        }
        return run(
            db.from('employee_skills').upsert(
                { employee_id: values.employee_id, skill_id: skillId, level: Number(values.level) },
                { onConflict: 'employee_id,skill_id' }
            )
        );
    },
    async getSummary() {
        const employees  = await run(db.from('employees').select('id, status'));
        const certs      = await run(db.from('certifications').select('employee_id, expires_on, verified'));
        const trainings  = await run(db.from('trainings').select('employee_id, status'));
        const empSkills  = await run(db.from('employee_skills').select('employee_id, skills(name)'));

        const today = new Date().toISOString().slice(0, 10);
        const in30  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const totalEmployees = employees.length;
        let activeEmployees = 0;
        for (const e of employees) {
            if (e.status === 'Active') { activeEmployees++; }
        }
        let active = 0, expiring = 0, expired = 0, pending = 0;
        const employeesWithActiveCert = new Set();
        const employeesWithAnyCert = new Set();

        for (const c of certs) {
            employeesWithAnyCert.add(c.employee_id);

            if (c.expires_on !== null && c.expires_on < today) {
                expired++;
            } else {
                active++;
                employeesWithActiveCert.add(c.employee_id);
                if (c.expires_on !== null && c.expires_on <= in30) {
                    expiring++;
                }
            }
            if (c.verified === false) { pending++; }
        }
        let completed = 0, inProgress = 0, notCompleted = 0;
        const employeesWithTraining = new Set();
        for (const t of trainings) {
            employeesWithTraining.add(t.employee_id);
            if (t.status === 'Completed') { completed++; }
            else if (t.status === 'In Progress') { inProgress++; }
            else { notCompleted++; }
        }
        const employeesWithSkill = new Set();
        const skillCounts = {};
        for (const s of empSkills) {
            employeesWithSkill.add(s.employee_id);
            const name = s.skills ? s.skills.name : null;
            if (name) {
                skillCounts[name] = (skillCounts[name] || 0) + 1;
            }
        }
        const skillNames = Object.keys(skillCounts).sort(function (a, b) {
            return skillCounts[b] - skillCounts[a];
        });
        let complete = 0;
        for (const e of employees) {
            if (employeesWithSkill.has(e.id) && employeesWithAnyCert.has(e.id) && employeesWithTraining.has(e.id)) {
                complete++;
            }
        }

        return {
            totalEmployees: totalEmployees,
            activeEmployees: activeEmployees,
            inactiveEmployees: totalEmployees - activeEmployees,
            activeCerts: active,
            expiringCerts: expiring,
            expiredCerts: expired,
            pendingCerts: pending,
            percentWithActiveCert: pct(employeesWithActiveCert.size, totalEmployees),
            trainingCompleted: completed,
            trainingInProgress: inProgress,
            trainingNotCompleted: notCompleted,
            trainingRate: pct(completed, trainings.length),
            mostSkill: skillNames.length > 0 ? skillNames[0] : '-',
            leastSkill: skillNames.length > 0 ? skillNames[skillNames.length - 1] : '-',
            qualityScore: pct(complete, totalEmployees),
            missingSkills: pct(totalEmployees - employeesWithSkill.size, totalEmployees),
            missingCerts: pct(totalEmployees - employeesWithAnyCert.size, totalEmployees),
            missingTraining: pct(totalEmployees - employeesWithTraining.size, totalEmployees)
        };
    }
};