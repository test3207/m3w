import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import userRoutes from "../../routes/user";
import type { ApiResponse, UserPreferences } from "@m3w/shared";

// Mock Prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock auth middleware
vi.mock("../../lib/auth-middleware", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("auth", { userId: "test-user-id", email: "test@example.com" });
    await next();
  }),
}));

// Mock logger
vi.mock("../../lib/logger", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    logger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
  };
});

// Import mocked modules for assertions
import { prisma } from "../../lib/prisma";

// Create app with user routes
const app = new Hono();
app.route("/api/user", userRoutes);

describe("User Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/user/preferences", () => {
    it("should return user preferences", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        cacheAllEnabled: true,
      } as never);

      const res = await app.request("/api/user/preferences");
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<UserPreferences>;
      expect(json.success).toBe(true);
      expect(json.data?.cacheAllEnabled).toBe(true);
    });

    it("should return default preferences (cacheAllEnabled: false)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "test-user-id",
        cacheAllEnabled: false,
      } as never);

      const res = await app.request("/api/user/preferences");
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<UserPreferences>;
      expect(json.success).toBe(true);
      expect(json.data?.cacheAllEnabled).toBe(false);
    });

    it("should return 404 when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await app.request("/api/user/preferences");
      expect(res.status).toBe(404);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("User not found");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/user/preferences");
      expect(res.status).toBe(500);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to fetch user preferences");
    });
  });

  describe("PUT /api/user/preferences", () => {
    it("should update cacheAllEnabled to true", async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "test-user-id",
        cacheAllEnabled: true,
      } as never);

      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheAllEnabled: true }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<UserPreferences>;
      expect(json.success).toBe(true);
      expect(json.data?.cacheAllEnabled).toBe(true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "test-user-id" },
        data: { cacheAllEnabled: true },
        select: { cacheAllEnabled: true },
      });
    });

    it("should update cacheAllEnabled to false", async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "test-user-id",
        cacheAllEnabled: false,
      } as never);

      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheAllEnabled: false }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<UserPreferences>;
      expect(json.success).toBe(true);
      expect(json.data?.cacheAllEnabled).toBe(false);
    });

    it("should return 400 for invalid data type", async () => {
      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheAllEnabled: "not-a-boolean" }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Validation failed");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cacheAllEnabled: true }),
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to update user preferences");
    });
  });
});
