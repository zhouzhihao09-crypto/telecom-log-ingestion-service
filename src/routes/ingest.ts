import { FastifyPluginAsync } from "fastify";
import { logger } from "../utils/logger";
import { validateEvent, validateEventBatch } from "../utils/validate";
import { IngestionService } from "../services/ingestionService";

export interface IngestOptions {
  ingestionService: IngestionService;
}

export const ingestRoute: FastifyPluginAsync<IngestOptions> = async (fastify, opts) => {
  const { ingestionService } = opts;

  fastify.post("/api/events", async (request, reply) => {
    const body = request.body as Record<string, unknown> | unknown;

    if (!body || typeof body !== "object") {
      reply.code(400);
      return { error: "Request body must be a JSON object", code: "INVALID_FORMAT" };
    }

    if (Array.isArray(body)) {
      const result = validateEventBatch({ events: body });
      if (!result.valid) {
        reply.code(400);
        return { error: result.error, code: result.code };
      }

      const { accepted } = await ingestionService.enqueueBatch(result.data);
      logger.info(`Accepted batch of ${accepted} events`);
      reply.code(202);
      return { accepted };
    }

    const bodyObj = body as Record<string, unknown>;

    if ("events" in bodyObj) {
      const eventsArray = bodyObj.events as unknown[];
      const result = validateEventBatch({ events: eventsArray });
      if (!result.valid) {
        reply.code(400);
        return { error: result.error, code: result.code };
      }

      const { accepted } = await ingestionService.enqueueBatch(result.data);
      logger.info(`Accepted batch of ${accepted} events`);
      reply.code(202);
      return { accepted };
    }

    const result = validateEvent(bodyObj);
    if (!result.valid) {
      reply.code(400);
      return { error: result.error, code: result.code };
    }

    await ingestionService.enqueue(result.data);
    logger.info(`Accepted single event: ${result.data.eventId}`);
    reply.code(202);
    return { accepted: 1 };
  });
};