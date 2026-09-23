import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createInitialDatabaseState, DatabaseState } from './seed';
import {
  Company,
  User,
  Role,
  Permission,
  AuditLog,
  AuditAction,
  Notification,
  NotificationType,
  Task,
  CompanyFile,
  CompanyMetrics,
  CustomField,
  TaskStatus,
  TaskPriority,
  TaskStatusSlug,
  TaskPrioritySlug,
  TaskNote,
  TaskAttachment,
  TaskTimelineEvent,
  UserDashboardConfig,
  BackupConfig,
  BackupMetadata,
} from '../../types/database';
import { PermissionKey } from '../../types/permissions';
import { AuthUser } from '../../types/auth';

class DatabaseStorage {
  private state: DatabaseState;
  private dataDir: string = process.env.VERCEL ? path.join('/tmp', 'enterprise_data') : path.resolve(process.cwd(), 'data');
  private dbFilePath: string;
  private dbBackupFilePath: string;
  private backupsDir: string;
  private configFilePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private autoBackupInterval: NodeJS.Timeout | null = null;

  // --- Backup & Restore Engine ---
  private backupConfig: BackupConfig = {
    autoBackupEnabled: true,
    frequency: 'daily',
    pathMode: 'auto',
    customPath: '/backups/enterprise/',
    retentionCount: 20,
  };

  private backupsList: BackupMetadata[] = [];

  // --- Cloud Database (PostgreSQL) Synchronization Engine for Vercel / Remote Hosting ---
  private pgPool: pg.Pool | null = null;
  private isPgInitialized: boolean = false;
  private lastRemoteSyncTime: number = 0;
  private isSyncing: boolean = false;

