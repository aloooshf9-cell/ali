class ApiClient {
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const activeCompanyId = localStorage.getItem('active_company_id');
    if (activeCompanyId) {
      headers['X-Company-Id'] = activeCompanyId;
    }
    return headers;
  }

  async request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      let message = `HTTP Error ${res.status}: ${res.statusText}`;
      let data: any = {};
      try {
        data = await res.json();
        if (data.error) message = data.error;
      } catch {}
      const err: any = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return res.json();
  }

  // Auth methods
  async login(email: string, password: string) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async forgotPassword(email: string) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPasswordWithToken(data: any) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSecurityStatus() {
    return this.request('/api/auth/security-status');
  }

  async switchPersona(persona: string) {
    return this.request('/api/auth/switch-persona', {
      method: 'POST',
      body: JSON.stringify({ persona }),
    });
  }

  // Companies
  async getCompanies() {
    return this.request('/api/companies');
  }

  async getCompany(id: string) {
    return this.request(`/api/companies/${id}`);
  }

  async createCompany(data: any) {
    return this.request('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id: string, data: any) {
    return this.request(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async archiveCompany(id: string, permanent: boolean = false) {
    return this.request(`/api/companies/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
    });
  }

  async getCompanyDashboard(id: string) {
    return this.request(`/api/companies/${id}/dashboard`);
  }

  async getCompanyTasks(id: string) {
    return this.request(`/api/companies/${id}/tasks`);
  }

  async createCompanyTask(companyId: string, data: any) {
    return this.request(`/api/companies/${companyId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompanyTask(companyId: string, taskId: string, data: any) {
    return this.request(`/api/companies/${companyId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getCompanyReports(id: string) {
    return this.request(`/api/companies/${id}/reports`);
  }

  async getCompanyFiles(id: string) {
    return this.request(`/api/companies/${id}/files`);
  }

  async addCompanyFile(companyId: string, data: any) {
    return this.request(`/api/companies/${companyId}/files`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteCompanyFile(companyId: string, fileId: string) {
    return this.request(`/api/companies/${companyId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getCompanyActivity(companyId: string, limit: number = 50) {
    return this.request(`/api/companies/${companyId}/activity?limit=${limit}`);
  }

  // Tasks
  async getTasks(params: Record<string, any> = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== 'all') q.set(k, String(v));
    });
    return this.request(`/api/tasks?${q.toString()}`);
  }

  async getTask(id: string) {
    return this.request(`/api/tasks/${id}`);
  }

  async createTask(data: any) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changeTaskStatus(id: string, status: string, reason?: string, progress?: number) {
    return this.request(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason, progress }),
    });
  }

  async deleteTask(id: string, permanent: boolean = false) {
    return this.request(`/api/tasks/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
    });
  }

  async addTaskNote(taskId: string, content: string, isInternalOnly: boolean = false) {
    return this.request(`/api/tasks/${taskId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, isInternalOnly }),
    });
  }

  async addTaskAttachment(taskId: string, fileData: any) {
    return this.request(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(fileData),
    });
  }

  async downloadTaskAttachment(taskId: string, attachmentId: string) {
    return this.request(`/api/tasks/${taskId}/attachments/${attachmentId}/download`);
  }

  async deleteTaskAttachment(taskId: string, attachmentId: string) {
    return this.request(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  // Roles & Permissions
  async getRoles() {
    return this.request('/api/roles');
  }

  async getPermissions() {
    return this.request('/api/roles/permissions');
  }

  async getRolePermissions(roleId: string) {
    return this.request(`/api/roles/${roleId}/permissions`);
  }

  async updateRolePermissions(roleId: string, permissions: string[]) {
    return this.request(`/api/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  async createPermission(data: any) {
    return this.request('/api/roles/permissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePermission(key: string) {
    return this.request(`/api/roles/permissions/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  // Users
  async getUsers() {
    return this.request('/api/users');
  }

  async createUser(data: any) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async setUserStatus(id: string, isActive: boolean) {
    return this.request(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  async resetUserPassword(id: string, newPassword?: string) {
    return this.request(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async deleteUser(id: string, permanent: boolean = false) {
    return this.request(`/api/users/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
    });
  }

  async restoreUser(id: string) {
    return this.request(`/api/users/${id}/restore`, {
      method: 'POST',
    });
  }

  async assignUserToCompany(userId: string, companyId: string, roleSlug: string) {
    return this.request(`/api/users/${userId}/assign-company`, {
      method: 'POST',
      body: JSON.stringify({ companyId, roleSlug }),
    });
  }

  // Custom Fields
  async getCustomFields(companyId?: string) {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return this.request(`/api/custom-fields${q}`);
  }

  async createCustomField(data: any) {
    return this.request('/api/custom-fields', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomField(id: string, data: any) {
    return this.request(`/api/custom-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomField(id: string) {
    return this.request(`/api/custom-fields/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit Logs
  async getAuditLogs(companyId?: string, limit: number = 100) {
    const q = new URLSearchParams();
    if (companyId) q.set('companyId', companyId);
    q.set('limit', limit.toString());
    return this.request(`/api/audit-logs?${q.toString()}`);
  }

  async queryAuditLogs(params: Record<string, any>) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    if (params.userFilter && params.userFilter !== 'all') q.set('userFilter', params.userFilter);
    if (params.actionFilter && params.actionFilter !== 'all') q.set('actionFilter', params.actionFilter);
    if (params.entityFilter && params.entityFilter !== 'all') q.set('entityFilter', params.entityFilter);
    if (params.companyId && params.companyId !== 'all') q.set('companyId', params.companyId);
    if (params.limit) q.set('limit', params.limit.toString());
    if (params.offset) q.set('offset', params.offset.toString());
    return this.request(`/api/audit-logs?${q.toString()}`);
  }

  // Notifications
  async getNotifications(params?: { unreadOnly?: boolean; type?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.unreadOnly) q.set('unreadOnly', 'true');
    if (params?.type && params.type !== 'all') q.set('type', params.type);
    if (params?.limit) q.set('limit', params.limit.toString());
    return this.request(`/api/notifications?${q.toString()}`);
  }

  async getUnreadNotificationsCount() {
    return this.request('/api/notifications/unread-count');
  }

  async markNotificationAsRead(id: string, isRead: boolean = true) {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/api/notifications/read-all', { method: 'POST' });
  }

  async deleteNotification(id: string) {
    return this.request(`/api/notifications/${id}`, { method: 'DELETE' });
  }

  // Dashboard & Metrics
  async getDashboardMetrics(companyFilter?: string) {
    const q = companyFilter && companyFilter !== 'all' ? `?companyFilter=${encodeURIComponent(companyFilter)}` : '';
    return this.request(`/api/dashboard/metrics${q}`);
  }

  async getDashboardConfig() {
    return this.request('/api/dashboard/config');
  }

  async getAllDashboardConfigs() {
    return this.request('/api/dashboard/configs');
  }

  async saveDashboardConfig(userId: string, config: any) {
    return this.request(`/api/dashboard/config/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async resetDashboardConfig(userId: string) {
    return this.request(`/api/dashboard/config/reset/${userId}`, {
      method: 'POST',
    });
  }

  // Reports
  async queryReports(reportType: string, filters: Record<string, any> = {}) {
    const q = new URLSearchParams();
    q.set('reportType', reportType);
    if (filters.companyId && filters.companyId !== 'all') q.set('companyId', filters.companyId);
    if (filters.status && filters.status !== 'all') q.set('status', filters.status);
    if (filters.priority && filters.priority !== 'all') q.set('priority', filters.priority);
    if (filters.assignedToId && filters.assignedToId !== 'all') q.set('assignedToId', filters.assignedToId);
    if (filters.creatorId && filters.creatorId !== 'all') q.set('creatorId', filters.creatorId);
    if (filters.managerIds) {
      if (Array.isArray(filters.managerIds)) {
        if (filters.managerIds.length > 0) q.set('managerIds', filters.managerIds.join(','));
      } else if (filters.managerIds !== 'all') {
        q.set('managerIds', String(filters.managerIds));
      }
    }
    if (filters.customFieldFilters && Object.keys(filters.customFieldFilters).length > 0) {
      q.set('customFieldFilters', JSON.stringify(filters.customFieldFilters));
    }
    if (filters.dateFrom) q.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) q.set('dateTo', filters.dateTo);
    if (filters.dueDateFrom) q.set('dueDateFrom', filters.dueDateFrom);
    if (filters.dueDateTo) q.set('dueDateTo', filters.dueDateTo);
    if (filters.search) q.set('search', filters.search);
    return this.request(`/api/reports/query?${q.toString()}`);
  }

  async exportReportExcel(data: any) {
    const res = await fetch('/api/reports/export/excel', {
      method: 'POST',
      credentials: 'include',
      headers: { ...this.getHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Export failed with HTTP ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${data.reportType || 'export'}_${new Date().toISOString().substring(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async exportReportPdfData(data: any) {
    return this.request('/api/reports/export/pdf-data', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // System & Backup
  async getSystemAbout() {
    return this.request('/api/system/about');
  }

  async updateSystemAbout(data: any) {
    return this.request('/api/system/about', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getSchemaMetadata() {
    return this.request('/api/system/schema');
  }

  async runSecuritySuite() {
    return this.request('/api/security-test/run', { method: 'POST' });
  }

  async resetSystemToZero() {
    return this.request('/api/system/reset-zero', { method: 'POST' });
  }

  async downloadBackupFile(pathMode: string = 'auto', customPath?: string) {
    const token = localStorage.getItem('auth_token');
    const q = new URLSearchParams({ pathMode });
    if (customPath) q.set('customPath', customPath);
    const res = await fetch(`/api/system/backup?${q.toString()}`, {
      method: 'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to download backup file');
    }
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition');
    let filename = `enterprise_backup_${new Date().toISOString().substring(0, 10)}.json`;
    if (disp && disp.includes('filename=')) {
      const match = disp.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async createBackup(pathMode: string = 'auto', customPath?: string, type: string = 'manual') {
    return this.request('/api/system/backup', {
      method: 'POST',
      body: JSON.stringify({ pathMode, customPath, type }),
    });
  }

  async restoreBackup(backupData: any) {
    return this.request('/api/system/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData }),
    });
  }

  async getBackupConfig() {
    return this.request('/api/system/backup-config');
  }

  async updateBackupConfig(config: any) {
    return this.request('/api/system/backup-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }
}

export const api = new ApiClient();
