import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

type VaultChainPushRequest = {
  capsule: string;
  authorized_device: string;
  biometric_required: boolean;
  glyph_today: string;
  vault_commit: boolean;
};

type VaultChainPushResponse = {
  status: "success" | "error";
  message: string;
  pushId?: string;
  timestamp: string;
};

type PushLog = {
  pushId: string;
  capsule: string;
  authorized_device: string;
  biometric_required: boolean;
  glyph_today: string;
  vault_commit: boolean;
  timestamp: string;
};

const pushLogPath = path.join(process.cwd(), "capsule_logs", "vaultchain_push.json");
const GLYPH_LOCK = "🤛🏻";

const readPushLog = (): PushLog[] => {
  if (!fs.existsSync(pushLogPath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(pushLogPath, "utf8")) as PushLog[];
  } catch (error) {
    console.error("Error reading push log file:", error);
    return [];
  }
};

const writePushLog = (logs: PushLog[]): void => {
  fs.mkdirSync(path.dirname(pushLogPath), { recursive: true });
  fs.writeFileSync(pushLogPath, JSON.stringify(logs, null, 2));
};

const validateGlyphToday = (glyph: string): boolean => {
  // Glyph format: 🤛🏻YYYYMMDD (e.g., 🤛🏻20260211)
  const glyphPattern = new RegExp(`^${GLYPH_LOCK}\\d{8}$`);
  if (!glyphPattern.test(glyph)) {
    return false;
  }

  // Extract and validate the date portion
  const dateStr = glyph.substring(GLYPH_LOCK.length);
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);

  // Basic date validation
  if (year < 2020 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // More precise validation using Date object
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const validateCapsuleName = (capsule: string): boolean => {
  // Must be a .aoscap file
  return typeof capsule === "string" && capsule.endsWith(".aoscap") && capsule.length > 7;
};

const handler = (req: NextApiRequest, res: NextApiResponse<VaultChainPushResponse>) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      status: "error",
      message: "Method not allowed. Use POST.",
      timestamp: new Date().toISOString(),
    });
  }

  const {
    capsule,
    authorized_device,
    biometric_required,
    glyph_today,
    vault_commit,
  } = req.body as Partial<VaultChainPushRequest>;

  // Validate required fields
  if (!capsule) {
    return res.status(400).json({
      status: "error",
      message: "Missing required field: capsule",
      timestamp: new Date().toISOString(),
    });
  }

  if (!authorized_device) {
    return res.status(400).json({
      status: "error",
      message: "Missing required field: authorized_device",
      timestamp: new Date().toISOString(),
    });
  }

  if (typeof biometric_required !== "boolean") {
    return res.status(400).json({
      status: "error",
      message: "Missing or invalid field: biometric_required (must be boolean)",
      timestamp: new Date().toISOString(),
    });
  }

  if (!glyph_today) {
    return res.status(400).json({
      status: "error",
      message: "Missing required field: glyph_today",
      timestamp: new Date().toISOString(),
    });
  }

  if (typeof vault_commit !== "boolean") {
    return res.status(400).json({
      status: "error",
      message: "Missing or invalid field: vault_commit (must be boolean)",
      timestamp: new Date().toISOString(),
    });
  }

  // Validate capsule name format
  if (!validateCapsuleName(capsule)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid capsule name. Must be a .aoscap file.",
      timestamp: new Date().toISOString(),
    });
  }

  // Validate glyph_today format
  if (!validateGlyphToday(glyph_today)) {
    return res.status(400).json({
      status: "error",
      message: `Invalid glyph_today format. Expected ${GLYPH_LOCK}YYYYMMDD (e.g., ${GLYPH_LOCK}20260211)`,
      timestamp: new Date().toISOString(),
    });
  }

  // Generate push ID using crypto for security
  const timestamp = new Date().toISOString();
  const randomId = crypto.randomBytes(6).toString("hex");
  const pushId = `push_${Date.now()}_${randomId}`;

  // Create push log entry
  const pushEntry: PushLog = {
    pushId,
    capsule,
    authorized_device,
    biometric_required,
    glyph_today,
    vault_commit,
    timestamp,
  };

  // Read existing logs, append new entry, and write back
  try {
    const logs = readPushLog();
    logs.push(pushEntry);
    writePushLog(logs);

    return res.status(200).json({
      status: "success",
      message: `VaultChain push accepted for capsule '${capsule}'`,
      pushId,
      timestamp,
    });
  } catch (error) {
    console.error("Error writing push log:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to process VaultChain push",
      timestamp: new Date().toISOString(),
    });
  }
};

export default handler;
