import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  imports: [CommonModule],
  templateUrl: './about.html',
  styleUrl: './about.scss'
})
export class About {
  readonly year = new Date().getFullYear();

  readonly modules = [
    {
      icon: '👥',
      color: '#1878cc',
      bg: '#e8f2fd',
      title: 'Recruitment & ATS',
      desc: 'End-to-end applicant tracking system with AI-powered resume screening, multi-stage pipeline management, job posting, requisitions, and offer letters. Streamlines hiring from requisition to onboarding.'
    },
    {
      icon: '📊',
      color: '#7c3aed',
      bg: '#f3eeff',
      title: 'Performance Appraisal',
      desc: '360° feedback cycles with quarterly and annual review support. Managers set goals, track progress, and submit structured appraisals. Employees view their scores and development plans in real time.'
    },
    {
      icon: '🗂️',
      color: '#0d9488',
      bg: '#e6faf8',
      title: 'Project & Task Management',
      desc: 'Full project lifecycle management with Kanban boards, Gantt charts, task assignments, subtask tracking, and time logging. Syncs with BS4 ERP for accurate project cost and resource data.'
    },
    {
      icon: '⏱️',
      color: '#d97706',
      bg: '#fef3e2',
      title: 'Time Tracking & Timesheets',
      desc: 'Employees log hours against projects and tasks directly in the platform. Time entries sync with Directus ERP for payroll and billing accuracy. Managers review and approve timesheets.'
    },
    {
      icon: '🌐',
      color: '#059669',
      bg: '#e6f9f2',
      title: 'Candidate Career Portal',
      desc: 'External-facing careers portal where candidates create accounts, browse open positions, apply with cover letters, and track their application status — all without needing an internal account.'
    },
    {
      icon: '🔔',
      color: '#dc2626',
      bg: '#fef2f2',
      title: 'Notifications & Alerts',
      desc: 'Real-time cross-role notification system. HR receives alerts on new applications and requisitions. Managers are notified of task assignments and appraisal deadlines. All notifications persist in the database.'
    },
    {
      icon: '🏢',
      color: '#0891b2',
      bg: '#e0f7fa',
      title: 'Organogram & Hierarchy',
      desc: 'Visual org chart built from live Directus employee data. Displays the full reporting hierarchy with manager-employee relationships, department groupings, and role designations.'
    },
    {
      icon: '🔒',
      color: '#4f46e5',
      bg: '#eef2ff',
      title: 'Authentication & Security',
      desc: 'Dual authentication: Google Workspace SSO for ExpertFlow employees and local email/password accounts for external candidates. Role-based access control (AppAdmin, HR, Manager, Employee, Candidate) with JWT tokens.'
    },
    {
      icon: '⚙️',
      color: '#64748b',
      bg: '#f1f5f9',
      title: 'User & Settings Management',
      desc: 'AppAdmin can manage all user accounts, assign roles, activate or deactivate users. Each user has a personal settings page showing their profile, time logs, and password management options.'
    },
  ];
}
