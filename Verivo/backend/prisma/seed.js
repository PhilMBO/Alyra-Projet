const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.admin.findUnique({
    where: { email: "superadmin@verivo.io" },
  });

  if (existing) {
    console.log("Super admin existe deja.");
    return;
  }

  const passwordHash = await bcrypt.hash("SuperAdmin123!", 10);

  const superAdmin = await prisma.admin.create({
    data: {
      email: "superadmin@verivo.io",
      passwordHash,
      displayName: "Super Admin",
      role: "SUPER_ADMIN",
    },
  });

  console.log("Super admin cree :", superAdmin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
