import { Injectable } from '@angular/core';
import { TimeEntry } from '../models';

@Injectable({ providedIn: 'root' })
export class TimeEntryService {
  /**
   * Calculate hours worked from start and end datetime strings.
   * Returns null if either value is missing or end < start.
   */
  calculateHours(startDatetime: string, endDatetime: string): number | null {
    if (!startDatetime || !endDatetime) return null;
    const start = new Date(startDatetime).getTime();
    const end = new Date(endDatetime).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const diffMs = end - start;
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100; // round to 2 decimal places
  }

  /**
   * Format hours as "Xh Ym" display string.
   */
  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  /**
   * Build the OTRS project ref link for a time entry.
   */
  buildOtrsRef(appUrl: string, timeEntryId: string): string {
    return `${appUrl}/timesheet?entry=${timeEntryId}`;
  }

  /**
   * Map a local TimeEntry to the Directus payload shape.
   */
  toDirectusPayload(entry: TimeEntry, appUrl: string): Record<string, unknown> {
    return {
      employee: entry.employee_id,
      project: entry.project_id,
      description: entry.description,
      start_datetime: entry.start_datetime,
      end_datetime: entry.end_datetime,
      hours_worked: entry.hours_worked,
      otrs_project_ref: entry.id ? this.buildOtrsRef(appUrl, entry.id) : null
    };
  }

  /**
   * Map a Directus time entry to the local TimeEntry shape.
   */
  fromDirectusPayload(d: any): Partial<TimeEntry> {
    return {
      directus_id: d.id,
      employee_id: typeof d.employee === 'object' ? d.employee?.id : d.employee,
      project_id: typeof d.project === 'object' ? d.project?.id : d.project,
      description: d.description ?? '',
      start_datetime: d.start_datetime,
      end_datetime: d.end_datetime,
      hours_worked: d.hours_worked
    };
  }
}
