import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { JobStoreService, JobApplication, ApplicationStatus } from '../../../services/job-store';
import { CandidateNotificationService } from '../../../services/candidate-notification';
import { ApiService } from '../../../services/api';
import { AuthService } from '../../../services/auth';
import { Employee } from '../../../models';
import { AppUserRecord } from '../../../services/user-store';

interface AiRequirementResult {
  name: string;
  score: number;
  reason: string;
}

interface AiScreenResult {
  requirements: AiRequirementResult[];
  overallScore: number;
  summary: string;
}

interface PipelineColumn {
  id:         ApplicationStatus | 'Applied';
  label:      string;
  color:      string;
  candidates: JobApplication[];
}

@Component({
  selector: 'app-pipeline',
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss'
})
export class Pipeline implements OnInit {
  private jobStore   = inject(JobStoreService);
  private candNotif  = inject(CandidateNotificationService);
  private api        = inject(ApiService);
  private auth       = inject(AuthService);

  readonly allApplications = this.jobStore.applications;
  readonly allJobs         = this.jobStore.jobs;

  employees: Employee[]       = [];
  appUsers:  AppUserRecord[]  = [];

  // ── Interview: selected interviewer employee ──────────────────────────────
  interviewerEmployeeId = '';

  selectedJobTitle = 'All Jobs';

  get jobTitles(): string[] {
    return ['All Jobs', ...new Set(this.allApplications().map(a => a.jobTitle))];
  }

  get filteredApps(): JobApplication[] {
    const apps = this.allApplications();
    if (this.selectedJobTitle === 'All Jobs') return apps;
    return apps.filter(a => a.jobTitle === this.selectedJobTitle);
  }

  get columns(): PipelineColumn[] {
    const apps = this.filteredApps;
    return [
      { id: 'Submitted',    label: 'Applied',      color: '#0066CC', candidates: apps.filter(a => a.status === 'Submitted') },
      { id: 'Under Review', label: 'Under Review',  color: '#5B21B6', candidates: apps.filter(a => a.status === 'Under Review') },
      { id: 'Shortlisted',  label: 'Shortlisted',   color: '#00A3A3', candidates: apps.filter(a => a.status === 'Shortlisted') },
      { id: 'Rejected',     label: 'Rejected',      color: '#DC2626', candidates: apps.filter(a => a.status === 'Rejected') },
      { id: 'Hired',        label: 'Hired',         color: '#059669', candidates: apps.filter(a => a.status === 'Hired') },
    ] as PipelineColumn[];
  }

  selectedApp: JobApplication | null = null;
  selectedColColor = '#0066CC';

  toast = '';

  ngOnInit(): void {
    this.jobStore.reloadAllApplications();
    this.jobStore.loadJobs();
    this.api.getEmployees(undefined, true).subscribe({ next: e => this.employees = e, error: () => {} });
    this.api.getAppUsers().subscribe({ next: u => this.appUsers = u, error: () => {} });
    setTimeout(() => {
      const apps = this.allApplications();
      if (apps.length > 0) this.selectedApp = apps[0];
    }, 500);
  }

  selectCandidate(app: JobApplication, colColor: string): void {
    this.selectedApp = app;
    this.selectedColColor = colColor;
  }

  showToast(msg: string): void {
    this.toast = msg;
    setTimeout(() => this.toast = '', 3000);
  }

  // ── Schedule Interview Modal ───────────────────────────────────────────────
  showInterviewModal = signal(false);
  interviewForm = {
    date:     '',
    time:     '',
    location: '',
    notes:    '',
  };

  openInterviewModal(): void {
    if (!this.selectedApp) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.interviewForm = {
      date:     tomorrow.toISOString().split('T')[0],
      time:     '10:00',
      location: 'Google Meet / Office',
      notes:    '',
    };
    this.interviewerEmployeeId = '';
    this.showInterviewModal.set(true);
  }

  closeInterviewModal(): void {
    this.showInterviewModal.set(false);
  }

  // ── Move Stage Picker ─────────────────────────────────────────────────────
  showStagePicker = signal(false);
  readonly stageOptions: ApplicationStatus[] = ['Submitted', 'Under Review', 'Shortlisted', 'Hired', 'Rejected'];

  openStagePicker(): void {
    if (!this.selectedApp) return;
    this.showStagePicker.set(true);
  }

