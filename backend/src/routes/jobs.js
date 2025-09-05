import { Router } from "express";
import { enqueueJob, getJobStatus } from "../controllers/jobsController";

const router = Router();

// Encolar un nuevo job
router.post("/enqueue", enqueueJob);

// Consultar estado de un job
router.get("/:id/status", getJobStatus);

export default router;
