import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Reuse one client across hot reloads in development.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
