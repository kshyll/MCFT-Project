const SUPABASE_URL = 'https://pmnkooqadiukqvinxyny.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

const api = {
    // =========================
    // DASHBOARD (index.html)
    // =========================
    async getDashboardStats() {
        const [employees, skills, certifications, trainings] = await Promise.all([
            run(db.from('employees').select('id, status')),
            run(db.from('employee_skills').select('id')),
            run(db.from('certifications').select('id, expires_on')),
            run(db.from('trainings').select('id, status'))
        ]);

        const today = new Date().toISOString().slice(0, 10);
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const activeEmployees = (employees || []).filter(e => e.status === 'Active').length;
        const expiringCerts = (certifications || []).filter(
            c => c.expires_on && c.expires_on >= today && c.expires_on <= in30
        ).length;
        const expiredCerts = (certifications || []).filter(
            c => c.expires_on && c.expires_on < today
        ).length;
        const pendingTrainings = (trainings || []).filter(
            t => t.status !== 'Completed'
        ).length;

        return {
            totalEmployees: (employees || []).length,
            activeEmployees,
            totalSkillRecords: (skills || []).length,
            expiringCerts,
            expiredCerts,
            pendingTrainings
        };
    },

    // =========================
    // EMPLOYEES (index.html & employees.html)
    // =========================
    async getAllEmployees(filters = {}) {
        let query = db
            .from('employees')
            .select('id, employee_no, full_name, email, department, position, status, created_at')
            .order('full_name');

        if (filters.search) {
            const clean = filters.search.replace(/[,()%*]/g, ' ');
            query = query.or(
                'full_name.ilike.%' + clean +
                '%,employee_no.ilike.%' + clean +
                '%,position.ilike.%' + clean + '%'
            );
        }
        if (filters.department) {
            query = query.eq('department', filters.department);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        return run(query);
    },

    addEmployee(values) {
        return run(db.from('employees').insert(values).select().single());
    },

    updateEmployee(id, values) {
        return run(db.from('employees').update(values).eq('id', id).select().single());
    },

    async getEmployeeProfile(employeeId) {
        const employee = await run(
            db.from('employees').select('*').eq('id', employeeId).single()
        );
        const skills = await run(
            db.from('employee_skills')
              .select('id, level, status, skills(name, category)')
              .eq('employee_id', employeeId)
        );
        const certifications = await run(
            db.from('certifications')
              .select('*')
              .eq('employee_id', employeeId)
              .order('expires_on', { ascending: true })
        );
        const trainings = await run(
            db.from('trainings')
              .select('*')
              .eq('employee_id', employeeId)
              .order('created_at', { ascending: false })
        );

        return { employee, skills, certifications, trainings };
    },

    async recordSkill({ employee_id, skill_name, level, category = 'General', status = 'Verified' }) {
        let skill = await run(
            db.from('skills').select('id').ilike('name', skill_name).maybeSingle()
        );

        if (!skill) {
            skill = await run(
                db.from('skills').insert({ name: skill_name, category }).select().single()
            );
        }

        return this.upsertEmployeeSkill({
            employee_id,
            skill_id: skill.id,
            level,
            status
        });
    },

    addCertification(values) {
        return run(db.from('certifications').insert(values).select().single());
    },

    addTraining(values) {
        return run(db.from('trainings').insert(values).select().single());
    },

    // =========================
    // SKILLS MATRIX (skills.html)
    // =========================
    async getSkillsMatrixData() {
        const [employees, skills, assignments] = await Promise.all([
            run(
                db.from('employees')
                  .select('id, employee_no, full_name, department, position, status')
                  .eq('status', 'Active')
                  .order('full_name')
            ),
            run(
                db.from('skills')
                  .select('id, name, category')
                  .order('category')
                  .order('name')
            ),
            run(
                db.from('employee_skills')
                  .select('id, employee_id, skill_id, level, status')
            )
        ]);

        return { employees, skills, assignments };
    },

    createSkill(values) {
        return run(db.from('skills').insert(values).select().single());
    },

    async upsertEmployeeSkill({ employee_id, skill_id, level, status }) {
        const existing = await run(
            db.from('employee_skills')
              .select('id')
              .eq('employee_id', employee_id)
              .eq('skill_id', skill_id)
              .maybeSingle()
        );

        if (existing && existing.id) {
            return run(
                db.from('employee_skills')
                  .update({ level, status })
                  .eq('id', existing.id)
                  .select()
                  .single()
            );
        }

        return run(
            db.from('employee_skills')
              .insert({ employee_id, skill_id, level, status })
              .select()
              .single()
        );
    },

    // =========================
    // COMPETENCIES & VERIFICATION (competencies.html)
    // =========================
    async getCompetencyRecords() {
        const [records, employees, skills] = await Promise.all([
            run(
                db.from('employee_skills')
                  .select(`
                      id,
                      employee_id,
                      skill_id,
                      level,
                      status,
                      employees ( id, employee_no, full_name, department, position ),
                      skills ( id, name, category )
                  `)
                  .order('id', { ascending: false })
            ),
            run(
                db.from('employees')
                  .select('id, employee_no, full_name, department, status')
                  .eq('status', 'Active')
                  .order('full_name')
            ),
            run(
                db.from('skills')
                  .select('id, name, category')
                  .order('name')
            )
        ]);

        return { records, employees, skills };
    },

    updateCompetencyStatus(recordId, status, level) {
        const payload = { status };
        if (level) payload.level = level;

        return run(
            db.from('employee_skills')
              .update(payload)
              .eq('id', recordId)
              .select()
              .single()
        );
    },

};