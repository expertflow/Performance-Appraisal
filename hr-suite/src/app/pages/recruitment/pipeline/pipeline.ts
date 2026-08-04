import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { JobStoreService, JobApplication, ApplicationStatus } from '../../../services/job-store';
import { CandidateNotificationService } from '../../../services/candidate-notification';

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

  readonly allApplications = this.jobStore.applications;
  readonly allJobs         = this.jobStore.jobs;

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

    // Send email
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

  initials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  get totalCandidates(): number { return this.filteredApps.length; }
  get activeCandidates(): number { return this.filteredApps.filter(a => a.status !== 'Rejected' && a.status !== 'Hired').length; }
}