  closeStagePicker(): void {
    this.showStagePicker.set(false);
  }

  selectStage(stage: ApplicationStatus): void {
    if (!this.selectedApp) return;
    const app = this.selectedApp;
    this.jobStore.updateApplicationStatus(app.id, stage);
    this.selectedApp = { ...app, status: stage };
    this.closeStagePicker();

    // In-app notification
    this.candNotif.init(app.candidateId);
    this.candNotif.push({
      type:  'status',
      title: 'Application Status Updated 🔄',
      body:  `Your application for "${app.jobTitle}" has been moved to: ${stage}`,
      time:  'Just now',
    });

    // Email
    this.candNotif.sendEmail(
      app.candidateEmail,
      `Application Update — ${app.jobTitle}`,
      `<h2>Application Status Update</h2>
       <p>Dear ${app.candidateName},</p>
       <p>Your application for <strong>${app.jobTitle}</strong> has been updated to: <strong>${stage}</strong>.</p>
       <p>Best regards,<br>ExpertFlow HR Team</p>`
    );

    this.showToast(`✓ ${app.candidateName} moved to ${stage}`);
  }

  confirmInterview(): void {
    if (!this.selectedApp) return;
    const f = this.interviewForm;
    if (!f.date || !f.time) return;

    const app = this.selectedApp;
    const dateStr = new Date(`${f.date}T${f.time}`).toLocaleString('en-PK', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // Push in-app notification to candidate (scoped by candidateId)
    this.candNotif.init(app.candidateId);
    this.candNotif.push({
      type:  'interview',
      title: 'Interview Scheduled 📅',
      body:  `Your interview for "${app.jobTitle}" has been scheduled.\n📅 ${dateStr}\n📍 ${f.location}${f.notes ? '\n📝 ' + f.notes : ''}`,
      time:  'Just now',
    });

    // Send email to candidate
    this.candNotif.sendEmail(
      app.candidateEmail,
      `Interview Scheduled — ${app.jobTitle}`,
      `<h2>Interview Scheduled</h2>
       <p>Dear ${app.candidateName},</p>
       <p>We are pleased to inform you that your interview for <strong>${app.jobTitle}</strong> has been scheduled.</p>
       <ul>
         <li><strong>Date & Time:</strong> ${dateStr}</li>
         <li><strong>Location:</strong> ${f.location}</li>
         ${f.notes ? `<li><strong>Notes:</strong> ${f.notes}</li>` : ''}
       </ul>
       <p>Please confirm your attendance by replying to this email.</p>
       <p>Best regards,<br>ExpertFlow HR Team</p>`
    );

    // ── Notify interviewer employee (if selected) ─────────────────────────────
    if (this.interviewerEmployeeId) {
      const interviewerEmp  = this.employees.find(e => e.id === this.interviewerEmployeeId);
      const interviewerUser = this.appUsers.find(u => u.employee_id === this.interviewerEmployeeId);
      const interviewerName = interviewerEmp
        ? `${interviewerEmp.first_name} ${interviewerEmp.last_name}`
        : 'You';

      // App notification (targeted to the interviewer's app user)
      this.api.postNotification({
        target_role:    'Employee',
        target_user_id: interviewerUser?.id || undefined,
        type:           'info',
        title:          `Interview Assigned: ${app.jobTitle}`,
        body:           `You have been assigned to interview ${app.candidateName} for "${app.jobTitle}".\n📅 ${dateStr}\n📍 ${f.location}`,
      }).subscribe({ error: () => {} });

      // Email to interviewer (only if we have their email)
      if (interviewerUser?.email) {
        this.api.sendEmail(
          interviewerUser.email,
          `Interview Assignment — ${app.jobTitle}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1878cc;">Interview Assignment</h2>
            <p>Hi ${interviewerName},</p>
            <p>You have been assigned to conduct an interview for the <strong>${app.jobTitle}</strong> position.</p>
            <table style="border-collapse:collapse;margin:12px 0;width:100%;">
              <tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;">Candidate:</td><td>${app.candidateName}</td></tr>
              <tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;">Position:</td><td>${app.jobTitle}</td></tr>
              <tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;">Date &amp; Time:</td><td>${dateStr}</td></tr>
              <tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;">Location:</td><td>${f.location}</td></tr>
              ${f.notes ? `<tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;">Notes:</td><td>${f.notes}</td></tr>` : ''}
            </table>
            <p style="color:#64748b;font-size:13px;">Best regards,<br>ExpertFlow HR Team</p>
          </div>`
        ).subscribe({ error: () => {} });
      }
    }

    this.closeInterviewModal();
    this.showToast(`✓ Interview scheduled for ${app.candidateName}`);
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  rejectCandidate(): void {
    if (!this.selectedApp) return;
    const app = this.selectedApp;
    this.jobStore.updateApplicationStatus(app.id, 'Rejected');
    this.selectedApp = { ...app, status: 'Rejected' };

    // In-app notification
    this.candNotif.init(app.candidateId);
    this.candNotif.push({
      type:  'rejection',
      title: 'Application Update',
      body:  `Thank you for applying for "${app.jobTitle}". After careful consideration, we have decided to move forward with other candidates at this time.`,
      time:  'Just now',
    });

    // Email
    this.candNotif.sendEmail(
      app.candidateEmail,
      `Application Update — ${app.jobTitle}`,
      `<h2>Application Update</h2>
       <p>Dear ${app.candidateName},</p>
       <p>Thank you for your interest in the <strong>${app.jobTitle}</strong> position at ExpertFlow.</p>
       <p>After careful consideration, we have decided to move forward with other candidates at this time. We appreciate the time you invested in the application process.</p>
       <p>We encourage you to apply for future openings that match your skills.</p>
       <p>Best regards,<br>ExpertFlow HR Team</p>`
    );

    this.showToast(`${app.candidateName} has been rejected`);
  }

  // ── Create Offer (notification only — offer page handles the rest) ─────────
  notifyOffer(): void {
    if (!this.selectedApp) return;
    const app = this.selectedApp;

    this.candNotif.init(app.candidateId);
    this.candNotif.push({
      type:  'offer',
      title: 'Offer Letter Ready 🎉',
      body:  `Congratulations! An offer has been created for you for the "${app.jobTitle}" position. HR will be in touch shortly.`,
      time:  'Just now',
    });

    this.candNotif.sendEmail(
      app.candidateEmail,
      `Offer Letter — ${app.jobTitle}`,
      `<h2>Congratulations! 🎉</h2>
       <p>Dear ${app.candidateName},</p>
       <p>We are delighted to inform you that we would like to extend an offer for the <strong>${app.jobTitle}</strong> position at ExpertFlow.</p>
       <p>Our HR team will contact you shortly with the formal offer letter and next steps.</p>
       <p>Welcome to the ExpertFlow family!</p>
       <p>Best regards,<br>ExpertFlow HR Team</p>`
    );
  }

  // ── AI Resume Screening ───────────────────────────────────────────────────
  aiLoading  = signal(false);
  aiError    = signal('');
  aiResult   = signal<AiScreenResult | null>(null);
  aiScreenedAppId = signal<string>('');

  screenResume(): void {
    if (!this.selectedApp) return;
    const app = this.selectedApp;

    // Find the job posting to get requirements
    const job = this.allJobs().find(j => j.id === app.jobId);
    const requirements: string[] = job?.requirements?.length
      ? job.requirements.map((r: any) => typeof r === 'string' ? r : r.text || JSON.stringify(r))
      : [];

    if (requirements.length === 0) {
      this.aiError.set('No requirements found for this job posting. Please add requirements to the job first.');
      return;
    }

    // Reset state
    this.aiResult.set(null);
    this.aiError.set('');
    this.aiLoading.set(true);
    this.aiScreenedAppId.set(app.id);

    this.api.screenResume({
      resumeText:   app.resumeLink   || '',
      coverLetter:  app.coverLetter  || '',
      requirements,
      jobTitle:     app.jobTitle,
    }).subscribe({
      next: result => {
        this.aiResult.set(result);
        this.aiLoading.set(false);
      },
      error: err => {
        this.aiError.set(err?.error?.error || err?.message || 'AI screening failed. Please try again.');
        this.aiLoading.set(false);
      },
    });
  }

  aiScoreColor(score: number): string {
    if (score >= 75) return '#059669';
    if (score >= 50) return '#d97706';
    return '#dc2626';
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  get totalCandidates(): number { return this.filteredApps.length; }
  get activeCandidates(): number { return this.filteredApps.filter(a => a.status !== 'Rejected' && a.status !== 'Hired').length; }
}
