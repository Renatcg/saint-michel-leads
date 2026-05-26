import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME ?? "Administrador";

  if (!email || !password) {
    throw new Error("Configure ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD antes de rodar o seed.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
    update: {
      name,
      passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
  });

  console.log(`Admin pronto: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