  constructor() {
    this.dbFilePath = path.join(this.dataDir, 'database.json');
    this.dbBackupFilePath = path.join(this.dataDir, 'database.json.bak');
    this.backupsDir = path.join(this.dataDir, 'backups');
    this.configFilePath = path.join(this.dataDir, 'backup_config.json');

    // Ensure required directories exist
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.backupsDir)) {
        fs.mkdirSync(this.backupsDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[DatabaseStorage] Could not create storage directories:', e);
    }

    // Load backup configuration if exists
    this.loadBackupConfig();

    // Initialize PostgreSQL remote synchronization if DATABASE_URL or POSTGRES_URL is configured
    this.initPostgres();

    // Load persistent database state with multi-layer fallback
    this.state = this.loadPersistedState() || createInitialDatabaseState();
    this.ensureZeroBasedTaskCodes();
    this.syncRoleNamesAndNotifications();
    this.persistStateImmediately();

    // Load existing backups from disk
    this.loadBackupsFromDisk();

    // Initialize auto-backup background timer
    this.initAutoBackupScheduler();
  }

  private syncRoleNamesAndNotifications(): void {
    if (this.state && Array.isArray(this.state.roles)) {
      this.state.roles.forEach(r => {
        if (r.slug === 'admin') {
          r.nameAr = 'ادمن';
          r.nameEn = 'Admin';
        }
        if (r.slug === 'manager_owner') {
          r.nameAr = 'مدير';
          r.nameEn = 'Manager';
        }
      });
    }
    if (this.state && Array.isArray(this.state.notifications)) {
      this.state.notifications.forEach((n: any) => {
        if (!n.readByUserIds) {
          n.readByUserIds = n.isRead && n.userId ? [n.userId] : [];
        }
      });
    }
  }

  private ensureZeroBasedTaskCodes(): void {
    if (!this.state || !Array.isArray(this.state.tasks)) return;
    const hasLegacy1001 = this.state.tasks.some(t => t.taskCode === 'TSK-1001');
    if (hasLegacy1001) {
      console.log('[DatabaseStorage] Migrating legacy TSK-100x task codes to start from zero (TSK-0000...)');
      const mapping: Record<string, string> = {};
      this.state.tasks.forEach((t, i) => {
        const oldCode = t.taskCode;
        const newCode = `TSK-${String(i).padStart(4, '0')}`;
        if (oldCode) mapping[oldCode] = newCode;
        t.taskCode = newCode;
      });
      if (Array.isArray(this.state.notifications)) {
        this.state.notifications.forEach(n => {
          if (n.taskCode && mapping[n.taskCode]) {
            n.taskCode = mapping[n.taskCode];
          }
          for (const [oldCode, newCode] of Object.entries(mapping)) {
            if (n.messageEn && n.messageEn.includes(oldCode)) n.messageEn = n.messageEn.replaceAll(oldCode, newCode);
            if (n.messageAr && n.messageAr.includes(oldCode)) n.messageAr = n.messageAr.replaceAll(oldCode, newCode);
          }
        });
      }
    }
  }

  private loadBackupConfig(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        if (raw && raw.trim()) {
          const cfg = JSON.parse(raw);
          this.backupConfig = { ...this.backupConfig, ...cfg };
        }
      }
    } catch (err) {
      console.warn('[DatabaseStorage] Could not load backup_config.json:', err);
    }
  }

  private saveBackupConfig(): void {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.backupConfig, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DatabaseStorage] Could not save backup_config.json:', err);
    }
  }

  private initPostgres(): void {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      if (process.env.VERCEL) {
        console.warn(
          '[DatabaseStorage] Running on Vercel without DATABASE_URL. Ephemeral file storage in /tmp is active. ' +
          'To persist newly created users and edits permanently across all devices, configure DATABASE_URL in Vercel Environment Variables.'
        );
      }
      return;
    }

    try {
      this.pgPool = new pg.Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000,
      });

      this.pgPool.on('error', (err) => {
        console.warn('[DatabaseStorage] PostgreSQL pool background warning:', err.message);
      });

      console.log('[DatabaseStorage] PostgreSQL remote persistence pool initialized.');
    } catch (err: any) {
      console.warn('[DatabaseStorage] Could not create PostgreSQL pool:', err?.message || err);
      this.pgPool = null;
    }
  }

  public isPostgresConnected(): boolean {
    return !!this.pgPool;
  }

  public async syncFromRemoteIfAvailable(force: boolean = false): Promise<void> {
    if (!this.pgPool || this.isSyncing) return;

    const now = Date.now();
    // Throttle checks on rapid requests to avoid database hammering
    if (!force && now - this.lastRemoteSyncTime < 1500) return;

    this.isSyncing = true;
    try {
      if (!this.isPgInitialized) {
        await this.pgPool.query(`
          CREATE TABLE IF NOT EXISTS app_database_state (
            id VARCHAR(64) PRIMARY KEY,
            state JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        this.isPgInitialized = true;
      }

      const res = await this.pgPool.query(
        'SELECT state, updated_at FROM app_database_state WHERE id = $1',
        ['main_state']
      );

      if (res.rows && res.rows.length > 0) {
        const remoteState = res.rows[0].state;
        if (remoteState && Array.isArray(remoteState.users) && Array.isArray(remoteState.companies)) {
          this.state = remoteState;
          this.lastRemoteSyncTime = now;
        }
      } else {
        // Initialize remote database with current state on first run
        await this.pgPool.query(
          `INSERT INTO app_database_state (id, state, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
          ['main_state', JSON.stringify(this.state)]
        );
        this.lastRemoteSyncTime = now;
      }
    } catch (err: any) {
      console.warn('[DatabaseStorage] Remote PostgreSQL sync skipped:', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  private loadPersistedState(): DatabaseState | null {
    // 1. Try primary database file
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const fileContent = fs.readFileSync(this.dbFilePath, 'utf-8');
        if (fileContent && fileContent.trim().length > 0) {
          const parsed = JSON.parse(fileContent) as DatabaseState;
          if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.companies) && Array.isArray(parsed.tasks)) {
            console.log(`[DatabaseStorage] Successfully loaded persistent state from ${this.dbFilePath} (${parsed.users.length} users, ${parsed.tasks.length} tasks, ${parsed.companies.length} companies)`);
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('[DatabaseStorage] Failed to load primary database.json, attempting backup recovery:', err);
    }

    // 2. Fallback: try .bak file
    try {
      if (fs.existsSync(this.dbBackupFilePath)) {
        const backupContent = fs.readFileSync(this.dbBackupFilePath, 'utf-8');
        if (backupContent && backupContent.trim().length > 0) {
          const parsed = JSON.parse(backupContent) as DatabaseState;
          if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.companies) && Array.isArray(parsed.tasks)) {
            console.warn(`[DatabaseStorage] Recovered state from backup file: ${this.dbBackupFilePath}`);
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('[DatabaseStorage] Failed to load database.json.bak:', err);
    }

    // 3. Fallback: check backups directory for latest snapshot
    try {
      if (fs.existsSync(this.backupsDir)) {
        const files = fs.readdirSync(this.backupsDir).filter(f => f.endsWith('.json'));
        if (files.length > 0) {
          files.sort().reverse(); // latest first
          for (const file of files) {
            try {
              const fullPath = path.join(this.backupsDir, file);
              const raw = fs.readFileSync(fullPath, 'utf-8');
              const parsed = JSON.parse(raw);
              if (parsed && parsed.data && Array.isArray(parsed.data.tasks) && Array.isArray(parsed.data.companies)) {
                console.warn(`[DatabaseStorage] Recovered database state from snapshot backup: ${file}`);
                return parsed.data as DatabaseState;
              }
            } catch (e) {
              // try next
            }
          }
        }
      }
    } catch (err) {
      console.error('[DatabaseStorage] Failed to scan backups directory:', err);
    }

    // 4. Fallback for Vercel / serverless: copy bundled data/database.json if exists
    if (process.env.VERCEL) {
      try {
        const bundledPath = path.resolve(process.cwd(), 'data', 'database.json');
        if (fs.existsSync(bundledPath)) {
          const raw = fs.readFileSync(bundledPath, 'utf-8');
          const parsed = JSON.parse(raw) as DatabaseState;
          if (parsed && Array.isArray(parsed.users)) {
            console.log('[DatabaseStorage] Loaded initial seed from bundled data/database.json on Vercel');
            return parsed;
          }
        }
      } catch (e) {
        console.warn('[DatabaseStorage] Could not read bundled seed:', e);
      }
    }

    console.warn('[DatabaseStorage] No existing database or backup found. Initializing new clean database state.');
    return null;
  }

  public persistStateImmediately(): void {
    try {
      const dir = path.dirname(this.dbFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(this.state, null, 2);

      // Safe atomic write: write to temp file first, then rename
      const tempPath = `${this.dbFilePath}.tmp`;
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, this.dbFilePath);

      // Also maintain a verified backup copy
      try {
        fs.writeFileSync(this.dbBackupFilePath, data, 'utf-8');
      } catch (e) {
        // non-blocking
      }
    } catch (err) {
      console.error('[DatabaseStorage] Error persisting state to file:', err);
    }

    // 2. Persist state to remote PostgreSQL database (enables seamless multi-device persistence on Vercel)
    if (this.pgPool) {
      const statePayload = JSON.stringify(this.state);
      this.pgPool
        .query(
          `INSERT INTO app_database_state (id, state, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
          ['main_state', statePayload]
        )
        .catch((err) => {
          console.warn('[DatabaseStorage] PostgreSQL background persistence warning:', err?.message || err);
        });
    }
  }

  public persistState(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistStateImmediately();
      this.saveTimeout = null;
    }, 200);
  }

  private loadBackupsFromDisk(): void {
    try {
      if (!fs.existsSync(this.backupsDir)) return;
      const files = fs.readdirSync(this.backupsDir).filter(f => f.endsWith('.json'));
      const loaded: BackupMetadata[] = [];

      for (const file of files) {
        try {
          const fullPath = path.join(this.backupsDir, file);
          const stat = fs.statSync(fullPath);
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const parsed = JSON.parse(raw);

          loaded.push({
            id: `bk-${stat.mtimeMs || Date.now()}`,
            filename: file,
            filePath: fullPath,
            pathMode: parsed?.metadata?.pathMode || 'auto',
            createdAt: parsed?.exportedAt || stat.mtime.toISOString(),
            sizeBytes: stat.size,
            companiesCount: parsed?.metadata?.companiesCount || (parsed?.data?.companies?.length ?? 0),
            usersCount: parsed?.metadata?.usersCount || (parsed?.data?.users?.length ?? 0),
            tasksCount: parsed?.metadata?.tasksCount || (parsed?.data?.tasks?.length ?? 0),
            triggeredBy: parsed?.metadata?.triggeredBy || 'System Disk Storage',
            type: file.includes('auto') ? 'auto' : 'manual',
          });
        } catch (e) {
          // ignore corrupted individual backup file
        }
      }

      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.backupsList = loaded;
      console.log(`[DatabaseStorage] Loaded ${this.backupsList.length} verified backups from disk.`);
    } catch (err) {
      console.warn('[DatabaseStorage] Could not load backups from disk:', err);
    }
  }

  private initAutoBackupScheduler(): void {
    // In serverless environments (e.g. Vercel), background intervals should not run
    if (process.env.VERCEL) {
      return;
    }

    // Run an automated backup check every 15 minutes
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval);
    }
    this.autoBackupInterval = setInterval(() => {
      this.checkAndExecuteAutoBackup();
    }, 15 * 60 * 1000);
    if (this.autoBackupInterval && this.autoBackupInterval.unref) {
      this.autoBackupInterval.unref();
    }

    // Also trigger initial automatic backup on first boot if no backups exist
    const initTimer = setTimeout(() => {
      if (this.backupConfig.autoBackupEnabled && this.backupsList.length === 0) {
        try {
          this.generateBackupData('auto', undefined, { id: 'system', fullName: 'System Auto-Backup', email: 'system@internal' }, 'auto');
          console.log('[DatabaseStorage] Initial automated system backup created successfully.');
        } catch (e) {
          console.warn('[DatabaseStorage] Initial backup failed:', e);
        }
      }
    }, 5000);
    if (initTimer && initTimer.unref) {
      initTimer.unref();
    }
  }

  private checkAndExecuteAutoBackup(): void {
    if (!this.backupConfig.autoBackupEnabled) return;
    const now = Date.now();
    const lastBackupTime = this.backupConfig.lastBackupAt ? new Date(this.backupConfig.lastBackupAt).getTime() : 0;
    
    // Interval based on frequency
    let requiredIntervalMs = 24 * 60 * 60 * 1000; // default daily
    if (this.backupConfig.frequency === 'hourly') {
      requiredIntervalMs = 60 * 60 * 1000;
    } else if (this.backupConfig.frequency === 'weekly') {
      requiredIntervalMs = 7 * 24 * 60 * 60 * 1000;
    }

    if (now - lastBackupTime >= requiredIntervalMs) {
      try {
        console.log('[DatabaseStorage] Triggering scheduled automatic backup...');
        this.generateBackupData('auto', undefined, { id: 'system-auto', fullName: 'Automatic Scheduler', email: 'scheduler@internal' }, 'auto');
      } catch (err) {
        console.error('[DatabaseStorage] Scheduled auto-backup failed:', err);
      }
    }
  }

  public getState(): DatabaseState {
    return this.state;
  }

  // --- Audit Logging System ---
  public logAudit(entry: {
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    companyId?: string | null;
    companyName?: string | null;
    action: AuditAction;
    entity?: string;
    entityId?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    date?: string;
    time?: string;
    ipAddress?: string;
    userAgent?: string;
    status?: 'SUCCESS' | 'FAILURE' | 'WARNING';
    details?: Record<string, any>;
    resource?: string;
    resourceId?: string | null;
  }): AuditLog {
    const now = new Date();
    const nowIso = now.toISOString();
    const date = entry.date || nowIso.split('T')[0];
    const time = entry.time || nowIso.split('T')[1].substring(0, 8);
    const entity = entry.entity || entry.resource || 'SYSTEM';
    const entityId = entry.entityId || entry.resourceId || null;

    let userName = entry.userName;
    let userEmail = entry.userEmail;
    if (entry.userId) {
      const u = this.findUserById(entry.userId);
      if (u) {
        if (!userName) userName = u.fullName;
        if (!userEmail) userEmail = u.email;
      }
    }

    let companyName = entry.companyName;
    if (entry.companyId) {
      const c = this.getCompanyById(entry.companyId);
      if (c && !companyName) companyName = c.nameEn;
    }

    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: entry.userId || null,
      userName: userName || null,
      userEmail: userEmail || null,
      companyId: entry.companyId || null,
      companyName: companyName || null,
      action: entry.action,
      entity,
      entityId,
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      date,
      time,
      ipAddress: entry.ipAddress || '192.168.1.102',
      userAgent: entry.userAgent || 'Applet/Client',
      status: entry.status || 'SUCCESS',
      details: entry.details,
      createdAt: nowIso,
      resource: entity,
      resourceId: entityId,
    };

    this.state.auditLogs.unshift(log);
    if (this.state.auditLogs.length > 1000) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 1000);
    }
    return log;
  }

  public getAuditLogs(companyId?: string, limit = 100): AuditLog[] {
    let logs = this.state.auditLogs;
    if (companyId) {
      logs = logs.filter(l => !l.companyId || l.companyId === companyId);
    }
    return logs.slice(0, limit);
  }

  public queryAuditLogs(filters: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    userFilter?: string;
    actionFilter?: string;
    entityFilter?: string;
    companyId?: string;
    limit?: number;
    offset?: number;
  }) {
    let logs = [...this.state.auditLogs];

    // Company tenancy filter
    if (filters.companyId && filters.companyId !== 'all') {
      logs = logs.filter(l => !l.companyId || l.companyId === filters.companyId);
    }

    // User filter
    if (filters.userFilter && filters.userFilter !== 'all') {
      const userFilter = filters.userFilter.toLowerCase();
      logs = logs.filter(
        l => l.userId === filters.userFilter || l.userEmail?.toLowerCase() === userFilter
      );
    }

    // Action filter
    if (filters.actionFilter && filters.actionFilter !== 'all') {
      const targetAction = filters.actionFilter.toUpperCase();
      logs = logs.filter(l => {
        const a = (l.action || '').toUpperCase();
        return a === targetAction || a.includes(targetAction);
      });
    }

    // Entity filter
    if (filters.entityFilter && filters.entityFilter !== 'all') {
      const targetEntity = filters.entityFilter.toUpperCase();
      logs = logs.filter(l => {
        const e = (l.entity || l.resource || '').toUpperCase();
        return e === targetEntity;
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      logs = logs.filter(l => (l.date || l.createdAt.split('T')[0]) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      logs = logs.filter(l => (l.date || l.createdAt.split('T')[0]) <= filters.dateTo!);
    }

    // Search query
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      logs = logs.filter(l => {
        return (
          l.action?.toLowerCase().includes(q) ||
          l.entity?.toLowerCase().includes(q) ||
          l.entityId?.toLowerCase().includes(q) ||
          l.userName?.toLowerCase().includes(q) ||
          l.userEmail?.toLowerCase().includes(q) ||
          l.companyName?.toLowerCase().includes(q) ||
          l.ipAddress?.toLowerCase().includes(q) ||
          l.oldValue?.toLowerCase().includes(q) ||
          l.newValue?.toLowerCase().includes(q) ||
          JSON.stringify(l.details || {}).toLowerCase().includes(q)
        );
      });
    }

    const totalCount = logs.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = this.state.auditLogs.filter(l => (l.date || l.createdAt.split('T')[0]) === todayStr).length;
    const securityCount = this.state.auditLogs.filter(
      l => l.status === 'WARNING' || l.status === 'FAILURE' || ['PERMISSION_CHANGE', 'DELETE', 'ARCHIVE'].includes(l.action)
    ).length;

    const uniqueUsers = Array.from(
      new Map(
        this.state.auditLogs
          .filter(l => l.userId)
          .map(l => [l.userId, { id: l.userId, name: l.userName || l.userEmail, email: l.userEmail }])
      ).values()
    );

    const availableActions = [
      'LOGIN',
      'LOGOUT',
      'CREATE',
      'UPDATE',
      'DELETE',
      'ARCHIVE',
      'PERMISSION_CHANGE',
      'STATUS_CHANGE',
      'USER_CHANGE',
      'COMPANY_CHANGE',
      'FILE_UPLOAD',
      'FILE_DOWNLOAD',
    ];

    const availableEntities = [
      'TASKS',
      'COMPANIES',
      'USERS',
      'ROLES',
      'PERMISSIONS',
      'ATTACHMENTS',
      'FILES',
      'AUTH',
      'CUSTOM_FIELDS',
    ];

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const paginatedLogs = logs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      totalCount,
      todayCount,
      securityCount,
      uniqueUsers,
      availableActions,
      availableEntities,
    };
  }

  // --- Notification Center Engine (Per-User Read Tracking) ---
  public getNotifications(
    userId: string,
    isSuperAdmin: boolean,
    options?: { unreadOnly?: boolean; type?: string; limit?: number }
  ): { notifications: Notification[]; unreadCount: number } {
    let notifs = (this.state.notifications || []).filter(n => {
      if (isSuperAdmin) return true;
      return n.userId === userId;
    });

    const isReadForUser = (n: any) => {
      if (Array.isArray(n.readByUserIds)) {
        return n.readByUserIds.includes(userId);
      }
      return n.userId === userId && !!n.isRead;
    };

    const unreadCount = notifs.filter(n => !isReadForUser(n)).length;

    if (options?.unreadOnly) {
      notifs = notifs.filter(n => !isReadForUser(n));
    }

    if (options?.type && options.type !== 'all') {
      notifs = notifs.filter(n => n.type === options.type);
    }

    const limit = options?.limit || 100;
    const formatted = notifs.slice(0, limit).map(n => ({
      ...n,
      isRead: isReadForUser(n),
    }));

    return {
      notifications: formatted,
      unreadCount,
    };
  }

  public getUnreadNotificationsCount(userId: string, isSuperAdmin: boolean): number {
    return (this.state.notifications || []).filter(n => {
      const belongs = isSuperAdmin || n.userId === userId;
      if (!belongs) return false;
      if (Array.isArray(n.readByUserIds)) {
        return !n.readByUserIds.includes(userId);
      }
      return !n.isRead;
    }).length;
  }

  public createNotification(data: Omit<Notification, 'id' | 'createdAt'>): Notification {
    if (!this.state.notifications) this.state.notifications = [];
    const notif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      readByUserIds: [],
      ...data,
    };
    this.state.notifications.unshift(notif);
    if (this.state.notifications.length > 500) {
      this.state.notifications = this.state.notifications.slice(0, 500);
    }
    return notif;
  }

  public markNotificationAsRead(id: string, userId: string, isSuperAdmin: boolean, isRead = true): boolean {
    const notif = (this.state.notifications || []).find(n => n.id === id);
    if (!notif) return false;
    if (!isSuperAdmin && notif.userId !== userId) return false;
    if (!notif.readByUserIds) {
      notif.readByUserIds = notif.isRead && notif.userId ? [notif.userId] : [];
    }
    if (isRead) {
      if (!notif.readByUserIds.includes(userId)) {
        notif.readByUserIds.push(userId);
      }
    } else {
      notif.readByUserIds = notif.readByUserIds.filter((uid: string) => uid !== userId);
    }
    if (notif.userId === userId) {
      notif.isRead = isRead;
    }
    this.persistStateImmediately();
    return true;
  }

  public markAllNotificationsAsRead(userId: string, isSuperAdmin: boolean): number {
    let count = 0;
    (this.state.notifications || []).forEach(n => {
      if (isSuperAdmin || n.userId === userId) {
        if (!n.readByUserIds) {
          n.readByUserIds = n.isRead && n.userId ? [n.userId] : [];
        }
        if (!n.readByUserIds.includes(userId)) {
          n.readByUserIds.push(userId);
          if (n.userId === userId) {
            n.isRead = true;
          }
          count++;
        }
      }
    });
    this.persistStateImmediately();
    return count;
  }

  public deleteNotification(id: string, userId: string, isSuperAdmin: boolean): boolean {
    const idx = (this.state.notifications || []).findIndex(n => n.id === id);
    if (idx === -1) return false;
    const notif = this.state.notifications[idx];
    if (!isSuperAdmin && notif.userId !== userId) return false;
    this.state.notifications.splice(idx, 1);
    this.persistStateImmediately();
    return true;
  }

  // --- Users & Auth Queries ---
  public findUserByEmail(email: string): User | undefined {
    if (!email) return undefined;
    const normalized = email.trim().toLowerCase();
    const inputClean = normalized.replace(/[\s\-\+\(\)]/g, '');

    return this.state.users.find(u => {
      const emailLower = (u.email || '').toLowerCase();
      const nameLower = (u.fullName || '').toLowerCase();
      const nameArLower = (u.fullNameAr || '').toLowerCase();
      const phoneClean = (u.phone || '').replace(/[\s\-\+\(\)]/g, '');
      const userPrefix = emailLower.split('@')[0];

      return (
        emailLower === normalized ||
        userPrefix === normalized ||
        nameLower === normalized ||
        nameArLower === normalized ||
        (phoneClean.length > 3 && phoneClean === inputClean) ||
        (u.id === 'u1-super-admin' && (normalized === 'admin' || normalized === 'superadmin' || normalized === 'admin@holding.com' || normalized === 'superadmin@holding.com'))
      );
    });
  }

  public findUserById(id: string): User | undefined {
    return this.state.users.find(u => u.id === id);
  }

  public getAllUsers(): User[] {
    return this.state.users.map(({ passwordHash, ...user }) => user as User);
  }

  public getUserRoles(userId: string): Role[] {
    const userRoleMappings = this.state.userRoles.filter(ur => ur.userId === userId);
    const roleIds = userRoleMappings.map(ur => ur.roleId);
    return this.state.roles.filter(r => roleIds.includes(r.id));
  }

  public getUserCompanies(userId: string): Company[] {
    const userCompanyMappings = this.state.userCompanies.filter(uc => uc.userId === userId);
    const companyIds = userCompanyMappings.map(uc => uc.companyId);
    return this.state.companies.filter(c => companyIds.includes(c.id));
  }

  public getPrimaryCompany(userId: string): Company | undefined {
    const primary = this.state.userCompanies.find(uc => uc.userId === userId && uc.isPrimary);
    if (primary) {
      return this.state.companies.find(c => c.id === primary.companyId);
    }
    const anyCompany = this.getUserCompanies(userId)[0];
    return anyCompany;
  }

  public getUserPermissions(userId: string): PermissionKey[] {
    const roles = this.getUserRoles(userId);
    const isSuper = roles.some(r => r.slug === 'super_admin');
    if (isSuper) {
      // Super Admin holds all permissions
      return this.state.permissions.map(p => p.key);
    }

    const roleIds = roles.map(r => r.id);
    const granted = this.state.rolePermissions
      .filter(rp => roleIds.includes(rp.roleId))
      .map(rp => rp.permissionKey);

    // Ensure Tenant Admins and Managers have permission to view users within their company scope
    if (roles.some(r => r.slug === 'admin' || r.slug === 'manager_owner')) {
      if (!granted.includes(PermissionKey.USERS_VIEW)) granted.push(PermissionKey.USERS_VIEW);
    }
    if (roles.some(r => r.slug === 'admin')) {
      if (!granted.includes(PermissionKey.USERS_MANAGE)) granted.push(PermissionKey.USERS_MANAGE);
    }

    return Array.from(new Set(granted));
  }

  public buildAuthUser(user: User): AuthUser {
    const roles = this.getUserRoles(user.id);
    const isSuperAdmin = roles.some(r => r.slug === 'super_admin');
    const assignedCompanies = isSuperAdmin ? this.state.companies : this.getUserCompanies(user.id);
    const primaryCompany = this.getPrimaryCompany(user.id) || assignedCompanies[0];
    const permissions = this.getUserPermissions(user.id);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      fullNameAr: user.fullNameAr,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isArchived: user.isArchived,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
      permissions,
      assignedCompanies,
      primaryCompanyId: primaryCompany?.id,
      isSuperAdmin,
      allowedTabs: user.allowedTabs,
    };
  }

  public updateLastLogin(userId: string): void {
    const user = this.findUserById(userId);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
    }
  }

  public createUser(
    data: {
      email: string;
      password?: string;
      fullName: string;
      fullNameAr?: string;
      phone?: string;
      avatarUrl?: string;
      roleSlug: string;
      companyIds: string[];
      isActive?: boolean;
      allowedTabs?: string[];
    },
    actorUser: AuthUser
  ): User {
    const normalizedEmail = data.email.toLowerCase().trim();
    if (this.findUserByEmail(normalizedEmail)) {
      throw new Error(`A user account with email "${normalizedEmail}" already exists`);
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(data.password || 'User@2026', salt);
    const now = new Date().toISOString();
    const newUserId = `u-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newUser: User = {
      id: newUserId,
      email: normalizedEmail,
      passwordHash,
      fullName: data.fullName,
      fullNameAr: data.fullNameAr || data.fullName,
      phone: data.phone || '',
      avatarUrl: data.avatarUrl || '',
      isActive: data.isActive !== undefined ? data.isActive : true,
      isArchived: false,
      allowedTabs: data.allowedTabs,
      createdAt: now,
      updatedAt: now,
    };

    this.state.users.push(newUser);

    // Assign Role
    const role = this.state.roles.find(r => r.slug === data.roleSlug) || this.state.roles.find(r => r.slug === 'admin')!;
    this.state.userRoles.push({
      id: `ur-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: newUserId,
      roleId: role.id,
      companyId: role.slug === 'super_admin' ? null : data.companyIds[0] || null,
      createdAt: now,
    });

    // Assign Companies
    let companyIds = data.roleSlug === 'super_admin' ? this.state.companies.map(c => c.id) : (data.companyIds || []);
    if (companyIds.length === 0 && this.state.companies.length > 0) {
      companyIds = [this.state.companies[0].id];
    }
    companyIds.forEach((compId, idx) => {
      this.state.userCompanies.push({
        id: `uc-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        userId: newUserId,
        companyId: compId,
        isPrimary: idx === 0,
        assignedRoleSlug: data.roleSlug as any,
        createdAt: now,
      });
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: 'USER_CREATED',
      resource: 'USERS',
      resourceId: newUserId,
      details: {
        createdEmail: newUser.email,
        fullName: newUser.fullName,
        roleSlug: data.roleSlug,
        assignedCompaniesCount: companyIds.length,
      },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser as User;
  }

  public updateUser(
    userId: string,
    data: {
      fullName?: string;
      fullNameAr?: string;
      phone?: string;
      avatarUrl?: string;
      roleSlug?: string;
      companyIds?: string[];
      isActive?: boolean;
      allowedTabs?: string[];
    },
    actorUser: AuthUser
  ): User {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const currentRoles = this.getUserRoles(userId);
    const wasSuperAdmin = currentRoles.some(r => r.slug === 'super_admin');

    // Prevent demoting last Super Admin
    if (wasSuperAdmin && data.roleSlug && data.roleSlug !== 'super_admin') {
      const superAdmins = this.state.users.filter(u =>
        this.getUserRoles(u.id).some(r => r.slug === 'super_admin') && u.isActive && !u.isArchived
      );
      if (superAdmins.length <= 1) {
        throw new Error('Cannot change role: The system must have at least one active Super Admin');
      }
    }

    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.fullNameAr !== undefined) user.fullNameAr = data.fullNameAr;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.allowedTabs !== undefined) user.allowedTabs = data.allowedTabs;
    user.updatedAt = new Date().toISOString();

    // Update Role if provided
    if (data.roleSlug) {
      const targetRole = this.state.roles.find(r => r.slug === data.roleSlug);
      if (targetRole) {
        this.state.userRoles = this.state.userRoles.filter(ur => ur.userId !== userId);
        this.state.userRoles.push({
          id: `ur-upd-${Date.now()}`,
          userId,
          roleId: targetRole.id,
          companyId: targetRole.slug === 'super_admin' ? null : (data.companyIds?.[0] || null),
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Update Company assignments if provided
    if (data.companyIds !== undefined) {
      this.state.userCompanies = this.state.userCompanies.filter(uc => uc.userId !== userId);
      const roleSlug = data.roleSlug || currentRoles[0]?.slug || 'admin';
      const companyIds = roleSlug === 'super_admin' ? this.state.companies.map(c => c.id) : data.companyIds;

      companyIds.forEach((compId, idx) => {
        this.state.userCompanies.push({
          id: `uc-upd-${Date.now()}-${idx}`,
          userId,
          companyId: compId,
          isPrimary: idx === 0,
          assignedRoleSlug: roleSlug as any,
          createdAt: new Date().toISOString(),
        });
      });
    }

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: 'USER_UPDATED',
      resource: 'USERS',
      resourceId: userId,
      details: {
        targetUserEmail: user.email,
        updatedFields: Object.keys(data),
      },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();

    const { passwordHash: _, ...safeUser } = user;
    return safeUser as User;
  }

  public setUserStatus(userId: string, isActive: boolean, actorUser: AuthUser): User {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    if (!isActive && userId === actorUser.id) {
      throw new Error('You cannot deactivate your own administrative account');
    }

    // Guard against deactivating last active super admin
    const roles = this.getUserRoles(userId);
    if (!isActive && roles.some(r => r.slug === 'super_admin')) {
      const activeSuperAdmins = this.state.users.filter(u =>
        u.id !== userId &&
        u.isActive &&
        !u.isArchived &&
        this.getUserRoles(u.id).some(r => r.slug === 'super_admin')
      );
      if (activeSuperAdmins.length === 0) {
        throw new Error('Cannot deactivate the only active Super Admin account in the system');
      }
    }

    user.isActive = isActive;
    user.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      resource: 'USERS',
      resourceId: userId,
      details: { targetEmail: user.email, newStatus: isActive ? 'ACTIVE' : 'INACTIVE' },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();

    const { passwordHash: _, ...safeUser } = user;
    return safeUser as User;
  }

  public deleteUser(userId: string, actorUser: AuthUser): boolean {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    if (userId === actorUser.id) {
      throw new Error('You cannot delete your own account');
    }

    const roles = this.getUserRoles(userId);
    if (roles.some(r => r.slug === 'super_admin')) {
      const activeSuperAdmins = this.state.users.filter(u =>
        u.id !== userId &&
        u.isActive &&
        !u.isArchived &&
        this.getUserRoles(u.id).some(r => r.slug === 'super_admin')
      );
      if (activeSuperAdmins.length === 0) {
        throw new Error('Cannot delete the last remaining Super Admin account');
      }
    }

    // Soft delete / archive
    user.isArchived = true;
    user.isActive = false;
    user.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: 'USER_DELETED',
      resource: 'USERS',
      resourceId: userId,
      details: { targetEmail: user.email, fullName: user.fullName },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();

    return true;
  }

  public permanentlyDeleteUser(userId: string, actorUser: AuthUser): boolean {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    if (userId === actorUser.id) {
      throw new Error('You cannot delete your own account');
    }

    const roles = this.getUserRoles(userId);
    if (roles.some(r => r.slug === 'super_admin')) {
      const activeSuperAdmins = this.state.users.filter(u =>
        u.id !== userId &&
        !u.isArchived &&
        this.getUserRoles(u.id).some(r => r.slug === 'super_admin')
      );
      if (activeSuperAdmins.length === 0) {
        throw new Error('Cannot delete the last remaining Super Admin account');
      }
    }

    // Permanently remove from users list
    this.state.users = this.state.users.filter(u => u.id !== userId);
    // Remove roles mapping
    this.state.userRoles = (this.state.userRoles || []).filter(ur => ur.userId !== userId);
    // Remove company memberships
    this.state.userCompanies = (this.state.userCompanies || []).filter(uc => uc.userId !== userId);
    // Remove user notifications
    this.state.notifications = (this.state.notifications || []).filter(n => n.userId !== userId);

    // Safely clear assignment on tasks if any
    (this.state.tasks || []).forEach(t => {
      if (t.assignedToId === userId) t.assignedToId = null;
      if (t.assigneeId === userId) t.assigneeId = null;
      if (t.responsiblePersonId === userId) t.responsiblePersonId = null;
      if (t.recipientId === userId) t.recipientId = null;
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: 'USER_PERMANENTLY_DELETED',
      resource: 'USERS',
      resourceId: userId,
      details: { targetEmail: user.email, fullName: user.fullName },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();
    return true;
  }

  public restoreUser(userId: string, actorUser: AuthUser): boolean {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    user.isArchived = false;
    user.isActive = true;
    user.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: 'USER_RESTORED',
      resource: 'USERS',
      resourceId: userId,
      details: { targetEmail: user.email, fullName: user.fullName },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();
    return true;
  }

  public resetUserPassword(userId: string, newPassword: string, actorUser: AuthUser): void {
    const user = this.findUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters in length');
    }

    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
    user.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      action: 'USER_PASSWORD_RESET',
      resource: 'USERS',
      resourceId: userId,
      details: { targetEmail: user.email, initiatedBy: actorUser.email },
      status: 'SUCCESS',
    });

    this.persistStateImmediately();
  }

  // --- Companies Queries & Mutations ---
  public getAllCompanies(): Company[] {
    return this.state.companies;
  }

  public getCompanyById(id: string): Company | undefined {
    return this.state.companies.find(c => c.id === id);
  }

  public createCompany(data: Partial<Company>, actorUser: AuthUser): Company {
    const id = `c-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newCompany: Company = {
      id,
      code: data.code || `CMP-${Math.floor(1000 + Math.random() * 9000)}`,
      nameEn: data.nameEn || 'New Subsidiary',
      nameAr: data.nameAr || 'شركة فرعية جديدة',
      industryEn: data.industryEn || 'Diversified',
      industryAr: data.industryAr || 'متنوع',
      logoUrl: data.logoUrl || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&h=120&q=80',
      currency: data.currency || 'IQD',
      country: data.country || 'IQ',
      isActive: data.isActive !== undefined ? data.isActive : true,
      isArchived: false,
      settings: data.settings || { timezone: 'Asia/Baghdad' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.companies.push(newCompany);

    // Automatically link Super Admin
    const superAdmins = this.state.users.filter(u => {
      const uRoles = this.getUserRoles(u.id);
      return uRoles.some(r => r.slug === 'super_admin');
    });

    superAdmins.forEach(sa => {
      this.state.userCompanies.push({
        id: `uc-auto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: sa.id,
        companyId: newCompany.id,
        isPrimary: false,
        assignedRoleSlug: 'super_admin',
        createdAt: new Date().toISOString(),
      });
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: newCompany.id,
      action: 'COMPANY_CREATED',
      resource: 'COMPANIES',
      resourceId: newCompany.id,
      details: { companyCode: newCompany.code, nameEn: newCompany.nameEn },
      status: 'SUCCESS',
    });

    return newCompany;
  }

  public updateCompany(id: string, data: Partial<Company>, actorUser: AuthUser): Company {
    const company = this.getCompanyById(id);
    if (!company) {
      throw new Error(`Company with id ${id} not found`);
    }

    Object.assign(company, data, { updatedAt: new Date().toISOString() });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: company.id,
      action: 'COMPANY_UPDATED',
      resource: 'COMPANIES',
      resourceId: company.id,
      details: { updatedFields: Object.keys(data) },
      status: 'SUCCESS',
    });

    return company;
  }

  public archiveCompany(id: string, actorUser: AuthUser): Company {
    const company = this.getCompanyById(id);
    if (!company) {
      throw new Error(`Company with id ${id} not found`);
    }

    company.isArchived = true;
    company.isActive = false;
    company.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: company.id,
      action: 'COMPANY_ARCHIVED',
      resource: 'COMPANIES',
      resourceId: company.id,
      details: { nameEn: company.nameEn, code: company.code },
      status: 'SUCCESS',
    });

    return company;
  }

  public deleteCompany(id: string, actorUser: AuthUser): boolean {
    const index = this.state.companies.findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error(`Company with id ${id} not found`);
    }

    const removed = this.state.companies.splice(index, 1)[0];

    // Clean up association records
    this.state.userCompanies = this.state.userCompanies.filter(uc => uc.companyId !== id);
    this.state.tasks = this.state.tasks.filter(t => t.companyId !== id);
    if (this.state.companyFiles) {
      this.state.companyFiles = this.state.companyFiles.filter(f => f.companyId !== id);
    }

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: id,
      action: 'COMPANY_DELETED',
      resource: 'COMPANIES',
      resourceId: id,
      details: { deletedCompanyCode: removed.code, deletedCompanyName: removed.nameEn },
      status: 'SUCCESS',
    });

    return true;
  }

  public computeCompanyMetrics(companyId: string): CompanyMetrics {
    const tasks = (this.state.tasks || []).filter(t => t.companyId === companyId && !t.isArchived);
    const now = new Date().getTime();

    let completedTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let delayedTasks = 0;
    let pausedTasks = 0;
    let vipTasks = 0;
    let overdueTasks = 0;

    tasks.forEach(t => {
      const statusSlug = t.status || (t.statusId === 'ts-5' ? 'completed' : t.statusId === 'ts-4' ? 'delayed' : t.statusId === 'ts-2' ? 'in_progress' : 'pending');
      const prioritySlug = t.priority || (t.priorityId === 'tp-4' ? 'vip' : t.priorityId === 'tp-3' ? 'high' : 'medium');
      const isPastDue = t.dueDate ? new Date(t.dueDate).getTime() < now : false;

      if (statusSlug === 'completed') {
        completedTasks++;
      } else if (statusSlug === 'cancelled') {
        // cancelled tasks
      } else {
        if (statusSlug === 'pending') pendingTasks++;
        if (statusSlug === 'in_progress') inProgressTasks++;
        if (statusSlug === 'paused') pausedTasks++;

        if (statusSlug === 'delayed' || isPastDue) {
          delayedTasks++;
          overdueTasks++;
        }
      }

      if (prioritySlug === 'vip' || t.priorityId === 'tp-4') {
        vipTasks++;
      }
    });

    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      delayedTasks,
      pausedTasks,
      vipTasks,
      overdueTasks,
      completionRate,
    };
  }

  public getCompanyWithDetails(id: string) {
    const company = this.getCompanyById(id);
    if (!company) return undefined;

    let manager: Partial<User> | null = null;
    if (company.managerId) {
      const u = this.findUserById(company.managerId);
      if (u) {
        manager = {
          id: u.id,
          fullName: u.fullName,
          fullNameAr: u.fullNameAr,
          email: u.email,
          phone: u.phone,
          avatarUrl: u.avatarUrl,
        };
      }
    }

    const metrics = this.computeCompanyMetrics(company.id);

    return {
      ...company,
      manager,
      metrics,
    };
  }

  public getCompaniesWithMetrics(filterCompanyIds?: string[]) {
    let companies = this.state.companies;
    if (filterCompanyIds) {
      companies = companies.filter(c => filterCompanyIds.includes(c.id));
    }

    return companies.map(c => {
      let manager: Partial<User> | null = null;
      if (c.managerId) {
        const u = this.findUserById(c.managerId);
        if (u) {
          manager = {
            id: u.id,
            fullName: u.fullName,
            fullNameAr: u.fullNameAr,
            email: u.email,
            phone: u.phone,
            avatarUrl: u.avatarUrl,
          };
        }
      }
      const metrics = this.computeCompanyMetrics(c.id);
      return {
        ...c,
        manager,
        metrics,
      };
    });
  }

  public getCompanyTasks(companyId: string) {
    return this.getTasks({ companyId });
  }

  // --- Comprehensive Task Management ---
  public getTasks(filters: {
    companyId?: string;
    allowedCompanyIds?: string[];
    status?: string;
    priority?: string;
    assigneeId?: string;
    responsiblePersonId?: string;
    recipientId?: string;
    search?: string;
    isArchived?: boolean;
  }) {
    let tasks = this.state.tasks || [];

    // Tenant Isolation
    if (filters.allowedCompanyIds) {
      tasks = tasks.filter(t => filters.allowedCompanyIds!.includes(t.companyId));
    }

    if (filters.companyId && filters.companyId !== 'all') {
      tasks = tasks.filter(t => t.companyId === filters.companyId);
    }

    if (filters.status && filters.status !== 'all') {
      tasks = tasks.filter(t => t.status === filters.status || t.statusId === filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      const p = String(filters.priority).toLowerCase().trim();
      tasks = tasks.filter(t => {
        const taskPriority = String(t.priority || '').toLowerCase().trim();
        const taskPriorityId = String(t.priorityId || '').toLowerCase().trim();

        if (taskPriority === p || taskPriorityId === p) return true;

        if (p === 'vip' || p === 'urgent' || p === 'critical' || p === 'tp-vip' || p === 'tp-4') {
          return taskPriority === 'vip' || taskPriority === 'urgent' || taskPriority === 'critical' ||
                 taskPriorityId === 'tp-vip' || taskPriorityId === 'tp-4';
        }
        if (p === 'high' || p === 'tp-high' || p === 'tp-3') {
          return taskPriority === 'high' || taskPriorityId === 'tp-high' || taskPriorityId === 'tp-3';
        }
        if (p === 'medium' || p === 'tp-medium' || p === 'tp-2') {
          return taskPriority === 'medium' || taskPriorityId === 'tp-medium' || taskPriorityId === 'tp-2';
        }
        if (p === 'low' || p === 'tp-low' || p === 'tp-1') {
          return taskPriority === 'low' || taskPriorityId === 'tp-low' || taskPriorityId === 'tp-1';
        }
        return false;
      });
    }

    if (filters.assigneeId && filters.assigneeId !== 'all') {
      const targetUser = this.findUserById(filters.assigneeId);
      tasks = tasks.filter(t =>
        t.assignedToId === filters.assigneeId ||
        t.assigneeId === filters.assigneeId ||
        (targetUser && (
          t.assignedToId === targetUser.fullName ||
          t.assignedToId === targetUser.fullNameAr ||
          t.assigneeId === targetUser.fullName ||
          t.assigneeId === targetUser.fullNameAr
        ))
      );
    }

    if (filters.responsiblePersonId && filters.responsiblePersonId !== 'all') {
      tasks = tasks.filter(t => t.responsiblePersonId === filters.responsiblePersonId);
    }

    if (filters.recipientId && filters.recipientId !== 'all') {
      tasks = tasks.filter(t => t.recipientId === filters.recipientId);
    }

    if (filters.isArchived !== undefined) {
      tasks = tasks.filter(t => !!t.isArchived === !!filters.isArchived);
    } else {
      tasks = tasks.filter(t => !t.isArchived);
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      tasks = tasks.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.taskCode?.toLowerCase().includes(q)
      );
    }

    // Populate relations
    const companyMap = new Map(this.state.companies.map(c => [c.id, { id: c.id, code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, logoUrl: c.logoUrl, currency: c.currency }]));
    const userMap = new Map(this.state.users.map(u => [u.id, { id: u.id, fullName: u.fullName, fullNameAr: u.fullNameAr, email: u.email, avatarUrl: u.avatarUrl }]));

    return tasks.map(t => {
      const assignedUser = (t.assignedToId ? userMap.get(t.assignedToId) : (t.assigneeId ? userMap.get(t.assigneeId) : null)) || null;
      const respUser = (t.responsiblePersonId ? userMap.get(t.responsiblePersonId) : null) || null;
      const recipUser = (t.recipientId ? userMap.get(t.recipientId) : null) || null;
      const creatorUser = userMap.get(t.creatorId) || null;

      return {
        ...t,
        company: companyMap.get(t.companyId),
        assignedTo: assignedUser,
        responsiblePerson: respUser,
        recipient: recipUser,
        creator: creatorUser,
      };
    });
  }

  public getTaskById(taskId: string, allowedCompanyIds?: string[]) {
    let task = (this.state.tasks || []).find(t => t.id === taskId || t.taskCode === taskId);
    if (!task && taskId) {
      if (taskId.startsWith('t-')) {
        const num = parseInt(taskId.replace('t-', ''), 10);
        if (!isNaN(num)) {
          task = (this.state.tasks || []).find(t => t.id === `task-${100 + num}`) || (this.state.tasks || [])[num - 1];
        }
      }
    }
    if (!task) return null;

    if (allowedCompanyIds && !allowedCompanyIds.includes(task.companyId)) {
      throw new Error('Forbidden: Access denied to task company tenant');
    }

    const companyMap = new Map(this.state.companies.map(c => [c.id, { id: c.id, code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, logoUrl: c.logoUrl, currency: c.currency }]));
    const userMap = new Map(this.state.users.map(u => [u.id, { id: u.id, fullName: u.fullName, fullNameAr: u.fullNameAr, email: u.email, avatarUrl: u.avatarUrl }]));

    return {
      ...task,
      company: companyMap.get(task.companyId),
      assignedTo: task.assignedToId ? userMap.get(task.assignedToId) : (task.assigneeId ? userMap.get(task.assigneeId) : null),
      responsiblePerson: task.responsiblePersonId ? userMap.get(task.responsiblePersonId) : null,
      recipient: task.recipientId ? userMap.get(task.recipientId) : null,
      creator: userMap.get(task.creatorId),
    };
  }

  public createTask(data: Partial<Task>, actorUser: AuthUser): Task {
    if (!data.companyId || !data.title) {
      throw new Error('Task title and companyId are required');
    }

    const existingNumericCodes = (this.state.tasks || [])
      .map(t => {
        const match = (t.taskCode || '').match(/^TSK-(\d+)$/);
        return match ? parseInt(match[1], 10) : -1;
      })
      .filter(n => n >= 0);

    const nextNum = existingNumericCodes.length > 0 ? Math.max(...existingNumericCodes) + 1 : 0;
    const taskCode = data.taskCode || `TSK-${String(nextNum).padStart(4, '0')}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];
    const timeStr = nowIso.split('T')[1].substring(0, 5);

    const initialTimeline: TaskTimelineEvent[] = [
      {
        id: `tl-${Date.now()}-1`,
        taskId: '',
        type: 'created',
        userId: actorUser.id,
        userName: actorUser.fullName,
        date: dateStr,
        time: timeStr,
        details: 'Initial task creation with baseline specifications',
        createdAt: nowIso,
      },
    ];

    if (data.assignedToId) {
      initialTimeline.push({
        id: `tl-${Date.now()}-2`,
        taskId: '',
        type: 'assigned',
        userId: actorUser.id,
        userName: actorUser.fullName,
        date: dateStr,
        time: timeStr,
        oldValue: null,
        newValue: data.assignedToId,
        details: 'Initial operational specialist assigned',
        createdAt: nowIso,
      });
    }

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskCode,
      companyId: data.companyId,
      title: data.title,
      description: data.description || '',
      priority: (data.priority as TaskPrioritySlug) || 'medium',
      status: (data.status as TaskStatusSlug) || 'pending',
      statusReason: data.statusReason || null,
      assignedToId: data.assignedToId || null,
      assigneeId: data.assignedToId || null,
      responsiblePersonId: data.responsiblePersonId || null,
      recipientId: data.recipientId || null,
      creatorId: actorUser.id,
      startDate: data.startDate || nowIso,
      dueDate: data.dueDate || null,
      completionDate: data.status === 'completed' ? nowIso : null,
      progress: typeof data.progress === 'number' ? Math.max(0, Math.min(100, data.progress)) : (data.status === 'completed' ? 100 : (data.status === 'in_progress' ? 50 : 0)),
      customFields: data.customFields || {},
      notes: [],
      attachments: [],
      timeline: initialTimeline,
      estimatedHours: data.estimatedHours || null,
      actualHours: data.actualHours || null,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      statusId: data.statusId || 'ts-pending',
      priorityId: data.priorityId || 'tp-medium',
    };

    newTask.timeline?.forEach(tl => { tl.taskId = newTask.id; });

    this.state.tasks.unshift(newTask);

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: data.companyId,
      action: 'CREATE',
      entity: 'TASKS',
      entityId: newTask.taskCode,
      oldValue: null,
      newValue: newTask.title,
      details: { taskCode: newTask.taskCode, title: newTask.title, status: newTask.status, priority: newTask.priority },
      status: 'SUCCESS',
    });

    // 1. Notification: New Task Created
    this.createNotification({
      userId: actorUser.id,
      companyId: data.companyId,
      taskId: newTask.id,
      taskCode: newTask.taskCode,
      type: 'new_task',
      titleEn: 'New Task Created',
      titleAr: 'تم إنشاء مهمة جديدة',
      messageEn: `Task ${newTask.taskCode} "${newTask.title}" was created in the system.`,
      messageAr: `تم إنشاء المهمة ${newTask.taskCode} "${newTask.title}" في النظام.`,
      isRead: false,
      actionUrl: `/tasks?taskId=${newTask.id}`,
    });

    // 2. Notification: Task Assigned
    if (newTask.assignedToId) {
      this.createNotification({
        userId: newTask.assignedToId,
        companyId: data.companyId,
        taskId: newTask.id,
        taskCode: newTask.taskCode,
        type: 'task_assigned',
        titleEn: 'Task Assigned to You',
        titleAr: 'تم تعيينك مديراً لمهمة جديدة',
        messageEn: `You have been assigned as manager for task ${newTask.taskCode}: "${newTask.title}".`,
        messageAr: `تم تعيينك مديراً للمهمة ${newTask.taskCode}: "${newTask.title}".`,
        isRead: false,
        actionUrl: `/tasks?taskId=${newTask.id}`,
      });
    }

    return newTask;
  }

  public updateTask(taskId: string, data: Partial<Task>, actorUser: AuthUser): Task {
    const task = (this.state.tasks || []).find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];
    const timeStr = nowIso.split('T')[1].substring(0, 5);

    if (!task.timeline) task.timeline = [];

    // Track assignment change
    if (data.assignedToId !== undefined && data.assignedToId !== task.assignedToId) {
      task.timeline.push({
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        taskId: task.id,
        type: 'assigned',
        userId: actorUser.id,
        userName: actorUser.fullName,
        date: dateStr,
        time: timeStr,
        oldValue: task.assignedToId || null,
        newValue: data.assignedToId || null,
        details: 'Assigned specialist modified',
        createdAt: nowIso,
      });
      task.assigneeId = data.assignedToId || null;

      // Notification: Task Assigned to newly assigned user
      if (data.assignedToId) {
        this.createNotification({
          userId: data.assignedToId,
          companyId: task.companyId,
          taskId: task.id,
          taskCode: task.taskCode,
          type: 'task_assigned',
          titleEn: 'Task Assigned to You',
          titleAr: 'تم تعيينك مديراً لمهمة',
          messageEn: `You have been assigned as manager for task ${task.taskCode}: "${task.title}".`,
          messageAr: `تم تعيينك مديراً للمهمة ${task.taskCode}: "${task.title}".`,
          isRead: false,
          actionUrl: `/tasks?taskId=${task.id}`,
        });
      }
    }

    // Track priority change
    if (data.priority !== undefined && data.priority !== task.priority) {
      task.timeline.push({
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        taskId: task.id,
        type: 'priority_changed',
        userId: actorUser.id,
        userName: actorUser.fullName,
        date: dateStr,
        time: timeStr,
        oldValue: task.priority || null,
        newValue: data.priority || null,
        details: `Priority changed from ${task.priority} to ${data.priority}`,
        createdAt: nowIso,
      });
    }

    // Track progress change
    if (data.progress !== undefined && data.progress !== task.progress) {
      const progVal = Math.max(0, Math.min(100, Number(data.progress)));
      task.timeline.push({
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        taskId: task.id,
        type: 'status_changed',
        userId: actorUser.id,
        userName: actorUser.fullName,
        date: dateStr,
        time: timeStr,
        oldValue: String(task.progress ?? 0),
        newValue: String(progVal),
        details: `Completion progress adjusted from ${task.progress ?? 0}% to ${progVal}%`,
        createdAt: nowIso,
      });
      data.progress = progVal;
    }

    // Track status change if supplied in update
    if (data.status !== undefined && data.status !== task.status) {
      task.timeline.push({
        id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        taskId: task.id,
        type: data.status === 'completed' ? 'completed' : 'status_changed',
        userId: actorUser.id,
        userName: actorUser.fullName,
        date: dateStr,
        time: timeStr,
        oldValue: task.status || null,
        newValue: data.status || null,
        reason: data.statusReason || null,
        details: data.statusReason ? `Status changed to ${data.status} (Reason: ${data.statusReason})` : `Status changed to ${data.status}`,
        createdAt: nowIso,
      });

      if (data.status === 'completed') {
        task.completionDate = nowIso;
      } else {
        task.completionDate = null;
      }
    }

    Object.assign(task, data, { updatedAt: nowIso });

    // Notification: Task Updated
    this.createNotification({
      userId: task.assignedToId || actorUser.id,
      companyId: task.companyId,
      taskId: task.id,
      taskCode: task.taskCode,
      type: 'task_updated',
      titleEn: 'Task Updated',
      titleAr: 'تم تحديث المهمة',
      messageEn: `Task ${task.taskCode} "${task.title}" was updated by ${actorUser.fullName}.`,
      messageAr: `تم تحديث بيانات المهمة ${task.taskCode} "${task.title}" بواسطة ${actorUser.fullName}.`,
      isRead: false,
      actionUrl: `/tasks?taskId=${task.id}`,
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: task.companyId,
      action: 'UPDATE',
      entity: 'TASKS',
      entityId: task.taskCode,
      oldValue: `Fields: ${Object.keys(data).join(', ')}`,
      newValue: `Updated by ${actorUser.fullName}`,
      details: { updatedFields: Object.keys(data) },
      status: 'SUCCESS',
    });

    return task;
  }

  public changeTaskStatus(taskId: string, newStatus: TaskStatusSlug, reason: string | undefined, actorUser: AuthUser, customProgress?: number): Task {
    const task = (this.state.tasks || []).find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    const oldStatus = task.status || 'pending';
    const now = new Date();
    const nowIso = now.toISOString();
    const dateStr = nowIso.split('T')[0];
    const timeStr = nowIso.split('T')[1].substring(0, 5);

    task.status = newStatus;
    task.statusReason = reason || null;
    task.updatedAt = nowIso;

    // Handle progress
    if (typeof customProgress === 'number') {
      task.progress = Math.max(0, Math.min(100, customProgress));
    } else if (newStatus === 'completed') {
      task.progress = 100;
    } else if (newStatus === 'pending' && task.progress === 100) {
      task.progress = 0;
    } else if (task.progress === undefined) {
      task.progress = newStatus === 'in_progress' ? 50 : 0;
    }

    if (newStatus === 'completed') {
      task.completionDate = nowIso;
    } else {
      task.completionDate = null;
    }

    if (!task.timeline) task.timeline = [];
    task.timeline.push({
      id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId: task.id,
      type: newStatus === 'completed' ? 'completed' : 'status_changed',
      userId: actorUser.id,
      userName: actorUser.fullName,
      date: dateStr,
      time: timeStr,
      oldValue: oldStatus,
      newValue: newStatus,
      reason: reason || null,
      details: reason ? `Status updated to ${newStatus} (${reason})` : `Status updated to ${newStatus}`,
      createdAt: nowIso,
    });

    // 1. Notification: Status Changed
    this.createNotification({
      userId: task.assignedToId || actorUser.id,
      companyId: task.companyId,
      taskId: task.id,
      taskCode: task.taskCode,
      type: 'status_changed',
      titleEn: `Status Changed: ${newStatus}`,
      titleAr: `تغيرت حالة المهمة: ${newStatus}`,
      messageEn: `Task ${task.taskCode} changed from ${oldStatus} to ${newStatus}.`,
      messageAr: `تم تغيير حالة المهمة ${task.taskCode} من ${oldStatus} إلى ${newStatus}.`,
      isRead: false,
      actionUrl: `/tasks?taskId=${task.id}`,
    });

    // 2. Notification: Task Delayed (if delayed)
    if (newStatus === 'delayed') {
      this.createNotification({
        userId: task.assignedToId || actorUser.id,
        companyId: task.companyId,
        taskId: task.id,
        taskCode: task.taskCode,
        type: 'task_delayed',
        titleEn: 'Alert: Task Delayed',
        titleAr: 'تنبيه: تأخرت المهمة',
        messageEn: `Task ${task.taskCode} is delayed${reason ? `: ${reason}` : '.'}`,
        messageAr: `تنبيه: المهمة ${task.taskCode} متعثرة/متأخرة${reason ? `: ${reason}` : '.'}`,
        isRead: false,
        actionUrl: `/tasks?taskId=${task.id}`,
      });
    }

    // 3. Notification: Task Completed (if completed)
    if (newStatus === 'completed') {
      this.createNotification({
        userId: task.assignedToId || actorUser.id,
        companyId: task.companyId,
        taskId: task.id,
        taskCode: task.taskCode,
        type: 'task_completed',
        titleEn: 'Task Successfully Completed',
        titleAr: 'تم إنجاز المهمة بنجاح',
        messageEn: `Task ${task.taskCode} has been marked as completed!`,
        messageAr: `تم إنجاز المهمة ${task.taskCode} وإغلاقها بنجاح!`,
        isRead: false,
        actionUrl: `/tasks?taskId=${task.id}`,
      });
    }

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: task.companyId,
      action: 'STATUS_CHANGE',
      entity: 'TASKS',
      entityId: task.taskCode,
      oldValue: oldStatus,
      newValue: reason ? `${newStatus} (${reason})` : newStatus,
      details: { taskCode: task.taskCode, oldStatus, newStatus, reason },
      status: 'SUCCESS',
    });

    return task;
  }

  public addTaskNote(taskId: string, content: string, isInternalOnly: boolean, actorUser: AuthUser): TaskNote {
    const task = (this.state.tasks || []).find(t => t.id === taskId);
    if (!task) throw new Error(`Task with id ${taskId} not found`);

    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    const timeStr = nowIso.split('T')[1].substring(0, 5);

    const note: TaskNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      userId: actorUser.id,
      userName: actorUser.fullName,
      content,
      isInternalOnly,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (!task.notes) task.notes = [];
    task.notes.unshift(note);
    task.updatedAt = nowIso;

    if (!task.timeline) task.timeline = [];
    task.timeline.push({
      id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId: task.id,
      type: 'note_added',
      userId: actorUser.id,
      userName: actorUser.fullName,
      date: dateStr,
      time: timeStr,
      details: isInternalOnly ? 'Added confidential/internal note' : 'Added general task note',
      createdAt: nowIso,
    });

    // Notification: New Note
    this.createNotification({
      userId: task.assignedToId || task.creatorId,
      companyId: task.companyId,
      taskId: task.id,
      taskCode: task.taskCode,
      type: 'new_note',
      titleEn: 'New Note on Task',
      titleAr: 'ملاحظة جديدة على المهمة',
      messageEn: `${actorUser.fullName} added a note to task ${task.taskCode}.`,
      messageAr: `أضاف ${actorUser.fullName} ملاحظة جديدة على المهمة ${task.taskCode}.`,
      isRead: false,
      actionUrl: `/tasks?taskId=${task.id}`,
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: task.companyId,
      action: 'UPDATE',
      entity: 'TASKS',
      entityId: task.taskCode,
      oldValue: null,
      newValue: `Note added by ${actorUser.fullName}`,
      details: { noteId: note.id, isInternalOnly },
      status: 'SUCCESS',
    });

    return note;
  }

  public addTaskAttachment(
    taskId: string,
    fileData: { fileName: string; fileSize: number; mimeType: string; fileUrl?: string; isPrivate?: boolean; fileData?: string },
    actorUser: AuthUser
  ): TaskAttachment {
    const task = (this.state.tasks || []).find(t => t.id === taskId);
    if (!task) throw new Error(`Task with id ${taskId} not found`);

    // Enforce 10MB limit
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (fileData.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of 10MB (${(fileData.fileSize / 1024 / 1024).toFixed(2)} MB uploaded)`);
    }

    // Enforce allowed extensions
    const ext = fileData.fileName.split('.').pop()?.toLowerCase() || '';
    const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'txt', 'csv', 'zip'];
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`File type .${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    const timeStr = nowIso.split('T')[1].substring(0, 5);

    const attachment: TaskAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId,
      uploaderId: actorUser.id,
      uploaderName: actorUser.fullName,
      fileName: fileData.fileName,
      fileSize: fileData.fileSize,
      mimeType: fileData.mimeType,
      fileUrl: fileData.fileUrl || '#',
      isPrivate: !!fileData.isPrivate,
      fileData: fileData.fileData,
      createdAt: nowIso,
    };

    if (!task.attachments) task.attachments = [];
    task.attachments.unshift(attachment);
    task.updatedAt = nowIso;

    if (!task.timeline) task.timeline = [];
    task.timeline.push({
      id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      taskId: task.id,
      type: 'attachment_added',
      userId: actorUser.id,
      userName: actorUser.fullName,
      date: dateStr,
      time: timeStr,
      details: `Added document: ${fileData.fileName}${attachment.isPrivate ? ' [Private / سري]' : ''}`,
      createdAt: nowIso,
    });

    // Notification: File Uploaded
    this.createNotification({
      userId: task.assignedToId || actorUser.id,
      companyId: task.companyId,
      taskId: task.id,
      taskCode: task.taskCode,
      type: 'file_uploaded',
      titleEn: 'New File Uploaded',
      titleAr: 'تم إرفاق ملف جديد',
      messageEn: `Document "${fileData.fileName}" was attached to ${task.taskCode}${attachment.isPrivate ? ' (Confidential)' : ''}.`,
      messageAr: `تم إرفاق المستند "${fileData.fileName}" بالمهمة ${task.taskCode}${attachment.isPrivate ? ' (خاص/سري)' : ''}.`,
      isRead: false,
      actionUrl: `/tasks?taskId=${task.id}`,
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: task.companyId,
      action: 'FILE_UPLOAD',
      entity: 'ATTACHMENTS',
      entityId: attachment.id,
      oldValue: null,
      newValue: `${fileData.fileName} (${(fileData.fileSize / 1024).toFixed(1)} KB)${attachment.isPrivate ? ' [Private]' : ''}`,
      details: {
        taskId: task.id,
        taskCode: task.taskCode,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        isPrivate: !!attachment.isPrivate,
      },
      status: 'SUCCESS',
    });

    return attachment;
  }

  public getTaskAttachment(taskId: string, attachmentId: string): TaskAttachment | undefined {
    const task = (this.state.tasks || []).find(t => t.id === taskId);
    if (!task || !task.attachments) return undefined;
    return task.attachments.find(a => a.id === attachmentId);
  }

  public deleteTaskAttachment(taskId: string, attachmentId: string, actorUser: AuthUser): boolean {
    const task = (this.state.tasks || []).find(t => t.id === taskId);
    if (!task || !task.attachments) return false;
    const attIdx = task.attachments.findIndex(a => a.id === attachmentId);
    if (attIdx === -1) return false;

    const attachment = task.attachments[attIdx];
    const roles = this.getUserRoles(actorUser.id);
    const isSuperAdmin = roles.some(r => r.slug === 'super_admin');
    const isUploader = attachment.uploaderId === actorUser.id;
    const isCompanyAdmin = roles.some(r => r.slug === 'admin') && this.verifyUserCompanyAccess(actorUser.id, task.companyId);

    if (!isSuperAdmin && !isUploader && !isCompanyAdmin) {
      throw new Error('Unauthorized to delete this attachment');
    }

    task.attachments.splice(attIdx, 1);
    task.updatedAt = new Date().toISOString();

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: task.companyId,
      action: 'DELETE',
      entity: 'ATTACHMENTS',
      entityId: attachmentId,
      oldValue: attachment.fileName,
      newValue: null,
      details: { taskId, fileName: attachment.fileName },
      status: 'SUCCESS',
    });

    return true;
  }

  public deleteTask(taskId: string, isPermanent: boolean, actorUser: AuthUser): boolean {
    const taskIdx = (this.state.tasks || []).findIndex(t => t.id === taskId);
    if (taskIdx === -1) throw new Error(`Task with id ${taskId} not found`);

    const task = this.state.tasks[taskIdx];

    if (isPermanent) {
      this.state.tasks.splice(taskIdx, 1);
    } else {
      task.isArchived = true;
      task.updatedAt = new Date().toISOString();
    }

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: task.companyId,
      action: isPermanent ? 'DELETE' : 'ARCHIVE',
      entity: 'TASKS',
      entityId: task.taskCode,
      oldValue: task.title,
      newValue: isPermanent ? null : 'Archived',
      details: { taskCode: task.taskCode, title: task.title, isPermanent },
      status: 'SUCCESS',
    });

    return true;
  }

  // --- Dynamic Custom Fields Management ---
  public getCustomFields(options?: { companyId?: string; roleSlug?: string }) {
    let fields = this.state.customFields || [];

    if (options?.companyId) {
      fields = fields.filter(f =>
        !f.companyIds || f.companyIds.length === 0 || f.companyIds.includes(options.companyId!)
      );
    }

    if (options?.roleSlug) {
      fields = fields.filter(f =>
        !f.roleSlugs || f.roleSlugs.length === 0 || f.roleSlugs.includes(options.roleSlug!)
      );
    }

    return fields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  public createCustomField(data: Partial<CustomField>, actorUser: AuthUser): CustomField {
    if (!data.nameAr || !data.nameEn || !data.type) {
      throw new Error('Arabic name, English name, and Field Type are required');
    }

    const fieldKey = data.fieldKey || data.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newField: CustomField = {
      id: `cf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      fieldKey,
      type: data.type,
      required: !!data.required,
      defaultValue: data.defaultValue !== undefined ? data.defaultValue : null,
      options: data.options || [],
      visibility: data.visibility || 'all',
      companyIds: data.companyIds || [],
      roleSlugs: data.roleSlugs || [],
      sortOrder: data.sortOrder !== undefined ? data.sortOrder : ((this.state.customFields || []).length + 1),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!this.state.customFields) this.state.customFields = [];
    this.state.customFields.push(newField);

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: null,
      action: 'CUSTOM_FIELD_CREATED',
      resource: 'CUSTOM_FIELDS',
      resourceId: newField.id,
      details: { nameEn: newField.nameEn, type: newField.type },
      status: 'SUCCESS',
    });

    return newField;
  }

  public updateCustomField(id: string, data: Partial<CustomField>, actorUser: AuthUser): CustomField {
    const field = (this.state.customFields || []).find(f => f.id === id);
    if (!field) throw new Error(`Custom field with id ${id} not found`);

    Object.assign(field, data, { updatedAt: new Date().toISOString() });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: null,
      action: 'CUSTOM_FIELD_UPDATED',
      resource: 'CUSTOM_FIELDS',
      resourceId: field.id,
      details: { updatedFields: Object.keys(data) },
      status: 'SUCCESS',
    });

    return field;
  }

  public deleteCustomField(id: string, actorUser: AuthUser): boolean {
    const idx = (this.state.customFields || []).findIndex(f => f.id === id);
    if (idx === -1) throw new Error(`Custom field with id ${id} not found`);

    const deleted = this.state.customFields.splice(idx, 1)[0];

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: null,
      action: 'CUSTOM_FIELD_DELETED',
      resource: 'CUSTOM_FIELDS',
      resourceId: id,
      details: { nameEn: deleted.nameEn },
      status: 'SUCCESS',
    });

    return true;
  }

  public getCompanyFiles(companyId: string): CompanyFile[] {
    return (this.state.companyFiles || []).filter(f => f.companyId === companyId);
  }

  public addCompanyFile(fileData: Omit<CompanyFile, 'id' | 'createdAt'>, actorUser: AuthUser): CompanyFile {
    if (!this.state.companyFiles) {
      this.state.companyFiles = [];
    }
    const newFile: CompanyFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      ...fileData,
      uploaderId: actorUser.id,
      uploaderName: actorUser.fullName,
    };
    this.state.companyFiles.unshift(newFile);

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: fileData.companyId,
      action: 'COMPANY_FILE_UPLOADED',
      resource: 'COMPANY_FILES',
      resourceId: newFile.id,
      details: { fileName: newFile.name, category: newFile.category, fileSize: newFile.fileSize },
      status: 'SUCCESS',
    });

    return newFile;
  }

  public deleteCompanyFile(companyId: string, fileId: string, actorUser: AuthUser): boolean {
    if (!this.state.companyFiles) return false;
    const initialLen = this.state.companyFiles.length;
    const file = this.state.companyFiles.find(f => f.id === fileId && f.companyId === companyId);
    if (!file) return false;

    this.state.companyFiles = this.state.companyFiles.filter(f => !(f.id === fileId && f.companyId === companyId));

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId,
      action: 'COMPANY_FILE_DELETED',
      resource: 'COMPANY_FILES',
      resourceId: fileId,
      details: { fileName: file.name },
      status: 'SUCCESS',
    });

    return this.state.companyFiles.length < initialLen;
  }

  public getCompanyActivity(companyId: string, limit = 50): AuditLog[] {
    return this.state.auditLogs
      .filter(l => l.companyId === companyId || l.resourceId === companyId)
      .slice(0, limit);
  }

  public getCompanyReports(companyId: string) {
    const tasks = this.getCompanyTasks(companyId);
    const metrics = this.computeCompanyMetrics(companyId);

    const statusCounts: Record<string, number> = {};
    this.state.taskStatuses.forEach(s => {
      statusCounts[s.nameEn] = tasks.filter(t => t.statusId === s.id).length;
    });

    const priorityCounts: Record<string, number> = {};
    this.state.taskPriorities.forEach(p => {
      priorityCounts[p.nameEn] = tasks.filter(t => t.priorityId === p.id).length;
    });

    const workloadMap: Record<string, { name: string; taskCount: number; completedCount: number }> = {};
    tasks.forEach((t: any) => {
      const assigneeName = t.assignedTo?.fullName || t.assignee?.fullName || 'Unassigned';
      if (!workloadMap[assigneeName]) {
        workloadMap[assigneeName] = { name: assigneeName, taskCount: 0, completedCount: 0 };
      }
      workloadMap[assigneeName].taskCount++;
      if (t.status === 'completed' || t.status?.slug === 'completed' || t.statusId === 'ts-5') {
        workloadMap[assigneeName].completedCount++;
      }
    });

    return {
      metrics,
      statusDistribution: Object.entries(statusCounts).map(([name, count]) => ({ name, count })),
      priorityDistribution: Object.entries(priorityCounts).map(([name, count]) => ({ name, count })),
      teamWorkload: Object.values(workloadMap),
      totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      totalActualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
    };
  }

  // --- Roles & Permissions Queries & Mutations ---
  public getAllRoles(): Role[] {
    return this.state.roles;
  }

  public getAllPermissions(): Permission[] {
    return this.state.permissions;
  }

  public getRolePermissions(roleId: string): PermissionKey[] {
    return this.state.rolePermissions
      .filter(rp => rp.roleId === roleId)
      .map(rp => rp.permissionKey);
  }

  public updateRolePermissions(
    roleId: string,
    permissionKeys: PermissionKey[],
    actorUser: AuthUser
  ): { roleId: string; permissions: PermissionKey[] } {
    const role = this.state.roles.find(r => r.id === roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    // Retain non-target role permissions
    this.state.rolePermissions = this.state.rolePermissions.filter(rp => rp.roleId !== roleId);

    // Add new permissions
    permissionKeys.forEach((key, idx) => {
      this.state.rolePermissions.push({
        id: `rp-dyn-${roleId}-${idx}-${Date.now()}`,
        roleId,
        permissionKey: key,
        createdAt: new Date().toISOString(),
      });
    });

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: null,
      action: 'ROLE_PERMISSIONS_UPDATED',
      resource: 'ROLES',
      resourceId: roleId,
      details: { roleSlug: role.slug, count: permissionKeys.length, permissions: permissionKeys },
      status: 'SUCCESS',
    });

    return { roleId, permissions: permissionKeys };
  }

  // --- Multi-Company Tenant Verification ---
  public verifyUserCompanyAccess(userId: string, companyId: string): boolean {
    const roles = this.getUserRoles(userId);
    const isSuperAdmin = roles.some(r => r.slug === 'super_admin');
    if (isSuperAdmin) {
      return true;
    }

    return this.state.userCompanies.some(uc => uc.userId === userId && uc.companyId === companyId);
  }

  // User-to-company assignments
  public assignUserToCompany(
    userId: string,
    companyId: string,
    assignedRoleSlug: string,
    actorUser: AuthUser
  ) {
    const existing = this.state.userCompanies.find(uc => uc.userId === userId && uc.companyId === companyId);
    if (existing) {
      existing.assignedRoleSlug = assignedRoleSlug;
    } else {
      this.state.userCompanies.push({
        id: `uc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId,
        companyId,
        isPrimary: false,
        assignedRoleSlug,
        createdAt: new Date().toISOString(),
      });
    }

    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId,
      action: 'USER_COMPANY_ASSIGNED',
      resource: 'USER_COMPANIES',
      resourceId: `${userId}:${companyId}`,
      details: { targetUserId: userId, assignedRoleSlug },
      status: 'SUCCESS',
    });
  }

  // --- Dashboard Customization & Aggregated Analytics ---
  public getDashboardConfig(userId: string): UserDashboardConfig {
    if (!this.state.dashboardConfigs) {
      this.state.dashboardConfigs = [];
    }

    const existing = this.state.dashboardConfigs.find(c => c.userId === userId);
    if (existing) {
      return existing;
    }

    // Default configuration if none saved yet
    const user = this.findUserById(userId);
    const userRoles = this.getUserRoles(userId);
    const isSuper = userRoles.some(r => r.slug === 'super_admin');
    const userCompanyIds = isSuper ? ['all'] : this.getUserCompanies(userId).map(c => c.id);

    const defaultConfig: UserDashboardConfig = {
      id: `cfg-${userId}`,
      userId,
      companyIds: userCompanyIds.length > 0 ? userCompanyIds : ['all'],
      widgets: [
        { key: 'total_companies', enabled: isSuper, order: 1 },
        { key: 'total_tasks', enabled: true, order: 2 },
        { key: 'pending_tasks', enabled: true, order: 3 },
        { key: 'in_progress_tasks', enabled: true, order: 4 },
        { key: 'delayed_tasks', enabled: true, order: 5 },
        { key: 'completed_tasks', enabled: true, order: 6 },
        { key: 'paused_tasks', enabled: isSuper, order: 7 },
        { key: 'cancelled_tasks', enabled: isSuper, order: 8 },
        { key: 'vip_tasks', enabled: true, order: 9 },
        { key: 'overdue_tasks', enabled: true, order: 10 },
        { key: 'completion_rate', enabled: true, order: 11 },
      ],
      charts: [
        { key: 'tasks_by_company', enabled: isSuper || userCompanyIds.length > 1, order: 1 },
        { key: 'tasks_by_status', enabled: true, order: 2 },
        { key: 'tasks_by_priority', enabled: true, order: 3 },
        { key: 'tasks_by_user', enabled: isSuper, order: 4 },
        { key: 'tasks_over_time', enabled: true, order: 5 },
      ],
      showRecentTasks: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    this.state.dashboardConfigs.push(defaultConfig);
    return defaultConfig;
  }

  public getAllDashboardConfigs(): UserDashboardConfig[] {
    return this.state.dashboardConfigs || [];
  }

  public saveDashboardConfig(
    data: Partial<UserDashboardConfig> & { userId: string },
    actorUser: AuthUser
  ): UserDashboardConfig {
    if (!this.state.dashboardConfigs) {
      this.state.dashboardConfigs = [];
    }

    const index = this.state.dashboardConfigs.findIndex(c => c.userId === data.userId);
    const existing = index !== -1 ? this.state.dashboardConfigs[index] : null;

    const updatedConfig: UserDashboardConfig = {
      id: existing ? existing.id : `cfg-${data.userId}`,
      userId: data.userId,
      companyIds: data.companyIds || existing?.companyIds || ['all'],
      widgets: data.widgets || existing?.widgets || [],
      charts: data.charts || existing?.charts || [],
      showRecentTasks: data.showRecentTasks !== undefined ? data.showRecentTasks : existing ? existing.showRecentTasks : true,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUser.id,
    };

    if (index !== -1) {
      this.state.dashboardConfigs[index] = updatedConfig;
    } else {
      this.state.dashboardConfigs.push(updatedConfig);
    }

    const targetUser = this.findUserById(data.userId);
    this.logAudit({
      userId: actorUser.id,
      userEmail: actorUser.email,
      companyId: null,
      action: 'DASHBOARD_CONFIG_SAVED',
      resource: 'DASHBOARD',
      resourceId: updatedConfig.id,
      details: {
        targetUserId: data.userId,
        targetUserName: targetUser?.fullName,
        enabledWidgetsCount: updatedConfig.widgets.filter(w => w.enabled).length,
        enabledChartsCount: updatedConfig.charts.filter(c => c.enabled).length,
        companyScope: updatedConfig.companyIds,
      },
      status: 'SUCCESS',
    });

    return updatedConfig;
  }

  public getDashboardMetrics(user: AuthUser, companyFilter?: string) {
    const config = this.getDashboardConfig(user.id);
    const isSuperAdmin = user.isSuperAdmin;

    // Determine allowed companies for this user based on auth and stored dashboard config
    const userCompanies = isSuperAdmin ? this.state.companies : this.getUserCompanies(user.id);
    const userCompanyIds = userCompanies.map(c => c.id);

    // Apply dashboard config scoping
    let scopedCompanyIds = userCompanyIds;
    if (config.companyIds && !config.companyIds.includes('all')) {
      scopedCompanyIds = userCompanyIds.filter(id => config.companyIds.includes(id));
    }

    // Apply explicit request company filter if provided
    let finalCompanyIds = scopedCompanyIds;
    if (companyFilter && companyFilter !== 'all') {
      if (isSuperAdmin || userCompanyIds.includes(companyFilter)) {
        finalCompanyIds = [companyFilter];
      } else {
        finalCompanyIds = scopedCompanyIds.filter(id => id === companyFilter);
      }
    }

    const companies = this.state.companies.filter(c => finalCompanyIds.includes(c.id));
    const allTasks = (this.state.tasks || []).filter(t => !t.isArchived && finalCompanyIds.includes(t.companyId));
    const now = Date.now();

    // Compute widget metrics
    let completedCount = 0;
    let pendingCount = 0;
    let inProgressCount = 0;
    let delayedCount = 0;
    let pausedCount = 0;
    let cancelledCount = 0;
    let vipCount = 0;
    let overdueCount = 0;

    allTasks.forEach(t => {
      const statusSlug = t.status || (t.statusId === 'ts-5' ? 'completed' : t.statusId === 'ts-4' ? 'delayed' : t.statusId === 'ts-2' ? 'in_progress' : 'pending');
      const prioritySlug = t.priority || (t.priorityId === 'tp-4' ? 'vip' : t.priorityId === 'tp-3' ? 'high' : 'medium');
      const isPastDue = t.dueDate ? new Date(t.dueDate).getTime() < now : false;

      if (statusSlug === 'completed') {
        completedCount++;
      } else if (statusSlug === 'cancelled') {
        cancelledCount++;
      } else {
        if (statusSlug === 'pending') pendingCount++;
        else if (statusSlug === 'in_progress') inProgressCount++;
        else if (statusSlug === 'paused') pausedCount++;
        else if (statusSlug === 'delayed') delayedCount++;

        if (isPastDue) {
          overdueCount++;
        }
      }

      if (prioritySlug === 'vip' || t.priorityId === 'tp-4') {
        vipCount++;
      }
    });

    const totalTasks = allTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const widgetsData = {
      total_companies: companies.length,
      total_tasks: totalTasks,
      pending_tasks: pendingCount,
      in_progress_tasks: inProgressCount,
      delayed_tasks: delayedCount,
      completed_tasks: completedCount,
      paused_tasks: pausedCount,
      cancelled_tasks: cancelledCount,
      vip_tasks: vipCount,
      overdue_tasks: overdueCount,
      completion_rate: completionRate,
    };

    // Chart 1: Tasks by Company
    const companyChartData = companies.map(c => {
      const cTasks = allTasks.filter(t => t.companyId === c.id);
      const completed = cTasks.filter(t => (t.status || t.statusId) === 'completed' || t.statusId === 'ts-5').length;
      const inProgress = cTasks.filter(t => (t.status || t.statusId) === 'in_progress' || t.statusId === 'ts-2').length;
      const pending = cTasks.filter(t => (t.status || t.statusId) === 'pending' || t.statusId === 'ts-1').length;
      const delayed = cTasks.filter(t => (t.status || t.statusId) === 'delayed' || t.statusId === 'ts-4').length;
      return {
        companyId: c.id,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        code: c.code,
        total: cTasks.length,
        completed,
        inProgress,
        pending,
        delayed,
      };
    });

    // Chart 2: Tasks by Status
    const statusChartData = [
      { key: 'pending', nameEn: 'Pending', nameAr: 'قيد الانتظار', count: pendingCount, color: '#f59e0b' },
      { key: 'in_progress', nameEn: 'In Progress', nameAr: 'قيد التنفيذ', count: inProgressCount, color: '#3b82f6' },
      { key: 'delayed', nameEn: 'Delayed', nameAr: 'متأخرة', count: delayedCount, color: '#ea580c' },
      { key: 'completed', nameEn: 'Completed', nameAr: 'مكتملة', count: completedCount, color: '#10b981' },
      { key: 'paused', nameEn: 'Paused', nameAr: 'متوقفة', count: pausedCount, color: '#6b7280' },
      { key: 'cancelled', nameEn: 'Cancelled', nameAr: 'ملغاة', count: cancelledCount, color: '#ef4444' },
    ];

    // Chart 3: Tasks by Priority
    let lowPriorityCount = 0;
    let medPriorityCount = 0;
    let highPriorityCount = 0;
    let vipPriorityCount = 0;

    allTasks.forEach(t => {
      const p = t.priority || (t.priorityId === 'tp-4' ? 'vip' : t.priorityId === 'tp-3' ? 'high' : t.priorityId === 'tp-1' ? 'low' : 'medium');
      if (p === 'low') lowPriorityCount++;
      else if (p === 'medium') medPriorityCount++;
      else if (p === 'high') highPriorityCount++;
      else if (p === 'vip') vipPriorityCount++;
    });

    const priorityChartData = [
      { key: 'vip', nameEn: 'VIP & Critical', nameAr: 'أولوية قصوى (VIP)', count: vipPriorityCount, color: '#dc2626' },
      { key: 'high', nameEn: 'High Priority', nameAr: 'أولوية عالية', count: highPriorityCount, color: '#ea580c' },
      { key: 'medium', nameEn: 'Medium Priority', nameAr: 'أولوية متوسطة', count: medPriorityCount, color: '#3b82f6' },
      { key: 'low', nameEn: 'Low Priority', nameAr: 'أولوية منخفضة', count: lowPriorityCount, color: '#64748b' },
    ];

    // Chart 4: Tasks by User
    const userTaskCounts = new Map<string, { total: number; completed: number; inProgress: number; pending: number }>();
    allTasks.forEach(t => {
      const uid = t.assignedToId || t.assigneeId;
      if (uid) {
        const curr = userTaskCounts.get(uid) || { total: 0, completed: 0, inProgress: 0, pending: 0 };
        curr.total++;
        const s = t.status || t.statusId;
        if (s === 'completed' || s === 'ts-5') curr.completed++;
        else if (s === 'in_progress' || s === 'ts-2') curr.inProgress++;
        else curr.pending++;
        userTaskCounts.set(uid, curr);
      }
    });

    const userChartData = this.state.users
      .filter(u => userTaskCounts.has(u.id))
      .map(u => {
        const stats = userTaskCounts.get(u.id)!;
        return {
          userId: u.id,
          nameEn: u.fullName,
          nameAr: u.fullNameAr || u.fullName,
          avatarUrl: u.avatarUrl,
          total: stats.total,
          completed: stats.completed,
          inProgress: stats.inProgress,
          pending: stats.pending,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Chart 5: Tasks Over Time (Aggregated by months/weeks based on createdAt)
    const timeMap = new Map<string, { labelEn: string; labelAr: string; created: number; completed: number }>();
    const months = [
      { en: 'Oct', ar: 'أكتوبر' },
      { en: 'Nov', ar: 'نوفمبر' },
      { en: 'Dec', ar: 'ديسمبر' },
      { en: 'Jan', ar: 'يناير' },
      { en: 'Feb', ar: 'فبراير' },
      { en: 'Mar', ar: 'مارس' },
    ];

    // Initialize recent 6 months
    months.forEach(m => {
      timeMap.set(m.en, { labelEn: m.en, labelAr: m.ar, created: 0, completed: 0 });
    });

    allTasks.forEach(t => {
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        const mEn = d.toLocaleString('en-US', { month: 'short' });
        if (timeMap.has(mEn)) {
          timeMap.get(mEn)!.created++;
        }
      }
      if (t.completionDate || ((t.status === 'completed' || t.statusId === 'ts-5') && t.updatedAt)) {
        const d = new Date(t.completionDate || t.updatedAt);
        const mEn = d.toLocaleString('en-US', { month: 'short' });
        if (timeMap.has(mEn)) {
          timeMap.get(mEn)!.completed++;
        }
      }
    });

    const timeChartData = Array.from(timeMap.values());

    // Recent tasks
    const recentTasks = this.getTasks({
      allowedCompanyIds: finalCompanyIds,
      isArchived: false,
    }).slice(0, 6);

    return {
      config,
      widgets: widgetsData,
      charts: {
        tasks_by_company: companyChartData,
        tasks_by_status: statusChartData,
        tasks_by_priority: priorityChartData,
        tasks_by_user: userChartData,
        tasks_over_time: timeChartData,
      },
      recentTasks,
      allowedCompanies: companies.map(c => ({ id: c.id, code: c.code, nameEn: c.nameEn, nameAr: c.nameAr })),
    };
  }

  // --- System About & Copyright Settings ---
  public getSystemAbout() {
    return this.state.systemAbout;
  }

  public updateSystemAbout(
    updateData: Partial<typeof this.state.systemAbout>,
    actor?: { id: string; fullName: string; email: string },
    ipAddress?: string
  ) {
    const oldSettings = { ...this.state.systemAbout };
    this.state.systemAbout = {
      ...this.state.systemAbout,
      ...updateData,
      updatedAt: new Date().toISOString(),
      updatedBy: actor ? actor.id : this.state.systemAbout.updatedBy,
    };

    // Audit log
    this.logAudit({
      userId: actor?.id,
      userName: actor?.fullName,
      userEmail: actor?.email,
      action: 'UPDATE' as any,
      entity: 'SYSTEM_SETTINGS',
      entityId: 'about-config',
      oldValue: JSON.stringify(oldSettings),
      newValue: JSON.stringify(this.state.systemAbout),
      ipAddress: ipAddress || '127.0.0.1',
      status: 'SUCCESS',
      details: {
        module: 'System Settings',
        updatedFields: Object.keys(updateData),
      },
    });

    return this.state.systemAbout;
  }

  // --- Dynamic System Permissions Management (Super Admin) ---
  public createCustomPermission(
    data: {
      key: string;
      module: 'companies' | 'tasks' | 'reports' | 'users' | 'system';
      nameEn: string;
      nameAr: string;
      descriptionEn: string;
      descriptionAr: string;
    },
    actor?: { id: string; fullName: string; email: string },
    ipAddress?: string
  ): Permission {
    const cleanKey = data.key.trim().toLowerCase();
    const existing = this.state.permissions.find(p => p.key.toLowerCase() === cleanKey);
    if (existing) {
      throw new Error(`Permission key '${cleanKey}' already exists.`);
    }

    const newPerm: Permission = {
      id: `perm-custom-${Date.now()}`,
      key: cleanKey as any,
      module: data.module,
      nameEn: data.nameEn.trim(),
      nameAr: data.nameAr.trim(),
      descriptionEn: data.descriptionEn.trim(),
      descriptionAr: data.descriptionAr.trim(),
      createdAt: new Date().toISOString(),
    };

    this.state.permissions.push(newPerm);

    // Automatically grant to Super Admin role
    this.state.rolePermissions.push({
      id: `rp-sa-${Date.now()}`,
      roleId: 'role-super-admin',
      permissionKey: newPerm.key,
      createdAt: new Date().toISOString(),
    });

    this.logAudit({
      userId: actor?.id,
      userName: actor?.fullName,
      userEmail: actor?.email,
      action: 'CREATE' as any,
      entity: 'PERMISSION',
      entityId: newPerm.id,
      newValue: JSON.stringify(newPerm),
      ipAddress: ipAddress || '127.0.0.1',
      status: 'SUCCESS',
      details: { permissionKey: newPerm.key, nameAr: newPerm.nameAr },
    });

    return newPerm;
  }

  public deleteCustomPermission(
    key: string,
    actor?: { id: string; fullName: string; email: string },
    ipAddress?: string
  ): boolean {
    const idx = this.state.permissions.findIndex(p => p.key === key);
    if (idx === -1) return false;

    const removed = this.state.permissions[idx];
    this.state.permissions.splice(idx, 1);
    this.state.rolePermissions = this.state.rolePermissions.filter(rp => (rp.permissionKey as string) !== key);

    this.logAudit({
      userId: actor?.id,
      userName: actor?.fullName,
      userEmail: actor?.email,
      action: 'DELETE' as any,
      entity: 'PERMISSION',
      entityId: removed.id,
      oldValue: JSON.stringify(removed),
      ipAddress: ipAddress || '127.0.0.1',
      status: 'SUCCESS',
      details: { permissionKey: key },
    });

    return true;
  }

  // --- Reset System To Zero (Super Admin Only) ---
  public resetToZero(
    actor?: { id: string; fullName: string; email: string },
    ipAddress?: string
  ) {
    // Preserve or recreate Super Admin account
    let superAdmin = this.state.users.find(u => u.id === 'u1-super-admin');
    const salt = bcrypt.genSaltSync(10);
    const superAdminPasswordHash = bcrypt.hashSync('7941631', salt);

    if (!superAdmin) {
      superAdmin = {
        id: 'u1-super-admin',
        email: 'admin@holding.com',
        passwordHash: superAdminPasswordHash,
        fullName: 'admin',
        fullNameAr: 'مدير النظام (admin)',
        phone: '+966 50 111 2233',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80',
        isActive: true,
        isArchived: false,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      superAdmin.email = 'admin@holding.com';
      superAdmin.passwordHash = superAdminPasswordHash;
      superAdmin.fullName = 'admin';
      superAdmin.fullNameAr = 'مدير النظام (admin)';
      superAdmin.isActive = true;
      superAdmin.isArchived = false;
    }

    this.state.users = [superAdmin];
    this.state.companies = [];
    this.state.tasks = [];
    this.state.companyFiles = [];
    this.state.customFields = [];
    this.state.customFieldValues = [];
    this.state.userCompanies = [];
    this.state.notifications = [];
    
    // Ensure Super Admin has super_admin role
    this.state.userRoles = [
      {
        id: `ur-sa-${Date.now()}`,
        userId: 'u1-super-admin',
        roleId: 'role-super-admin',
        companyId: null,
        createdAt: new Date().toISOString(),
      },
    ];

    this.logAudit({
      userId: actor?.id,
      userName: actor?.fullName,
      userEmail: actor?.email,
      action: 'SYSTEM_SETTINGS_UPDATE' as any,
      entity: 'SYSTEM_MAINTENANCE',
      entityId: 'reset-zero',
      ipAddress: ipAddress || '127.0.0.1',
      status: 'SUCCESS',
      details: {
        message: 'System database reset to zero by Super Admin. Ready for fresh company setup.',
      },
    });

    return {
      success: true,
      message: 'System reset to zero completed successfully. You can now add companies from scratch.',
    };
  }

  // --- Backup & Restore Engine ---
  public getBackupConfig(): BackupConfig {
    return { ...this.backupConfig };
  }

  public updateBackupConfig(config: Partial<BackupConfig>): BackupConfig {
    this.backupConfig = { ...this.backupConfig, ...config };
    this.saveBackupConfig();
    return { ...this.backupConfig };
  }

  public getBackupsList(): BackupMetadata[] {
    return [...this.backupsList];
  }

  public generateBackupData(
    pathMode: 'auto' | 'manual' = 'auto',
    customPath?: string,
    actor?: { id: string; fullName: string; email: string },
    type: 'manual' | 'auto' = 'manual'
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `enterprise_backup_${type}_${timestamp}.json`;
    const resolvedDiskPath = path.join(this.backupsDir, filename);
    const resolvedPath = pathMode === 'manual' && customPath 
      ? `${customPath.replace(/\/$/, '')}/${filename}` 
      : resolvedDiskPath;

    const backupPayload = {
      systemVersion: '2.5.0',
      exportedAt: new Date().toISOString(),
      metadata: {
        companiesCount: this.state.companies.length,
        usersCount: this.state.users.length,
        tasksCount: this.state.tasks.length,
        pathMode,
        targetPath: resolvedPath,
      },
      data: {
        companies: this.state.companies,
        users: this.state.users,
        roles: this.state.roles,
        permissions: this.state.permissions,
        userRoles: this.state.userRoles,
        rolePermissions: this.state.rolePermissions,
        userCompanies: this.state.userCompanies,
        taskStatuses: this.state.taskStatuses,
        taskPriorities: this.state.taskPriorities,
        tasks: this.state.tasks,
        customFields: this.state.customFields,
        customFieldValues: this.state.customFieldValues,
        systemAbout: this.state.systemAbout,
      },
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);

    // Physically write backup to disk
    try {
      if (!fs.existsSync(this.backupsDir)) {
        fs.mkdirSync(this.backupsDir, { recursive: true });
      }
      fs.writeFileSync(resolvedDiskPath, jsonString, 'utf-8');
      console.log(`[DatabaseStorage] Verified physical backup written to disk: ${resolvedDiskPath}`);
    } catch (e) {
      console.error('[DatabaseStorage] Could not write physical backup file:', e);
    }

    const meta: BackupMetadata = {
      id: `bk-${Date.now()}`,
      filename,
      filePath: resolvedPath,
      pathMode,
      createdAt: new Date().toISOString(),
      sizeBytes: Buffer.byteLength(jsonString, 'utf8'),
      companiesCount: this.state.companies.length,
      usersCount: this.state.users.length,
      tasksCount: this.state.tasks.length,
      triggeredBy: actor?.fullName || (type === 'auto' ? 'Automatic System Scheduler' : 'Super Admin'),
      type,
    };

    this.backupsList.unshift(meta);

    // Enforce retention count on disk and in-memory
    const retentionLimit = this.backupConfig.retentionCount || 20;
    while (this.backupsList.length > retentionLimit) {
      const removed = this.backupsList.pop();
      if (removed) {
        try {
          const toDel = path.join(this.backupsDir, removed.filename);
          if (fs.existsSync(toDel)) {
            fs.unlinkSync(toDel);
          }
        } catch (e) {
          // ignore error removing expired backup
        }
      }
    }

    this.backupConfig.lastBackupAt = meta.createdAt;
    this.backupConfig.lastBackupStatus = 'SUCCESS';
    this.saveBackupConfig();

    this.logAudit({
      userId: actor?.id,
      userName: actor?.fullName,
      userEmail: actor?.email,
      action: 'SYSTEM_BACKUP_CREATED' as any,
      entity: 'BACKUP',
      entityId: meta.id,
      status: 'SUCCESS',
      details: { filename, filePath: resolvedPath, pathMode, type, sizeBytes: meta.sizeBytes },
    });

    return { metadata: meta, jsonString, payload: backupPayload };
  }

  public restoreBackupData(
    backupJson: any,
    actor?: { id: string; fullName: string; email: string },
    ipAddress?: string
  ) {
    if (!backupJson || !backupJson.data) {
      throw new Error('الملف غير صالح: لا يحتوي على بيانات النسخة الاحتياطية المطلوبة');
    }

    const { data } = backupJson;
    if (Array.isArray(data.companies)) this.state.companies = data.companies;
    if (Array.isArray(data.users)) this.state.users = data.users;
    if (Array.isArray(data.roles)) this.state.roles = data.roles;
    if (Array.isArray(data.permissions)) this.state.permissions = data.permissions;
    if (Array.isArray(data.userRoles)) this.state.userRoles = data.userRoles;
    if (Array.isArray(data.rolePermissions)) this.state.rolePermissions = data.rolePermissions;
    if (Array.isArray(data.userCompanies)) this.state.userCompanies = data.userCompanies;
    if (Array.isArray(data.tasks)) this.state.tasks = data.tasks;
    if (Array.isArray(data.customFields)) this.state.customFields = data.customFields;
    if (Array.isArray(data.customFieldValues)) this.state.customFieldValues = data.customFieldValues;
    if (data.systemAbout) this.state.systemAbout = data.systemAbout;

    // Ensure super admin user has password 7941631
    const sa = this.state.users.find(u => u.id === 'u1-super-admin');
    if (sa) {
      sa.passwordHash = bcrypt.hashSync('7941631', bcrypt.genSaltSync(10));
    }

    this.logAudit({
      userId: actor?.id,
      userName: actor?.fullName,
      userEmail: actor?.email,
      action: 'SYSTEM_SETTINGS_UPDATE' as any,
      entity: 'BACKUP',
      entityId: 'restore',
      ipAddress: ipAddress || '127.0.0.1',
      status: 'SUCCESS',
      details: {
        restoredCompanies: this.state.companies.length,
        restoredUsers: this.state.users.length,
        restoredTasks: this.state.tasks.length,
      },
    });

    return {
      success: true,
      message: 'تم استعادة النسخة الاحتياطية بنجاح وتحديث كافة البيانات في النظام.',
      stats: {
        companiesCount: this.state.companies.length,
        usersCount: this.state.users.length,
        tasksCount: this.state.tasks.length,
      },
    };
  }
}

export const dbStorage = new DatabaseStorage();
