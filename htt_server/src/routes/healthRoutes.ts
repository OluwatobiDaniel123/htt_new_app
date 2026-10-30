import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';

export const healthRoutes = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Return API operational status
 *     responses:
 *       200:
 *         description: The API process is operational.
 */
healthRoutes.get('/health', getHealth);
