export type FacultyMember = {
  name: string;
  department: string;
  role?: string;
  image?: string;
};

/** Display order of the department groups on the staff page. */
export const departmentOrder = [
  "Commerce",
  "English",
  "Malayalam",
  "Arabic",
  "",
] as const;

export const faculty: FacultyMember[] = [
  {
    name: "Ayshathul Misriya",
    department: "Commerce",
    role: "Head of Department",
  },
  { name: "GeethaRani P. K", department: "Commerce" },
  { name: "Sruthy C", department: "Commerce" },
  { name: "Sandhya", department: "Commerce" },
  { name: "Dhanya E S", department: "Commerce" },
  { name: "Supriya", department: "Commerce" },
  { name: "Balkees M N", department: "Commerce" },
  { name: "Monisha", department: "English", role: "Head of Department" },
  { name: "Induja", department: "English" },
  { name: "Vrindha", department: "English" },
  { name: "Bhagya Lakshmi", department: "English" },
  { name: "Balkees", department: "Malayalam", role: "Head of Department" },
  {
    name: "Muhammed Anas",
    department: "Arabic",
    role: "Head of Department",
  },
  { name: "Sumith", department: "" },
  { name: "Savitha", department: "" },
  { name: "Karthiayani", department: "" },
];

export type FacultyGroup = {
  key: string;
  label: string;
  members: FacultyMember[];
};

export const facultyByDepartment: FacultyGroup[] = departmentOrder
  .map((department) => ({
    key: department ? department.toLowerCase() : "staff",
    label: department || "Staff",
    members: faculty.filter((member) => member.department === department),
  }))
  .filter((group) => group.members.length > 0);

export const namedDepartments = facultyByDepartment
  .filter((group) => group.key !== "staff")
  .map((group) => group.label);

/** Head of Department per department, derived from each member's `role`. */
export const hodByDepartment = faculty.reduce<Record<string, string>>(
  (acc, member) => {
    const isHead = member.role?.toLowerCase().includes("head of department");
    if (member.department && isHead && !acc[member.department]) {
      acc[member.department] = member.name;
    }
    return acc;
  },
  {}
);
