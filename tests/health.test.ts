import { createServer } from "../src/server";

describe("Health Endpoint", () => {
  let app: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 200 with status ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
  });

  it("should return JSON content type", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.headers["content-type"]).toContain("application/json");
  });
});
