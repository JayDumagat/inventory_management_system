import { Response } from "express";
import { z } from "zod";

export function handleControllerError(error: unknown, res: Response): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.issues });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
