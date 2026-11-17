
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

// Environment configuration
const secret = process.env.JWT_SECRET || "";

if (secret.length < 32) {
  throw new Error("Set JWT_SECRET to at least 32 characters");
}

const app = express();
const db = new PrismaClient();
const PORT = Number(process.env.PORT || 4000);

// Middleware
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Request type
type Req = express.Request & {
  uid?: string;
};

// Authentication cookie
function cookie(res: express.Response, id: string) {
  res.cookie(
    "adrsimple_session",
    jwt.sign({ sub: id }, secret, { expiresIn: "8h" }),
    {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: 28800000,
    }
  );
}

// Authentication middleware
async function auth(
  req: Req,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const token = req.cookies?.adrsimple_session;

    if (!token) throw new Error("No token");

    const payload = jwt.verify(token, secret) as jwt.JwtPayload;

    if (!payload.sub) throw new Error("Invalid token");

    req.uid = payload.sub;
    next();
  } catch {
    return res.status(401).json({
      error: "Please sign in again.",
    });
  }
}

// Procedural stages
const stages = [
  "Invocation",
  "Appointment",
  "Pleadings",
  "Admission/denial of documents",
  "Interim applications",
  "Evidence",
  "Examination-in-chief",
  "Cross-examination",
  "Re-examination",
  "Final arguments",
  "Award",
  "Other",
];

// Event types
const eventTypes = [
  "INVOCATION",
  "APPOINTMENT",
  "PLEADING",
  "CLAIM",
  "DEFENCE",
  "COUNTERCLAIM",
  "REJOINDER",
  "DOCUMENT_ADMISSION_DENIAL",
  "INTERIM_APPLICATION",
  "INTERIM_ORDER",
  "EVIDENCE",
  "AFFIDAVIT",
  "EXAMINATION_IN_CHIEF",
  "CROSS_EXAMINATION",
  "RE_EXAMINATION",
  "HEARING",
  "MINUTES",
  "ORDER",
  "PROCEDURAL_DIRECTION",
  "FINAL_ARGUMENTS",
  "AWARD",
  "OTHER",
] as const;

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Register
app.post("/api/auth/register", async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(12).max(128),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Use a valid name/email and password of at least 12 characters.",
    });
  }

  try {
    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    cookie(res, user.id);

    return res.status(201).json({ user });
  } catch {
    return res.status(409).json({
      error: "Account already exists or could not be created.",
    });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Enter email and password.",
    });
  }

  const user = await db.user.findUnique({
    where: {
      email: parsed.data.email.toLowerCase(),
    },
  });

  if (
    !user ||
    !(await bcrypt.compare(parsed.data.password, user.passwordHash))
  ) {
    return res.status(401).json({
      error: "Email or password is incorrect.",
    });
  }

  cookie(res, user.id);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

// Logout
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("adrsimple_session", {
    path: "/",
  });

  res.json({ ok: true });
});

// Current user
app.get("/api/auth/me", auth, async (req: Req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.uid! },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  res.json({ user });
});

// Get all matters
app.get("/api/matters", auth, async (req: Req, res) => {
  const matters = await db.matter.findMany({
    where: {
      createdById: req.uid!,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      _count: {
        select: {
          events: true,
          directions: true,
        },
      },
    },
  });

  res.json({ matters });
});

// Event validation schema
const evSchema = z.object({
  eventType: z.enum(eventTypes),
  title: z.string().min(2).max(200),
  eventDate: z.string().datetime(),
  description: z.string().max(5000).optional().nullable(),
  status: z
    .enum(["COMPLETED", "PENDING", "NOT_APPLICABLE", "NOT_RECORDED"])
    .default("COMPLETED"),
  source: z.string().max(200).optional().nullable(),
});

