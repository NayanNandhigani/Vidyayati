import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEFAULT_PASSWORD = "12345";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — re-running `npm run db:seed` after a
// wipe produces the same dataset every time.
// ---------------------------------------------------------------------------
function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
const rng = makeRng(seedFromString("vidyayati-single-school-seed-v1"));
function pick<T>(arr: T[], r: () => number = rng): T {
  return arr[Math.floor(r() * arr.length)];
}
function randInt(min: number, max: number, r: () => number = rng): number {
  return min + Math.floor(r() * (max - min + 1));
}
function daysAgo(n: number, from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fyLabel(d: Date): string {
  const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${fyStart}–${String(fyStart + 1).slice(2)}`;
}

const FIRST_NAMES_ADULT = [
  "Anita", "Ravi", "Suresh", "Priya", "Arjun", "Kavya", "Radhika", "Vikram", "Deepa", "Manoj",
  "Sunita", "Rajesh", "Neha", "Amit", "Pooja", "Sanjay", "Lakshmi", "Vishal", "Meera", "Ashok",
  "Geeta", "Rahul", "Shalini", "Vikas", "Anjali", "Nikhil", "Divya", "Karthik", "Swati", "Rohit",
  "Nandini", "Farhan", "Ayesha", "Imran", "Kiran", "Latha", "Mohan", "Nisha", "Prakash", "Ritu",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Menon", "Reddy", "Rao", "Patel", "Shah",
  "Mehta", "Kapoor", "Malhotra", "Chatterjee", "Bose", "Das", "Kulkarni", "Deshpande", "Joshi", "Pillai",
  "Nambiar", "Bhat", "Hegde", "Krishnan", "Subramaniam", "Chauhan", "Yadav", "Mishra", "Tiwari", "Pandey",
];
const FIRST_NAMES_CHILD = [
  "Aarav", "Vihaan", "Aditya", "Vivaan", "Reyansh", "Arjun", "Sai", "Ayaan", "Krishna", "Ishaan",
  "Rohan", "Karan", "Aryan", "Dhruv", "Kabir", "Yash", "Rudra", "Om", "Advait", "Shaurya",
  "Ananya", "Diya", "Saanvi", "Aadhya", "Kavya", "Myra", "Anika", "Ira", "Riya", "Pari",
  "Sara", "Navya", "Aarohi", "Prisha", "Amaira", "Meera", "Nitya", "Tara", "Zara", "Rhea",
];
const DESIGNATIONS = [
  "Class Teacher", "Subject Teacher — Mathematics", "Subject Teacher — English", "Subject Teacher — Science",
  "Subject Teacher — Social Studies", "Physical Education Teacher", "Librarian", "Accountant",
  "Front Office Executive", "Lab Assistant", "Counsellor", "Hostel Warden", "Transport Coordinator",
];
const DEPARTMENTS = ["Academics", "Administration", "Accounts", "Sports", "Library", "Hostel", "Transport"];
const PAYMENT_METHODS = ["Bank transfer", "UPI", "Cash", "Cheque"];
const RELATIONS: ("FATHER" | "MOTHER" | "GUARDIAN")[] = ["FATHER", "MOTHER", "GUARDIAN"];
const SUBJECT_NAMES = ["Mathematics", "English", "Science", "Social Studies", "Hindi", "Computer Science"];
const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const SECTIONS = ["A", "B"];

const usedUsernames = new Set<string>();
function usernameFor(first: string, last: string): string {
  const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
  let candidate = base;
  let n = 2;
  while (usedUsernames.has(candidate)) {
    candidate = `${base}${n}`;
    n++;
  }
  usedUsernames.add(candidate);
  return candidate;
}

const SCHOOL_ID = "sch-demo";
const SCHOOL_CODE = "GWD0001";

async function wipeExistingSchools() {
  const existing = await db.school.findMany({ select: { id: true, name: true } });
  if (existing.length === 0) return;
  console.log(`Removing ${existing.length} existing school(s) and all their data...`);
  // Every tenant-scoped model cascades from School (onDelete: Cascade
  // throughout the schema — see lib/tenant-db.ts's header comment) —
  // deleting the School rows is enough to clean up everything under them.
  await db.school.deleteMany({});
}

async function main() {
  const now = new Date();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await wipeExistingSchools();

  // --- Super Admin (platform-level, no schoolId) --------------------------
  await db.user.upsert({
    where: { username: "vidyayati" },
    update: {},
    create: { username: "vidyayati", name: "Vidya Yati Platform Admin", role: "SUPER_ADMIN", passwordHash, mustChangePassword: false },
  });
  usedUsernames.add("vidyayati");

  // --- Platform chart of accounts (Vidya Yati's own bookkeeping) ----------
  const CHART_OF_ACCOUNTS: { id: string; name: string; type: "INCOME" | "EXPENSE"; code: string }[] = [
    { id: "la-subscription-revenue", name: "Subscription Revenue", type: "INCOME", code: "4000" },
    { id: "la-other-income", name: "Other Income", type: "INCOME", code: "4900" },
    { id: "la-hosting", name: "Hosting & Infrastructure", type: "EXPENSE", code: "5000" },
    { id: "la-salaries", name: "Salaries & Payroll", type: "EXPENSE", code: "5100" },
    { id: "la-software", name: "Software & Tools", type: "EXPENSE", code: "5200" },
    { id: "la-marketing", name: "Marketing & Sales", type: "EXPENSE", code: "5300" },
    { id: "la-office", name: "Office & Admin", type: "EXPENSE", code: "5400" },
    { id: "la-professional-fees", name: "Professional Fees", type: "EXPENSE", code: "5500" },
    { id: "la-taxes", name: "Taxes & Compliance", type: "EXPENSE", code: "5600" },
    { id: "la-misc", name: "Miscellaneous", type: "EXPENSE", code: "5900" },
  ];
  await Promise.all(CHART_OF_ACCOUNTS.map((a) => db.ledgerAccount.upsert({ where: { id: a.id }, update: {}, create: a })));

  console.log("Seeding one comprehensive demo school...");
  const result = await seedDemoSchool(now, passwordHash);

  console.log("\nSeed complete.");
  console.log(`  Super Admin: vidyayati / ${DEFAULT_PASSWORD}`);
  console.log(`  School Admin: ${result.adminUsername} / ${DEFAULT_PASSWORD}`);
  console.log(`  Sample Staff: ${result.staffUsername} / ${DEFAULT_PASSWORD}`);
  console.log(`  Sample Parent: ${result.parentUsername} / ${DEFAULT_PASSWORD}`);
}

async function seedDemoSchool(now: Date, passwordHash: string) {
  // ==========================================================================
  // 1. SCHOOL CORE
  // ==========================================================================
  await db.school.create({
    data: {
      id: SCHOOL_ID,
      code: SCHOOL_CODE,
      name: "Greenwood International School",
      city: "Bengaluru",
      state: "Karnataka",
      status: "ACTIVE",
      relationshipManager: "Radhika Menon",
      salesStage: "WON",
      onboardedOn: daysAgo(400, now),
      country: "India",
      addressLine: "48, Kanakapura Main Road",
      district: "Bengaluru Urban",
      postalCode: "560062",
      udiseCode: "29140100123",
      affiliationBoard: "CBSE",
      affiliationNumber: "830123",
      admissionNoPrefix: "GWD",
      attendanceDefaulterThresholdPct: 75,
      consecutiveAbsenceAlertDays: 3,
      homeworkGraceDays: 2,
      feeLateFinePerDay: 50,
      feeLateFineGraceDays: 5,
      pfPercent: 12,
      esiPercent: 0.75,
      ptFixedAmount: 200,
      tdsPercent: 2,
      libraryFineRatePerDay: 2,
      libraryFineGraceDays: 3,
    },
  });

  const [adminFirst, adminLast] = ["Sanjay", "Bisht"];
  const adminUsername = usernameFor(adminFirst, adminLast);
  const adminUser = await db.user.create({
    data: {
      schoolId: SCHOOL_ID,
      name: `${adminFirst} ${adminLast}`,
      username: adminUsername,
      phone: `9${randInt(100000000, 999999999)}`,
      role: "SCHOOL_ADMIN",
      passwordHash,
      mustChangePassword: false,
      lastLoginAt: daysAgo(0, now),
    },
  });

  const fyStartYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const yearStart = new Date(fyStartYear, 5, 1);
  const yearEnd = new Date(fyStartYear + 1, 3, 30);
  const year = await db.academicYear.create({
    data: { schoolId: SCHOOL_ID, label: `${fyStartYear}–${String(fyStartYear + 1).slice(2)}`, startDate: yearStart, endDate: yearEnd, isCurrent: true },
  });

  const gradeScale = await db.gradeScale.create({ data: { schoolId: SCHOOL_ID, name: "CBSE 10-point", isActive: true } });
  await db.gradeBand.createMany({
    data: [
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "A1", minPercent: 90, maxPercent: 100, remark: "Outstanding" },
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "A2", minPercent: 80, maxPercent: 89.99, remark: "Excellent" },
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "B1", minPercent: 70, maxPercent: 79.99, remark: "Very Good" },
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "B2", minPercent: 60, maxPercent: 69.99, remark: "Good" },
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "C1", minPercent: 50, maxPercent: 59.99, remark: "Fair" },
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "C2", minPercent: 40, maxPercent: 49.99, remark: "Needs Improvement" },
      { schoolId: SCHOOL_ID, scaleId: gradeScale.id, label: "D", minPercent: 0, maxPercent: 39.99, remark: "Below Average" },
    ],
  });
  await db.academicYear.update({ where: { id: year.id }, data: { gradeScaleId: gradeScale.id } });

  const term1 = await db.term.create({ data: { schoolId: SCHOOL_ID, yearId: year.id, name: "Term 1", startDate: yearStart, endDate: new Date(fyStartYear, 8, 30), isCurrent: false } });
  const term2 = await db.term.create({ data: { schoolId: SCHOOL_ID, yearId: year.id, name: "Term 2", startDate: new Date(fyStartYear, 9, 1), endDate: yearEnd, isCurrent: true } });

  const academicGrades = await db.academicGrade.createManyAndReturn({
    data: GRADES.map((g, i) => ({ schoolId: SCHOOL_ID, yearId: year.id, name: g, sequence: i + 1 })),
  });
  const academicGradeByName = new Map(academicGrades.map((g) => [g.name, g]));

  const subjects = await db.subject.createManyAndReturn({
    data: SUBJECT_NAMES.map((name) => ({ schoolId: SCHOOL_ID, name })),
  });

  console.log("  ✓ School core (year, terms, grade scale, academic grades, subjects)");

  // ==========================================================================
  // 2. PEOPLE — Staff
  // ==========================================================================
  const STAFF_COUNT = 24;
  const staffUserRows = Array.from({ length: STAFF_COUNT }, () => {
    const first = pick(FIRST_NAMES_ADULT);
    const last = pick(LAST_NAMES);
    return {
      schoolId: SCHOOL_ID,
      name: `${first} ${last}`,
      username: usernameFor(first, last),
      phone: `9${randInt(100000000, 999999999)}`,
      role: "STAFF" as const,
      passwordHash,
      mustChangePassword: false,
      lastLoginAt: rng() < 0.7 ? daysAgo(randInt(0, 10), now) : null,
    };
  });
  const staffUsers = await db.user.createManyAndReturn({ data: staffUserRows });

  const staffProfileRows = staffUsers.map((u, i) => ({
    schoolId: SCHOOL_ID,
    userId: u.id,
    designation: DESIGNATIONS[i % DESIGNATIONS.length],
    department: pick(DEPARTMENTS),
    staffCategory: (i < 18 ? "TEACHING" : "NON_TEACHING") as "TEACHING" | "NON_TEACHING",
    dateJoined: daysAgo(randInt(60, 1200), now),
    employmentStatus: "ACTIVE" as const,
    qualifications: pick(["B.Ed, M.A.", "B.Sc, B.Ed", "M.Sc", "M.A., B.Ed", "MBA"]),
    specialization: pick(["Mathematics", "English", "Science", "Social Studies", "Computer Science", "Physical Education"]),
    shiftStart: "08:30",
    mobilePrimary: `9${randInt(100000000, 999999999)}`,
    employmentType: "Full-time",
  }));
  const staffProfiles = await db.staffProfile.createManyAndReturn({ data: staffProfileRows });

  await db.staffPermission.createMany({
    data: staffProfiles.flatMap((sp) => [
      { schoolId: SCHOOL_ID, staffId: sp.id, moduleName: "Attendance", accessLevel: "EDIT" as const },
      { schoolId: SCHOOL_ID, staffId: sp.id, moduleName: "Homework", accessLevel: "EDIT" as const },
      { schoolId: SCHOOL_ID, staffId: sp.id, moduleName: "Exams", accessLevel: "EDIT" as const },
      { schoolId: SCHOOL_ID, staffId: sp.id, moduleName: "Timetable", accessLevel: "VIEW" as const },
      { schoolId: SCHOOL_ID, staffId: sp.id, moduleName: "Fees", accessLevel: "NONE" as const },
    ]),
  });

  const teachingStaff = staffProfiles.slice(0, 18);
  console.log("  ✓ Staff (24, with profiles + permissions)");

  // ==========================================================================
  // 3. CLASSES + CLASS TEACHERS
  // ==========================================================================
  const classRows = GRADES.flatMap((grade) => SECTIONS.map((section) => ({ schoolId: SCHOOL_ID, yearId: year.id, grade, section, academicGradeId: academicGradeByName.get(grade)!.id })));
  const classesRaw = await db.class.createManyAndReturn({ data: classRows });
  // Assign a class teacher round-robin from the teaching staff.
  const classes = [];
  for (let i = 0; i < classesRaw.length; i++) {
    const teacher = teachingStaff[i % teachingStaff.length];
    const updated = await db.class.update({ where: { id: classesRaw[i].id }, data: { classTeacherStaffId: teacher.id, board: "CBSE", maxStrength: 40 } });
    await db.staffPermission.upsert({
      where: { staffId_moduleName_classId: { staffId: teacher.id, moduleName: "Attendance", classId: updated.id } },
      update: { accessLevel: "EDIT" },
      create: { schoolId: SCHOOL_ID, staffId: teacher.id, moduleName: "Attendance", classId: updated.id, accessLevel: "EDIT" },
    });
    classes.push(updated);
  }

  // Subject-teacher assignments, round-robin.
  await db.classSubjectTeacher.createMany({
    data: classes.flatMap((c, ci) => subjects.map((s, si) => ({ schoolId: SCHOOL_ID, classId: c.id, subjectId: s.id, staffId: teachingStaff[(ci + si) % teachingStaff.length].id }))),
  });

  console.log("  ✓ Classes (20, with class teachers + subject-teacher assignments)");

  // ==========================================================================
  // 4. STUDENTS + ENROLLMENT + PARENTS
  // ==========================================================================
  const STUDENTS_PER_CLASS = 10;
  const studentRows = classes.flatMap((cls) => {
    const gradeNum = Number(cls.grade);
    return Array.from({ length: STUDENTS_PER_CLASS }, (_, i) => {
      const age = 5 + gradeNum;
      const dob = new Date(now.getFullYear() - age, randInt(0, 11), randInt(1, 28));
      const gender = rng() < 0.5 ? ("MALE" as const) : ("FEMALE" as const);
      return {
        schoolId: SCHOOL_ID,
        classId: cls.id,
        admissionNo: "", // set below once we know the running index
        firstName: pick(FIRST_NAMES_CHILD),
        surname: pick(LAST_NAMES),
        dob,
        gender,
        status: "ACTIVE" as const,
        bloodGroup: pick(["O+", "A+", "B+", "AB+", "O-", "A-"]),
      };
    });
  });
  studentRows.forEach((s, i) => (s.admissionNo = `GWD-${String(1000 + i)}`));
  const students = await db.student.createManyAndReturn({ data: studentRows });

  // Enrollment — one per student for the current year.
  await db.enrollment.createMany({
    data: students.map((s) => ({ schoolId: SCHOOL_ID, studentId: s.id, academicYearId: year.id, classId: s.classId, status: "ACTIVE" as const, enrolledOn: daysAgo(randInt(30, 300), now) })),
  });

  // Parents — one per student, linked.
  const parentUserRows = students.map(() => {
    const first = pick(FIRST_NAMES_ADULT);
    const last = pick(LAST_NAMES);
    return {
      schoolId: SCHOOL_ID,
      name: `${first} ${last}`,
      username: usernameFor(first, last),
      phone: `9${randInt(100000000, 999999999)}`,
      role: "PARENT" as const,
      passwordHash,
      mustChangePassword: false,
      lastLoginAt: rng() < 0.5 ? daysAgo(randInt(0, 20), now) : null,
    };
  });
  const parentUsers = await db.user.createManyAndReturn({ data: parentUserRows });
  const parentRows = parentUsers.map((u) => ({ schoolId: SCHOOL_ID, userId: u.id, name: u.name, phone: u.phone }));
  const parents = await db.parent.createManyAndReturn({ data: parentRows });
  await db.studentParentLink.createMany({
    data: students.map((s, i) => ({ schoolId: SCHOOL_ID, studentId: s.id, parentId: parents[i].id, relation: pick(RELATIONS) })),
  });

  console.log(`  ✓ Students (${students.length}, enrolled) + parents (linked)`);

  // ==========================================================================
  // 5. ATTENDANCE (academic) — last 15 school days, all students
  // ==========================================================================
  const schoolDays: Date[] = [];
  for (let d = 0; schoolDays.length < 15; d++) {
    const day = daysAgo(d, now);
    if (day.getDay() !== 0 && day.getDay() !== 6) schoolDays.push(day);
  }
  const attendanceRows = students.flatMap((s) =>
    schoolDays.map((date) => {
      const roll = rng();
      const status = roll < 0.88 ? ("PRESENT" as const) : roll < 0.96 ? ("ABSENT" as const) : ("HALF_DAY" as const);
      return { schoolId: SCHOOL_ID, studentId: s.id, classId: s.classId, date, status };
    })
  );
  await db.attendance.createMany({ data: attendanceRows });
  console.log(`  ✓ Attendance (${attendanceRows.length} records over 15 school days)`);

  // Staff attendance too, same window.
  await db.staffAttendance.createMany({
    data: staffProfiles.flatMap((sp) =>
      schoolDays.map((date) => ({ schoolId: SCHOOL_ID, staffId: sp.id, date, status: rng() < 0.93 ? ("PRESENT" as const) : ("ABSENT" as const) }))
    ),
  });

  // A few staff leave types + requests.
  const leaveTypes = await db.staffLeaveType.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, name: "Casual Leave", annualQuota: 12 },
      { schoolId: SCHOOL_ID, name: "Sick Leave", annualQuota: 10 },
      { schoolId: SCHOOL_ID, name: "Earned Leave", annualQuota: 15 },
    ],
  });
  for (let i = 0; i < 8; i++) {
    const staff = pick(staffProfiles);
    const from = daysAgo(randInt(2, 60), now);
    const status = pick(["PENDING", "APPROVED", "APPROVED", "REJECTED"] as const);
    await db.staffLeaveRequest.create({
      data: {
        schoolId: SCHOOL_ID,
        staffId: staff.id,
        leaveTypeId: pick(leaveTypes).id,
        dateFrom: from,
        dateTo: addDays(from, randInt(0, 2)),
        reason: pick(["Family function", "Not feeling well", "Personal work", "Travel"]),
        status,
        actionAt: status === "PENDING" ? null : addDays(from, -1),
        approvedByStaffId: status === "PENDING" ? null : adminUser.id,
      },
    });
  }
  console.log("  ✓ Staff attendance + leave requests");

  // ==========================================================================
  // 6. TIMETABLE
  // ==========================================================================
  const rooms = await db.room.createManyAndReturn({
    data: ["Room 101", "Room 102", "Room 103", "Room 201", "Science Lab", "Computer Lab"].map((name) => ({ schoolId: SCHOOL_ID, name, capacity: 40 })),
  });
  const subjectTeacherByClassSubject = new Map<string, string>();
  {
    const rows = await db.classSubjectTeacher.findMany({ where: { schoolId: SCHOOL_ID } });
    for (const r of rows) subjectTeacherByClassSubject.set(`${r.classId}:${r.subjectId}`, r.staffId);
  }
  const DAYS: ("MON" | "TUE" | "WED" | "THU" | "FRI")[] = ["MON", "TUE", "WED", "THU", "FRI"];
  const timetableRows = classes.flatMap((cls) =>
    DAYS.flatMap((day, di) =>
      Array.from({ length: 6 }, (_, period) => {
        const subject = subjects[(di + period) % subjects.length];
        const staffId = subjectTeacherByClassSubject.get(`${cls.id}:${subject.id}`) ?? teachingStaff[0].id;
        return { schoolId: SCHOOL_ID, classId: cls.id, subjectId: subject.id, staffId, dayOfWeek: day, periodNo: period + 1, roomId: pick(rooms).id };
      })
    )
  );
  await db.timetableSlot.createMany({ data: timetableRows });
  console.log(`  ✓ Timetable (${timetableRows.length} slots across 6 rooms)`);

  // ==========================================================================
  // 7. HOMEWORK
  // ==========================================================================
  for (const cls of classes) {
    const classStudents = students.filter((s) => s.classId === cls.id);
    for (let i = 0; i < 2; i++) {
      const subject = pick(subjects);
      const staffId = subjectTeacherByClassSubject.get(`${cls.id}:${subject.id}`) ?? teachingStaff[0].id;
      const hw = await db.homework.create({
        data: {
          schoolId: SCHOOL_ID,
          classId: cls.id,
          subjectId: subject.id,
          staffId,
          title: pick(["Chapter review questions", "Worksheet — practice problems", "Reading assignment", "Project research"]),
          description: "Complete the assigned work and submit by the due date.",
          dueDate: addDays(now, randInt(-5, 7)),
        },
      });
      await db.homeworkSubmission.createMany({
        data: classStudents.map((s) => {
          const status = pick(["PENDING", "SUBMITTED", "SUBMITTED", "LATE"] as const);
          return { schoolId: SCHOOL_ID, assignmentId: hw.id, studentId: s.id, status, submittedOn: status === "PENDING" ? null : daysAgo(randInt(0, 5), now), score: status === "PENDING" ? null : randInt(5, 10) };
        }),
      });
    }
  }
  console.log("  ✓ Homework (2 per class, with submissions)");

  // ==========================================================================
  // 8. EXAMS + MARKS + STUDENT RESULTS
  // ==========================================================================
  const gradeBands = await db.gradeBand.findMany({ where: { scaleId: gradeScale.id } });
  function gradeForPct(pct: number): string {
    const band = gradeBands.find((b) => pct >= Number(b.minPercent) && pct <= Number(b.maxPercent));
    return band?.label ?? "—";
  }

  for (const cls of classes) {
    const classStudents = students.filter((s) => s.classId === cls.id);
    const exam = await db.exam.create({
      data: { schoolId: SCHOOL_ID, yearId: year.id, classId: cls.id, name: "Mid-Term Examination", startDate: daysAgo(20, now), endDate: daysAgo(15, now), approvalStatus: "APPROVED", resultReleaseAt: daysAgo(10, now) },
    });
    const examSubjects = await db.examSubject.createManyAndReturn({
      data: subjects.map((s) => ({ schoolId: SCHOOL_ID, examId: exam.id, subjectId: s.id, maxMarks: 100 })),
    });

    const totals = new Map<string, number>();
    for (const s of classStudents) {
      let total = 0;
      for (const es of examSubjects) {
        const marksObtained = randInt(35, 98);
        total += marksObtained;
        await db.mark.create({ data: { schoolId: SCHOOL_ID, examSubjectId: es.id, studentId: s.id, marksObtained } });
      }
      totals.set(s.id, total);
    }
    const maxTotal = examSubjects.length * 100;
    const ranked = [...classStudents].sort((a, b) => totals.get(b.id)! - totals.get(a.id)!);
    await db.studentResult.createMany({
      data: classStudents.map((s) => {
        const total = totals.get(s.id)!;
        const pct = (total / maxTotal) * 100;
        return { schoolId: SCHOOL_ID, examId: exam.id, studentId: s.id, totalMarks: total, maxMarks: maxTotal, percentage: pct, grade: gradeForPct(pct), rank: ranked.findIndex((r) => r.id === s.id) + 1 };
      }),
    });

    // Exam seating, one row per student.
    await db.examSeating.createMany({
      data: classStudents.map((s, i) => ({ schoolId: SCHOOL_ID, examId: exam.id, studentId: s.id, roomId: pick(rooms).id, seatNo: i + 1 })),
    });
  }
  console.log("  ✓ Exams (Mid-Term per class) + marks + results + seating");

  // ==========================================================================
  // 9. FEES
  // ==========================================================================
  const FEE_BY_GRADE: Record<string, number> = { "1": 45000, "2": 45000, "3": 48000, "4": 48000, "5": 50000, "6": 55000, "7": 55000, "8": 58000, "9": 62000, "10": 65000 };
  await db.classFeeDefault.createMany({
    data: GRADES.map((g) => ({ schoolId: SCHOOL_ID, yearId: year.id, grade: g, actualFee: FEE_BY_GRADE[g] })),
  });

  const feeStructureByClass = new Map<string, string>();
  for (const cls of classes) {
    const fs = await db.feeStructure.create({
      data: { schoolId: SCHOOL_ID, classId: cls.id, yearId: year.id, term: "Full Year", amount: FEE_BY_GRADE[cls.grade], dueDate: addDays(yearStart, 30) },
    });
    feeStructureByClass.set(cls.id, fs.id);
  }

  // A handful of students get a scholarship discount or a one-off adjustment.
  // Track each discounted student's percent so payments below can be sized
  // against their actual net total, not the undiscounted sticker fee —
  // otherwise a discounted student's "paid" would exceed their "total" on
  // the Fees page (total is shown net of discount there).
  const scholarshipStudents = students.filter(() => rng() < 0.08);
  const discountPercentByStudent = new Map<string, number>();
  const discountRows = scholarshipStudents.map((s) => {
    const value = pick([10, 15, 20, 25]);
    discountPercentByStudent.set(s.id, value);
    return { schoolId: SCHOOL_ID, studentId: s.id, kind: pick(["SCHOLARSHIP", "SIBLING"] as const), valueType: "PERCENT" as const, value, note: "Merit scholarship" };
  });
  await db.feeDiscount.createMany({ data: discountRows });
  const adjustmentStudents = students.filter(() => rng() < 0.05);
  await db.feeAdjustment.createMany({
    data: adjustmentStudents.map((s) => ({ schoolId: SCHOOL_ID, studentId: s.id, description: pick(["Late admission fee", "Lab breakage charge", "Late fine"]), amount: randInt(500, 3000) })),
  });

  // Payments — most students PAID in full or PARTIAL, ~15% haven't paid yet.
  // A handful are dated today, so "Fees collected today" isn't a blank ₹0.
  let paidTodayCount = 0;
  for (const s of students) {
    const feeStructureId = feeStructureByClass.get(s.classId)!;
    const roll = rng();
    if (roll < 0.15) continue; // no payment yet — shows as outstanding
    const stickerFee = FEE_BY_GRADE[classes.find((c) => c.id === s.classId)!.grade];
    const discountPct = discountPercentByStudent.get(s.id) ?? 0;
    const fullAmount = Math.round(stickerFee * (1 - discountPct / 100));
    const paidPartial = roll < 0.35;
    const amount = paidPartial ? Math.round(fullAmount * 0.5) : fullAmount;
    const paidOn = paidTodayCount < 6 ? daysAgo(0, now) : daysAgo(randInt(5, 90), now);
    paidTodayCount++;
    await db.feePayment.create({
      data: { schoolId: SCHOOL_ID, studentId: s.id, feeStructureId, amount, method: pick(PAYMENT_METHODS), referenceNo: `RCPT-${randInt(100000, 999999)}`, paidOn, status: paidPartial ? "PARTIAL" : "PAID" },
    });
  }
  console.log("  ✓ Fee structures, discounts/adjustments, and payments");

  // ==========================================================================
  // 10. PAYROLL
  // ==========================================================================
  await db.salaryComponent.createMany({
    data: staffProfiles.flatMap((sp) => {
      const basic = randInt(25000, 55000);
      return [
        { schoolId: SCHOOL_ID, staffId: sp.id, name: "Basic", amount: basic },
        { schoolId: SCHOOL_ID, staffId: sp.id, name: "HRA", amount: Math.round(basic * 0.4) },
        { schoolId: SCHOOL_ID, staffId: sp.id, name: "Special Allowance", amount: Math.round(basic * 0.15) },
      ];
    }),
  });

  for (let m = 3; m >= 0; m--) {
    const monthDate = daysAgo(30 * m, now);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    for (const sp of staffProfiles) {
      const components = await db.salaryComponent.findMany({ where: { staffId: sp.id } });
      const gross = components.reduce((s, c) => s + Number(c.amount), 0);
      const pf = Math.round(gross * 0.12);
      const esi = Math.round(gross * 0.0075);
      const tds = Math.round(gross * 0.02);
      const pt = 200;
      const net = gross - pf - esi - tds - pt;
      const isCurrentMonth = m === 0;
      await db.payrollRun.create({
        data: {
          schoolId: SCHOOL_ID,
          staffId: sp.id,
          month: monthKey,
          amount: net,
          grossAmount: gross,
          pfAmount: pf,
          esiAmount: esi,
          tdsAmount: tds,
          ptAmount: pt,
          status: isCurrentMonth ? "PENDING" : "PAID",
          paidOn: isCurrentMonth ? null : addDays(monthDate, 2),
        },
      });
    }
  }
  console.log("  ✓ Payroll (4 months, structured salary components)");

  // ==========================================================================
  // 11. ADMISSIONS
  // ==========================================================================
  const admissionRows: { applicantName: string; parentContact: string; classApplied: string; stage: "ENQUIRY" | "APPLICATION" | "ADMITTED"; approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED" }[] = [];
  for (let i = 0; i < 6; i++) admissionRows.push({ applicantName: `${pick(FIRST_NAMES_CHILD)} ${pick(LAST_NAMES)}`, parentContact: `9${randInt(100000000, 999999999)}`, classApplied: pick(GRADES), stage: "ENQUIRY", approvalStatus: "NONE" });
  for (let i = 0; i < 5; i++) admissionRows.push({ applicantName: `${pick(FIRST_NAMES_CHILD)} ${pick(LAST_NAMES)}`, parentContact: `9${randInt(100000000, 999999999)}`, classApplied: pick(GRADES), stage: "APPLICATION", approvalStatus: "NONE" });
  for (let i = 0; i < 2; i++) admissionRows.push({ applicantName: `${pick(FIRST_NAMES_CHILD)} ${pick(LAST_NAMES)}`, parentContact: `9${randInt(100000000, 999999999)}`, classApplied: pick(GRADES), stage: "APPLICATION", approvalStatus: "PENDING" });
  for (let i = 0; i < 4; i++) admissionRows.push({ applicantName: `${pick(FIRST_NAMES_CHILD)} ${pick(LAST_NAMES)}`, parentContact: `9${randInt(100000000, 999999999)}`, classApplied: pick(GRADES), stage: "ADMITTED", approvalStatus: "APPROVED" });

  const admittedStudentPool = [...students];
  for (const row of admissionRows) {
    const isAdmitted = row.stage === "ADMITTED";
    // Each ADMITTED enquiry needs a distinct Student (convertedStudentId is @unique) — pop one off the pool.
    const convertedStudentId = isAdmitted ? admittedStudentPool.splice(randInt(0, admittedStudentPool.length - 1), 1)[0].id : null;
    await db.admissionEnquiry.create({
      data: {
        schoolId: SCHOOL_ID,
        applicantName: row.applicantName,
        parentContact: row.parentContact,
        classApplied: row.classApplied,
        stage: row.stage,
        approvalStatus: row.approvalStatus,
        parentName: `${pick(FIRST_NAMES_ADULT)} ${pick(LAST_NAMES)}`,
        dob: new Date(now.getFullYear() - (5 + Number(row.classApplied)), randInt(0, 11), randInt(1, 28)),
        gender: rng() < 0.5 ? "MALE" : "FEMALE",
        submittedForApprovalAt: row.approvalStatus !== "NONE" ? daysAgo(randInt(3, 15), now) : null,
        approvalActionAt: isAdmitted ? daysAgo(randInt(1, 10), now) : null,
        convertedStudentId,
      },
    });
  }
  console.log("  ✓ Admissions (enquiries across every stage)");

  // ==========================================================================
  // 12. TRANSPORT
  // ==========================================================================
  const vehicles = await db.transportVehicle.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, vehicleNo: "KA-05-AB-1234", vehicleType: "Bus", capacity: 40, make: "Tata", model: "Starbus", driverName: "Suresh Kumar", driverPhone: "9876543210", insuranceExpiry: addDays(now, 120), fitnessExpiry: addDays(now, 200), pollutionCertExpiry: addDays(now, 60) },
      { schoolId: SCHOOL_ID, vehicleNo: "KA-05-AB-5678", vehicleType: "Bus", capacity: 35, make: "Ashok Leyland", model: "Falcon", driverName: "Manoj Rao", driverPhone: "9876543211", insuranceExpiry: addDays(now, 90), fitnessExpiry: addDays(now, 150), pollutionCertExpiry: addDays(now, 30) },
      { schoolId: SCHOOL_ID, vehicleNo: "KA-05-AB-9012", vehicleType: "Van", capacity: 15, make: "Force", model: "Traveller", driverName: "Ashok Bisht", driverPhone: "9876543212", insuranceExpiry: addDays(now, 200), fitnessExpiry: addDays(now, 250) },
    ],
  });
  const routes: Awaited<ReturnType<typeof db.transportRoute.create>>[] = [];
  for (let i = 0; i < vehicles.length; i++) {
    const route = await db.transportRoute.create({ data: { schoolId: SCHOOL_ID, name: `Route ${i + 1} — ${pick(["North", "South", "East"])} Zone`, vehicleId: vehicles[i].id, feeAmount: randInt(6000, 12000) } });
    routes.push(route);
  }
  const stops = [];
  for (const route of routes) {
    const stopNames = ["Main Gate", "Market Junction", "Park Circle", "Residency Road"];
    for (let i = 0; i < stopNames.length; i++) {
      const stop = await db.transportStop.create({ data: { schoolId: SCHOOL_ID, routeId: route.id, stopName: stopNames[i], sequence: i + 1 } });
      stops.push({ ...stop, routeId: route.id });
    }
  }
  const transportStudents = students.filter(() => rng() < 0.2);
  for (const s of transportStudents) {
    const route = pick(routes);
    const routeStops = stops.filter((st) => st.routeId === route.id);
    await db.studentTransportAssignment.create({ data: { studentId: s.id, schoolId: SCHOOL_ID, routeId: route.id, stopId: pick(routeStops).id } });
  }
  for (let d = 0; d < 10; d++) {
    const date = daysAgo(d, now);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    await db.transportAttendance.createMany({
      data: transportStudents.map((s) => {
        const assignment = { routeId: pick(routes).id };
        return { schoolId: SCHOOL_ID, studentId: s.id, routeId: assignment.routeId, date, pickupAt: new Date(date.getTime() + 7 * 3600000), dropAt: new Date(date.getTime() + 15 * 3600000) };
      }),
    });
  }
  await db.vehicleLog.createMany({
    data: vehicles.flatMap((v) => [
      { schoolId: SCHOOL_ID, vehicleId: v.id, type: "SERVICE" as const, date: daysAgo(randInt(10, 60), now), description: "Routine service and oil change", cost: randInt(3000, 8000), odometerReading: randInt(20000, 80000) },
      { schoolId: SCHOOL_ID, vehicleId: v.id, type: "INSURANCE_RENEWAL" as const, date: daysAgo(randInt(200, 340), now), description: "Annual insurance renewal", cost: randInt(15000, 25000) },
    ]),
  });
  console.log("  ✓ Transport (vehicles, routes, stops, assignments, attendance, logs)");

  // ==========================================================================
  // 13. HOSTEL — using the new bed-level allocation + attendance system
  // ==========================================================================
  const hostelRoomDefs = [
    { roomNo: "H-101", capacity: 4, roomType: "Dormitory" },
    { roomNo: "H-102", capacity: 4, roomType: "Dormitory" },
    { roomNo: "H-103", capacity: 2, roomType: "Double" },
    { roomNo: "H-104", capacity: 2, roomType: "Double" },
    { roomNo: "H-201", capacity: 1, roomType: "Single" },
    { roomNo: "H-202", capacity: 4, roomType: "Dormitory" },
    { roomNo: "H-203", capacity: 3, roomType: "Dormitory" },
    { roomNo: "H-204", capacity: 2, roomType: "Double" },
  ];
  const wardenCandidates = staffProfiles.filter((sp) => staffProfileRows[staffProfiles.indexOf(sp)]?.designation === "Hostel Warden");
  const hostelRooms: Awaited<ReturnType<typeof db.hostelRoom.create>>[] = [];
  const hostelBedsByRoom = new Map<string, { id: string; bedNo: string }[]>();
  for (const def of hostelRoomDefs) {
    const room = await db.hostelRoom.create({
      data: { schoolId: SCHOOL_ID, roomNo: def.roomNo, capacity: def.capacity, roomType: def.roomType, roomSize: `${8 + def.capacity * 2}ft x 10ft`, wardenStaffId: wardenCandidates.length > 0 ? pick(wardenCandidates).id : null },
    });
    const beds = await db.hostelBed.createManyAndReturn({ data: Array.from({ length: def.capacity }, (_, i) => ({ schoolId: SCHOOL_ID, roomId: room.id, bedNo: String(i + 1) })) });
    hostelRooms.push(room);
    hostelBedsByRoom.set(room.id, beds);
    await db.hostelFacility.createMany({
      data: [
        { schoolId: SCHOOL_ID, roomId: room.id, type: "TOILET" as const, condition: "Good" },
        { schoolId: SCHOOL_ID, roomId: room.id, type: "SHOWER" as const, condition: pick(["Good", "Good", "Needs repair"]) },
      ],
    });
  }

  const totalHostelBeds = hostelRoomDefs.reduce((s, r) => s + r.capacity, 0);
  const hostelStudentPool = students.filter(() => rng() < 0.25).slice(0, totalHostelBeds - 2); // leave a couple of beds free
  const hostelAllocations: { studentId: string; roomId: string; bedId: string }[] = [];
  let poolIdx = 0;
  for (const room of hostelRooms) {
    const beds = hostelBedsByRoom.get(room.id)!;
    for (const bed of beds) {
      if (poolIdx >= hostelStudentPool.length) break;
      const student = hostelStudentPool[poolIdx++];
      await db.hostelAllocation.create({ data: { schoolId: SCHOOL_ID, roomId: room.id, studentId: student.id, bedId: bed.id, dateFrom: daysAgo(randInt(30, 200), now) } });
      hostelAllocations.push({ studentId: student.id, roomId: room.id, bedId: bed.id });
    }
  }

  await db.hostelMessMenu.createMany({
    data: Array.from({ length: 7 }, (_, dayOfWeek) =>
      (["BREAKFAST", "LUNCH", "DINNER"] as const).map((mealType) => ({
        schoolId: SCHOOL_ID,
        dayOfWeek,
        mealType,
        menuText: mealType === "BREAKFAST" ? pick(["Idli & Sambar", "Poha", "Bread & Omelette"]) : mealType === "LUNCH" ? pick(["Rice, Dal, Sabzi & Curd", "Chapati, Paneer Curry & Salad"]) : pick(["Khichdi & Curd", "Chapati & Vegetable Curry"]),
      }))
    ).flat(),
  });
  for (let d = 0; d < 10; d++) {
    const date = daysAgo(d, now);
    await db.hostelMealServed.createMany({
      data: (["BREAKFAST", "LUNCH", "DINNER"] as const).map((mealType) => ({ schoolId: SCHOOL_ID, date, mealType, description: pick(["Idli & Sambar", "Rice & Dal", "Chapati & Curry"]), headcount: randInt(hostelAllocations.length - 5, hostelAllocations.length) })),
    });
  }

  for (let i = 0; i < 12; i++) {
    const alloc = pick(hostelAllocations);
    const checkInAt = daysAgo(randInt(0, 20), now);
    await db.hostelVisitorLog.create({
      data: { schoolId: SCHOOL_ID, studentId: alloc.studentId, visitorName: `${pick(FIRST_NAMES_ADULT)} ${pick(LAST_NAMES)}`, relation: pick(["Father", "Mother", "Uncle", "Grandparent"]), purpose: pick(["Visit", "Bringing supplies", "Check-up"]), checkInAt, checkOutAt: rng() < 0.8 ? new Date(checkInAt.getTime() + randInt(1, 4) * 3600000) : null },
    });
  }
  for (let i = 0; i < 8; i++) {
    const alloc = pick(hostelAllocations);
    const dateFrom = daysAgo(randInt(1, 30), now);
    const status = pick(["PENDING", "APPROVED", "APPROVED", "REJECTED"] as const);
    await db.hostelOutingRequest.create({
      data: { schoolId: SCHOOL_ID, studentId: alloc.studentId, reason: pick(["Weekend home visit", "Family function", "Medical appointment"]), dateFrom, dateTo: addDays(dateFrom, randInt(0, 2)), status, actionAt: status === "PENDING" ? null : addDays(dateFrom, -1) },
    });
  }
  await db.hostelMaintenanceLog.createMany({
    data: Array.from({ length: 6 }, () => {
      const room = pick(hostelRooms);
      return { schoolId: SCHOOL_ID, roomId: room.id, type: pick(["LAUNDRY", "MAINTENANCE"] as const), date: daysAgo(randInt(1, 20), now), description: pick(["Leaking tap", "Fan not working", "Weekly laundry pickup", "Window latch broken"]), status: pick(["PENDING", "IN_PROGRESS", "DONE"] as const) };
    }),
  });
  for (let i = 0; i < 10; i++) {
    const alloc = pick(hostelAllocations);
    const ticket = await db.laundryTicket.create({
      data: { schoolId: SCHOOL_ID, studentId: alloc.studentId, tokenNo: `LT-${1000 + i}`, submittedAt: daysAgo(randInt(0, 10), now), collectionDate: addDays(now, randInt(0, 5)), status: pick(["PENDING", "COLLECTED"] as const) },
    });
    await db.laundryItem.createMany({ data: [{ schoolId: SCHOOL_ID, ticketId: ticket.id, itemType: "Shirt", quantity: randInt(2, 5) }, { schoolId: SCHOOL_ID, ticketId: ticket.id, itemType: "Pant", quantity: randInt(1, 3) }] });
  }

  // Hostel attendance — last 10 school days, all 3 sessions, hostel residents only.
  const hostelDays = Array.from({ length: 10 }, (_, i) => daysAgo(i, now));
  await db.hostelAttendance.createMany({
    data: hostelAllocations.flatMap((a) =>
      hostelDays.flatMap((date) =>
        (["MORNING", "EVENING", "NIGHT"] as const).map((session) => ({ schoolId: SCHOOL_ID, studentId: a.studentId, date, session, status: rng() < 0.92 ? ("PRESENT" as const) : rng() < 0.5 ? ("LATE" as const) : ("ABSENT" as const) }))
      )
    ),
  });
  console.log(`  ✓ Hostel (${hostelRooms.length} rooms, ${hostelAllocations.length} bed allocations, mess/visitors/outings/maintenance/laundry/attendance)`);

  // ==========================================================================
  // 14. LIBRARY
  // ==========================================================================
  const BOOK_DEFS = [
    ["Wings of Fire", "A.P.J. Abdul Kalam", "Biography"], ["The Discovery of India", "Jawaharlal Nehru", "History"],
    ["Panchatantra Tales", "Vishnu Sharma", "Fiction"], ["NCERT Mathematics — Class 8", "NCERT", "Textbook"],
    ["NCERT Science — Class 9", "NCERT", "Textbook"], ["A Brief History of Time", "Stephen Hawking", "Science"],
    ["Malgudi Days", "R.K. Narayan", "Fiction"], ["The Alchemist", "Paulo Coelho", "Fiction"],
    ["Harry Potter and the Sorcerer's Stone", "J.K. Rowling", "Fiction"], ["Atlas of the World", "DK Publishing", "Reference"],
    ["Encyclopedia of Science", "DK Publishing", "Reference"], ["The Jungle Book", "Rudyard Kipling", "Fiction"],
    ["Five Point Someone", "Chetan Bhagat", "Fiction"], ["Chandamama Collection", "Various", "Fiction"],
    ["NCERT English Reader — Class 7", "NCERT", "Textbook"], ["The Hindu Guide to General Knowledge", "The Hindu", "Reference"],
  ] as const;
  const books = await db.libraryBook.createManyAndReturn({
    data: BOOK_DEFS.map(([title, author, category], i) => ({ schoolId: SCHOOL_ID, title, author, category, accessionNo: `ACC-${String(1000 + i)}`, copiesTotal: randInt(2, 5), copiesAvailable: 0 })),
  });
  for (const book of books) await db.libraryBook.update({ where: { id: book.id }, data: { copiesAvailable: book.copiesTotal } });

  const circulationStudents = students.filter(() => rng() < 0.15);
  for (const s of circulationStudents) {
    const book = pick(books);
    const current = await db.libraryBook.findUniqueOrThrow({ where: { id: book.id } });
    if (current.copiesAvailable <= 0) continue;
    const issueDate = daysAgo(randInt(1, 25), now);
    const dueDate = addDays(issueDate, 14);
    const isOverdue = dueDate < now && rng() < 0.4;
    const isReturned = !isOverdue && rng() < 0.5;
    await db.libraryCirculation.create({
      data: {
        schoolId: SCHOOL_ID,
        bookId: book.id,
        studentId: s.id,
        issueDate,
        dueDate,
        status: isOverdue ? "OVERDUE" : isReturned ? "RETURNED" : "ISSUED",
        returnDate: isReturned ? addDays(dueDate, randInt(-3, 2)) : null,
        fineAmount: isOverdue || (isReturned && rng() < 0.2) ? randInt(10, 60) : null,
      },
    });
    if (!isReturned) await db.libraryBook.update({ where: { id: book.id }, data: { copiesAvailable: { decrement: 1 } } });
  }
  console.log(`  ✓ Library (${books.length} books, circulation)`);

  // ==========================================================================
  // 15. INVENTORY
  // ==========================================================================
  const vendors = await db.schoolVendor.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, name: "Sri Sai Stationers", category: "Stationery", phone: "9900011122" },
      { schoolId: SCHOOL_ID, name: "Uniform World", category: "Uniforms", phone: "9900011123" },
      { schoolId: SCHOOL_ID, name: "TechSmart Supplies", category: "Electronics", phone: "9900011124" },
      { schoolId: SCHOOL_ID, name: "Clean & Fresh Housekeeping Co.", category: "Housekeeping", phone: "9900011125" },
    ],
  });
  const stockItems = await db.inventoryStockItem.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, name: "Notebook (200pg)", itemType: "Stationery", costPrice: 25, sellPrice: 35, quantityOnHand: 300 },
      { schoolId: SCHOOL_ID, name: "School Diary", itemType: "Stationery", costPrice: 40, sellPrice: 60, quantityOnHand: 150 },
      { schoolId: SCHOOL_ID, name: "PE Uniform Set", itemType: "Uniform", costPrice: 350, sellPrice: 450, quantityOnHand: 80 },
      { schoolId: SCHOOL_ID, name: "School Tie", itemType: "Uniform", costPrice: 60, sellPrice: 90, quantityOnHand: 120 },
      { schoolId: SCHOOL_ID, name: "Water Bottle", itemType: "Accessory", costPrice: 80, sellPrice: 120, quantityOnHand: 60 },
    ],
  });
  const consumables = await db.inventoryConsumable.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, name: "Whiteboard Marker", category: "Classroom", unit: "pcs", quantityOnHand: 200, reorderLevel: 50 },
      { schoolId: SCHOOL_ID, name: "A4 Paper Ream", category: "Office", unit: "ream", quantityOnHand: 40, reorderLevel: 15 },
      { schoolId: SCHOOL_ID, name: "Hand Sanitizer (5L)", category: "Housekeeping", unit: "bottle", quantityOnHand: 8, reorderLevel: 5 },
    ],
  });
  await db.inventoryAsset.createMany({
    data: [
      { schoolId: SCHOOL_ID, name: "Projector — Epson EB-X06", category: "Electronics", location: "Room 201", purchaseDate: daysAgo(400, now), purchaseCost: 32000, usefulLifeYears: 5, status: "IN_USE" },
      { schoolId: SCHOOL_ID, name: "Desktop Computer (x20)", category: "Electronics", location: "Computer Lab", purchaseDate: daysAgo(600, now), purchaseCost: 600000, usefulLifeYears: 4, status: "IN_USE" },
      { schoolId: SCHOOL_ID, name: "Photocopier — Xerox WorkCentre", category: "Office Equipment", location: "Front Office", purchaseDate: daysAgo(900, now), purchaseCost: 85000, usefulLifeYears: 6, status: "UNDER_REPAIR" },
    ],
  });
  const purchaseOrders = await db.purchaseOrder.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, poNumber: "PO-2026-001", vendorId: vendors[0].id, itemDescription: "Notebooks — bulk restock", quantity: 500, unitCost: 22, status: "RECEIVED", orderDate: daysAgo(40, now), receivedDate: daysAgo(35, now) },
      { schoolId: SCHOOL_ID, poNumber: "PO-2026-002", vendorId: vendors[1].id, itemDescription: "PE Uniform sets — new batch", quantity: 100, unitCost: 340, status: "ORDERED", orderDate: daysAgo(10, now) },
      { schoolId: SCHOOL_ID, poNumber: "PO-2026-003", vendorId: vendors[2].id, itemDescription: "Projector bulb replacement", quantity: 2, unitCost: 4500, status: "DRAFT", orderDate: daysAgo(2, now) },
    ],
  });
  void purchaseOrders;

  for (let i = 0; i < 6; i++) {
    const lines = Array.from({ length: randInt(1, 3) }, () => pick(stockItems)).filter((v, idx, arr) => arr.indexOf(v) === idx);
    let totalAmount = 0;
    const sale = await db.inventorySale.create({ data: { schoolId: SCHOOL_ID, consumerName: `${pick(FIRST_NAMES_CHILD)} ${pick(LAST_NAMES)} (Parent)`, totalAmount: 0, soldAt: daysAgo(randInt(1, 20), now) } });
    for (const item of lines) {
      const quantity = randInt(1, 3);
      const lineTotal = Number(item.sellPrice) * quantity;
      totalAmount += lineTotal;
      await db.inventorySaleItem.create({ data: { schoolId: SCHOOL_ID, saleId: sale.id, stockItemId: item.id, quantity, unitPrice: item.sellPrice, lineTotal } });
    }
    await db.inventorySale.update({ where: { id: sale.id }, data: { totalAmount } });
  }
  console.log("  ✓ Inventory (vendors, stock items, consumables, assets, purchase orders, sales)");

  // ==========================================================================
  // 16. EVENTS
  // ==========================================================================
  const events = await db.event.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, title: "Annual Sports Day", type: "Sports", date: addDays(now, 25), venue: "School Grounds", expectedAttendance: 600, budgetEstimate: 150000 },
      { schoolId: SCHOOL_ID, title: "Science Exhibition", type: "Academic", date: addDays(now, 15), venue: "Main Hall", expectedAttendance: 400, budgetEstimate: 40000 },
      { schoolId: SCHOOL_ID, title: "Parent-Teacher Meeting", type: "Meeting", date: addDays(now, 5), venue: "Classrooms", expectedAttendance: 300 },
      { schoolId: SCHOOL_ID, title: "Independence Day Celebration", type: "Celebration", date: daysAgo(30, now), venue: "School Grounds", expectedAttendance: 700, budgetEstimate: 25000 },
      { schoolId: SCHOOL_ID, title: "Annual Day Function", type: "Celebration", date: addDays(now, 60), venue: "Auditorium", expectedAttendance: 800, budgetEstimate: 300000 },
    ],
  });
  await db.eventChecklistItem.createMany({
    data: events.flatMap((e) => [
      { schoolId: SCHOOL_ID, eventId: e.id, task: "Book venue", status: "DONE" as const },
      { schoolId: SCHOOL_ID, eventId: e.id, task: "Send invitations", status: pick(["PENDING", "DONE"] as const) },
      { schoolId: SCHOOL_ID, eventId: e.id, task: "Arrange refreshments", status: "PENDING" as const },
    ]),
  });
  console.log("  ✓ Events (with checklists)");

  // ==========================================================================
  // 17. CERTIFICATES
  // ==========================================================================
  const certTemplates = await db.certificateTemplate.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, type: "BONAFIDE", label: "Bonafide Certificate", title: "Bonafide Certificate", bodyText: "This is to certify that {{name}}, Admission No. {{admissionNo}}, is a bonafide student of {{class}}, {{school}}, for the academic year {{year}}." },
      { schoolId: SCHOOL_ID, type: "TRANSFER", label: "Transfer Certificate", title: "Transfer Certificate", bodyText: "This is to certify that {{name}}, Admission No. {{admissionNo}}, a student of {{class}}, {{school}}, is relieved from this institution." },
      { schoolId: SCHOOL_ID, type: "ACHIEVEMENT", label: "Achievement Certificate", title: "Certificate of Achievement", bodyText: "This certificate is proudly presented to {{name}}, {{class}}, {{school}}, in recognition of outstanding achievement." },
    ],
  });
  for (let i = 0; i < 6; i++) {
    const template = pick(certTemplates);
    const student = pick(students);
    const cls = classes.find((c) => c.id === student.classId)!;
    const renderedBody = template.bodyText
      .replace("{{name}}", `${student.firstName} ${student.surname}`)
      .replace("{{admissionNo}}", student.admissionNo)
      .replace("{{class}}", `Class ${cls.grade}, Section ${cls.section}`)
      .replace("{{school}}", "Greenwood International School")
      .replace("{{year}}", year.label);
    await db.certificateIssued.create({ data: { schoolId: SCHOOL_ID, studentId: student.id, templateId: template.id, issuedDate: daysAgo(randInt(1, 60), now), issuedByStaffId: pick(staffProfiles).id, renderedBody } });
  }
  console.log("  ✓ Certificates (templates + issued)");

  // ==========================================================================
  // 18. COMMUNICATION
  // ==========================================================================
  const announcements = await db.announcement.createManyAndReturn({
    data: [
      { schoolId: SCHOOL_ID, title: "Annual Sports Day — Save the Date", body: "Our Annual Sports Day will be held on the school grounds. All parents are invited.", audienceType: "ALL_PARENTS" as const, approvalStatus: "APPROVED" as const, publishedOn: daysAgo(3, now) },
      { schoolId: SCHOOL_ID, title: "Mid-Term Exam Schedule Released", body: "The Mid-Term examination schedule has been published. Please check the Exams section.", audienceType: "ALL_PARENTS" as const, approvalStatus: "APPROVED" as const, publishedOn: daysAgo(10, now) },
      { schoolId: SCHOOL_ID, title: "Staff Meeting — Friday", body: "All staff are requested to attend the monthly review meeting.", audienceType: "ALL_STAFF" as const, approvalStatus: "APPROVED" as const, publishedOn: daysAgo(2, now) },
      { schoolId: SCHOOL_ID, title: "Holiday Notice — Festival Break", body: "The school will remain closed for the festival break.", audienceType: "ALL_PARENTS" as const, approvalStatus: "APPROVED" as const, publishedOn: daysAgo(20, now) },
      { schoolId: SCHOOL_ID, title: "Upcoming PTA — Draft", body: "Draft announcement for the upcoming Parent-Teacher meeting.", audienceType: "ALL_PARENTS" as const, approvalStatus: "PENDING" as const },
    ],
  });
  const allUsers = [adminUser, ...staffUsers, ...parentUsers];
  await db.announcementRead.createMany({
    data: announcements
      .filter((a) => a.approvalStatus === "APPROVED")
      .flatMap((a) => allUsers.filter(() => rng() < 0.4).map((u) => ({ schoolId: SCHOOL_ID, announcementId: a.id, userId: u.id, readOn: daysAgo(randInt(0, 3), now) }))),
  });
  console.log("  ✓ Communication (announcements, read receipts)");

  // ==========================================================================
  // 19. SETTINGS — website, ID cards, feature flags
  // ==========================================================================
  await db.websiteSettings.create({ data: { schoolId: SCHOOL_ID, canvasBackground: "#0f172a" } });
  await db.websiteElement.createMany({
    data: [
      { schoolId: SCHOOL_ID, type: "TEXT", x: 60, y: 40, width: 500, height: 60, text: "Greenwood International School", fontSize: 32, fontWeight: 700, color: "#ffffff" },
      { schoolId: SCHOOL_ID, type: "TEXT", x: 60, y: 110, width: 500, height: 40, text: "Nurturing minds, building futures.", fontSize: 16, color: "#cbd5e1" },
      { schoolId: SCHOOL_ID, type: "BUTTON", x: 60, y: 170, width: 160, height: 44, text: "Contact Us", href: "#contact", backgroundColor: "#f59e0b", color: "#111827" },
    ],
  });

  const idCardStudent = await db.idCardTemplate.create({ data: { schoolId: SCHOOL_ID, name: "Student ID — Standard", audience: "STUDENT", orientation: "HORIZONTAL", isActive: true } });
  await db.idCardElement.createMany({
    data: [
      { templateId: idCardStudent.id, type: "TEXT", x: 20, y: 20, width: 200, height: 30, text: "Greenwood International School", fontSize: 14, fontWeight: 700 },
      { templateId: idCardStudent.id, type: "PHOTO", x: 20, y: 60, width: 80, height: 100 },
      { templateId: idCardStudent.id, type: "TEXT", x: 110, y: 60, width: 150, height: 24, text: "{{name}}", fontSize: 13 },
      { templateId: idCardStudent.id, type: "BARCODE", x: 110, y: 150, width: 100, height: 40, text: "{{admissionNo}}" },
    ],
  });
  const idCardStaff = await db.idCardTemplate.create({ data: { schoolId: SCHOOL_ID, name: "Staff ID — Standard", audience: "STAFF", orientation: "HORIZONTAL", isActive: true } });
  await db.idCardElement.createMany({
    data: [
      { templateId: idCardStaff.id, type: "TEXT", x: 20, y: 20, width: 200, height: 30, text: "Greenwood International School", fontSize: 14, fontWeight: 700 },
      { templateId: idCardStaff.id, type: "PHOTO", x: 20, y: 60, width: 80, height: 100 },
      { templateId: idCardStaff.id, type: "TEXT", x: 110, y: 60, width: 150, height: 24, text: "{{name}}", fontSize: 13 },
    ],
  });

  const FEATURE_KEYS = [
    "students.medicalInfo", "students.documents", "students.priorSchool", "students.siblings",
    "employees.documents", "employees.leave", "employees.shifts", "employees.detailedProfile",
    "attendance.studentLeave", "attendance.defaulterAlerts", "classes.capacityAndCurriculum", "classes.coTeacherAndReshuffle",
    "timetable.roomsAndConflicts", "exams.seatingAndBulkMarks", "exams.resultRelease", "homework.attachmentsAndDigest",
    "fees.discountsAndFines", "fees.gstReceipts", "accounts.chartOfAccounts", "accounts.approvals",
    "payroll.structuredSalary", "transport.liveLocation", "transport.complianceAndFees", "library.barcodesAndFines",
    "library.isbnLookup", "hostel.operations", "inventory.module", "compliance.udise",
    "reports.customBuilder", "admissions.detailedForm",
  ];
  await db.schoolFeatureFlag.createMany({ data: FEATURE_KEYS.map((key) => ({ schoolId: SCHOOL_ID, key, enabled: true })) });

  await db.dashboardReminder.createMany({
    data: [
      { schoolId: SCHOOL_ID, title: "Submit UDISE+ data", content: "Annual UDISE+ data submission deadline is approaching.", remindAt: addDays(now, 10) },
      { schoolId: SCHOOL_ID, title: "Renew fire safety NOC", content: "Fire safety compliance certificate needs renewal.", remindAt: addDays(now, 25) },
    ],
  });
  await db.dashboardNote.createMany({
    data: [{ schoolId: SCHOOL_ID, content: "Remember to finalize the Annual Day budget with the events committee." }, { schoolId: SCHOOL_ID, content: "Follow up with the transport vendor about the new bus quote." }],
  });
  await db.schoolComplianceDocument.createMany({
    data: [
      { schoolId: SCHOOL_ID, documentType: "Affiliation Certificate", documentNo: "CBSE-830123", issuedDate: daysAgo(700, now), expiryDate: addDays(now, 400) },
      { schoolId: SCHOOL_ID, documentType: "Fire Safety NOC", documentNo: "FSN-2025-441", issuedDate: daysAgo(300, now), expiryDate: daysAgo(10, now) },
      { schoolId: SCHOOL_ID, documentType: "Building Safety Certificate", documentNo: "BSC-2025-119", issuedDate: daysAgo(500, now), expiryDate: addDays(now, 200) },
    ],
  });
  console.log("  ✓ Settings (website, ID cards, feature flags, dashboard widgets, compliance docs)");

  // ==========================================================================
  // 20. ACCOUNTS — mirror the fee payments/payroll already seeded (the real
  // app auto-posts one AccountsTransaction per payment/payroll run; since
  // this seed writes rows directly rather than through those server
  // actions, it does the same mirroring here) + a few manual entries.
  // ==========================================================================
  const seededFeePayments = await db.feePayment.findMany({ where: { schoolId: SCHOOL_ID }, include: { student: true } });
  await db.accountsTransaction.createMany({
    data: seededFeePayments.map((p) => ({ schoolId: SCHOOL_ID, date: p.paidOn, description: `Fee payment — ${p.student.firstName} ${p.student.surname}`, category: "Fees", source: "AUTO_FEES" as const, type: "INCOME" as const, amount: p.amount })),
  });
  const seededPayrollRuns = await db.payrollRun.findMany({ where: { schoolId: SCHOOL_ID, status: "PAID" }, include: { staff: { include: { user: true } } } });
  await db.accountsTransaction.createMany({
    data: seededPayrollRuns.map((r) => ({ schoolId: SCHOOL_ID, date: r.paidOn ?? now, description: `Staff salary — ${r.staff.user.name} (${r.month})`, category: "Payroll", source: "AUTO_PAYROLL" as const, type: "EXPENSE" as const, amount: r.amount })),
  });
  await db.accountsTransaction.createMany({
    data: [
      { schoolId: SCHOOL_ID, date: daysAgo(15, now), description: "Electricity bill — campus", category: "Utilities", source: "MANUAL" as const, type: "EXPENSE" as const, amount: 42000 },
      { schoolId: SCHOOL_ID, date: daysAgo(20, now), description: "Water supply charges", category: "Utilities", source: "MANUAL" as const, type: "EXPENSE" as const, amount: 8500 },
      { schoolId: SCHOOL_ID, date: daysAgo(10, now), description: "Stationery bulk purchase", category: "Supplies", source: "MANUAL" as const, type: "EXPENSE" as const, amount: 15600 },
      { schoolId: SCHOOL_ID, date: daysAgo(5, now), description: "Building maintenance — plumbing repairs", category: "Maintenance", source: "MANUAL" as const, type: "EXPENSE" as const, amount: 9200 },
      { schoolId: SCHOOL_ID, date: daysAgo(3, now), description: "Donation received — alumni association", category: "Donations", source: "MANUAL" as const, type: "INCOME" as const, amount: 50000 },
    ],
  });
  console.log("  ✓ Accounts (fee/payroll mirrors + manual entries)");

  // --- Subscription invoice/payment (this school's own account with Vidya Yati) ---
  const invoice = await db.subscriptionInvoice.create({ data: { schoolId: SCHOOL_ID, amount: 150000, billingPeriod: fyLabel(now), dueDate: daysAgo(340, now), status: "PAID" } });
  const payment = await db.subscriptionPayment.create({ data: { invoiceId: invoice.id, amount: 150000, method: "Bank transfer", paidOn: daysAgo(335, now) } });
  await db.ledgerEntry.create({ data: { entryType: "INCOME", ledgerAccountId: "la-subscription-revenue", amount: 150000, date: daysAgo(335, now), description: "Subscription payment — Greenwood International School", method: "Bank transfer", source: "AUTO_SUBSCRIPTION", subscriptionPaymentId: payment.id } });

  const staffUsername = staffUsers[0].username;
  const parentUsername = parentUsers[0].username;
  return { adminUsername, staffUsername, parentUsername };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
