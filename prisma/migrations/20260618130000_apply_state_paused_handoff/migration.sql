-- Add PAUSED and HANDOFF to ApplyState for captcha/handoff flows (Phase 5).
ALTER TYPE "ApplyState" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "ApplyState" ADD VALUE IF NOT EXISTS 'HANDOFF';
