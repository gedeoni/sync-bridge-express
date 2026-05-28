import express from 'express';
import type { Router } from 'express';
import syncRoutes from '../api/controllers/sync/sync.routes';
import statusRoutes from '../api/controllers/status/status.routes';
import syncHistoryRoutes from '../api/controllers/sync-history/syncHistory.routes';
import { isAuth } from '../middlewares/auth.middleware';

export class MainRoutes {
  private readonly _router = express.Router();

  constructor() {
    this.routes();
  }

  public get router(): Router {
    return this._router;
  }

  private routes(): void {
    this._router.use('/sync', isAuth, syncRoutes);
    this._router.use('/healthz', statusRoutes);
    this._router.use('/sync-history', isAuth, syncHistoryRoutes);
  }
}