// Create matter
app.post("/api/matters", auth, async (req: Req, res) => {
  const parsed = z
    .object({
      title: z.string().min(3).max(250),
      matterType: z
        .enum(["ARBITRATION", "MEDIATION", "CONCILIATION", "OTHER"])
        .default("ARBITRATION"),
      onboardingMode: z.enum(["COMMENCEMENT", "ONGOING"]),
      appointmentDate: z.string().optional().nullable(),
      currentStage: z.string().min(2).max(100),
      institution: z.string().max(150).optional().nullable(),
      referenceNumber: z.string().max(150).optional().nullable(),
      seat: z.string().max(150).optional().nullable(),
      description: z.string().max(5000).optional().nullable(),
      historicalEvents: z.array(evSchema).max(200).default([]),
      pendingDirections: z
        .array(
          z.object({
            description: z.string().min(2).max(1000),
            dueDate: z.string().optional().nullable(),
          })
        )
        .max(100)
        .default([]),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Check the matter details and historical dates.",
    });
  }

  const data = parsed.data;

  try {
    const matter = await db.$transaction(async (tx) => {
      const created = await tx.matter.create({
        data: {
          matterCode: `AS-${Date.now().toString(36).toUpperCase()}`,
          title: data.title,
          matterType: data.matterType,
          onboardingMode: data.onboardingMode,
          appointmentDate: data.appointmentDate
            ? new Date(data.appointmentDate)
            : null,
          currentStage: data.currentStage,
          institution: data.institution || null,
          referenceNumber: data.referenceNumber || null,
          seat: data.seat || null,
          description: data.description || null,
          createdById: req.uid!,
        },
      });

      if (data.historicalEvents.length) {
        await tx.proceduralEvent.createMany({
          data: data.historicalEvents.map((event) => ({
            ...event,
            matterId: created.id,
            eventDate: new Date(event.eventDate),
            description: event.description || null,
            source: event.source || "Retrospective onboarding",
          })),
        });
      }

      if (data.pendingDirections.length) {
        await tx.pendingDirection.createMany({
          data: data.pendingDirections.map((direction) => ({
            matterId: created.id,
            description: direction.description,
            dueDate: direction.dueDate
              ? new Date(direction.dueDate)
              : null,
          })),
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: req.uid!,
          matterId: created.id,
          action: "MATTER_CREATED",
          details: {
            mode: data.onboardingMode,
            stage: data.currentStage,
          },
        },
      });

      return created;
    });

    return res.status(201).json({ matter });
  } catch (error) {
    console.error("Create matter error:", error);

    return res.status(500).json({
      error: "Could not register matter.",
    });
  }
});

// Normalize Express route parameters (Express 5 may type them as string | string[]).
function getRouteParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new Error("Invalid route parameter");
  }
  return value;
}

// Check matter ownership
async function owned(id: string, uid: string) {
  return db.matter.findFirst({
    where: {
      id,
      createdById: uid,
    },
  });
}

// Get single matter
app.get("/api/matters/:id", auth, async (req: Req, res) => {
  const matterId = getRouteParam(req.params.id);
  if (!(await owned(matterId, req.uid!))) {
    return res.status(404).json({
      error: "Matter not found or access denied.",
    });
  }

  const matter = await db.matter.findUnique({
    where: {
      id: matterId,
    },
    include: {
      events: {
        orderBy: {
          eventDate: "asc",
        },
      },
      directions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  res.json({ matter });
});

// Add procedural event
app.post("/api/matters/:id/events", auth, async (req: Req, res) => {
  const matterId = getRouteParam(req.params.id);
  if (!(await owned(matterId, req.uid!))) {
    return res.status(404).json({
      error: "Matter not found or access denied.",
    });
  }

  const parsed = evSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid event details.",
    });
  }

  const event = await db.proceduralEvent.create({
    data: {
      ...parsed.data,
      matterId: matterId,
      eventDate: new Date(parsed.data.eventDate),
      description: parsed.data.description || null,
      source: parsed.data.source || "Entered in ADRsimple",
    },
  });

  await db.auditEvent.create({
    data: {
      userId: req.uid!,
      matterId: matterId,
      action: "PROCEDURAL_EVENT_ADDED",
      details: {
        eventId: event.id,
      },
    },
  });

  res.status(201).json({ event });
});

// Update matter stage
app.patch("/api/matters/:id/stage", auth, async (req: Req, res) => {
  const matterId = getRouteParam(req.params.id);
  if (!(await owned(matterId, req.uid!))) {
    return res.status(404).json({
      error: "Matter not found or access denied.",
    });
  }

  const parsed = z
    .object({
      currentStage: z.enum(stages as [string, ...string[]]),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Select a valid stage.",
    });
  }

  const matter = await db.matter.update({
    where: {
      id: matterId,
    },
    data: {
      currentStage: parsed.data.currentStage,
    },
  });

  await db.auditEvent.create({
    data: {
      userId: req.uid!,
      matterId: matterId,
      action: "CURRENT_STAGE_CHANGED",
      details: {
        stage: parsed.data.currentStage,
      },
    },
  });

  res.json({ matter });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`ADRsimple API listening on http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
