import Fastify, { FastifyInstance, FastifyError } from "fastify";
import { config } from "./config";
import { logger } from "./utils/logger";
import { waitForDatabase } from "./db/pool";
import { runMigrations } from "./db/migrate";
import { healthRoute } from "./routes/health";
import { ingestRoute } from "./routes/ingest";
import { IngestionService } from "./services/ingestionService";

export interface ServerOptions {
  ingestionService?: IngestionService;
}

export async function createServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  const ingestionService = opts.ingestionService ?? new IngestionService();

  const app = Fastify({
    logger: false,
    bodyLimit: config.maxRequestSize,
  });

  app.addHook("preHandler", async (request, _reply) => {
    logger.debug(`${request.method} ${request.url}`);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode === 413) {
      reply.code(413);
      reply.send({ error: "Request body too large", code: "PAYLOAD_TOO_LARGE" });
      return;
    }

    if (error.statusCode === 415) {
      reply.code(400);
      reply.send({ error: "Content-Type must be application/json", code: "INVALID_CONTENT_TYPE" });
      return;
    }

    if (error.validation) {
      reply.code(400);
      reply.send({ error: error.message, code: "VALIDATION_ERROR" });
      return;
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode);
      reply.send({ error: error.message, code: "CLIENT_ERROR" });
      return;
    }

    logger.error(`Unhandled error on ${request.method} ${request.url}`, error);
    reply.code(500);
    reply.send({ error: "Internal server error", code: "INTERNAL_ERROR" });
  });

  app.register(healthRoute);
  app.register(ingestRoute, { ingestionService });

  return app;
}

export async function bootstrap(): Promise<FastifyInstance> {
  try {
    await waitForDatabase();
    await runMigrations();
    logger.info("Database ready, migrations applied");
  } catch (err) {
    logger.error("Failed to initialize database", err);
    process.exit(1);
  }

  const ingestionService = new IngestionService(
    config.batching.batchSize,
    config.batching.intervalMs
  );
  ingestionService.start();

  const app = await createServer({ ingestionService });

  await app.listen({
    port: config.port,
    host: config.host,
  });

  logger.info(`Server listening on ${config.host}:${config.port}`);

  return app;
}

if (require.main === module) {
  void bootstrap();
}
