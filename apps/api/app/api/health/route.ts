// import { type NextRequest, NextResponse } from "next/server";
// import prisma from "@/lib/prisma";
// import redis from "@/lib/redis";

// export async function GET(request: NextRequest) {
//   try {
//     // Check database connection
//     await prisma.$queryRaw`SELECT 1`;

//     // Check Redis connection (optional)
//     let redisStatus = "disconnected";
//     try {
//       await redis?.ping();
//       redisStatus = "connected";
//     } catch {
//       redisStatus = "disconnected (optional)";
//     }

//     return NextResponse.json({
//       success: true,
//       status: "healthy",
//       timestamp: new Date().toISOString(),
//       services: {
//         database: "connected",
//         redis: redisStatus,
//         api: "running",
//       },
//     });
//   } catch (error) {
//     console.error("[v0] Health check error:", error);
//     return NextResponse.json(
//       {
//         success: false,
//         status: "unhealthy",
//         error: error instanceof Error ? error.message : "Unknown error",
//       },
//       { status: 503 },
//     );
//   }
// }
