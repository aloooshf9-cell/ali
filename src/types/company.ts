import { Company, CompanyMetrics } from './database';

export interface CompanyWithMetrics extends Company {
  metrics?: CompanyMetrics;
}
