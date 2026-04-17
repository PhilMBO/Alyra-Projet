const { PrismaClient } = require("@prisma/client");
const { Wallet } = require("ethers");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean (en dev uniquement)
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // Deux wallets de test deterministes (Hardhat account[0] et [1])
  const wallet1 = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const wallet2 = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

  await prisma.user.create({
    data: {
      walletAddress: wallet1.address,
      displayName: "Alice (Hardhat #0)",
    },
  });
  await prisma.user.create({
    data: {
      walletAddress: wallet2.address,
      displayName: "Bob (Hardhat #1)",
    },
  });

  console.log("Done.");
  console.log("  Alice :", wallet1.address);
  console.log("  Bob   :", wallet2.address);
}

main().catch(console.error).finally(() => prisma.$disconnect());