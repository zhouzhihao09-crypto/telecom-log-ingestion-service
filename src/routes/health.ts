import { FastifyPluginAsync } from "fastify";
import { getPool } from "../db/pool";
import { logger } from "../utils/logger";

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async (request, reply) => {
    let dbStatus = "ok";
    let dbError: string | null = null;

    try {
      const pool = getPool();
      await pool.query("SELECT 1");
    } catch (err) {
      dbStatus = "error";
      dbError = (err as Error).message;
      reply.code(503);
    }

    return {
      status: dbStatus === "ok" ? "ok" : "degraded",
      database: dbStatus,
      ...(dbError ? { error: dbError } : {}),
    };
  });
};
