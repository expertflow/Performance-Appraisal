import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Candidate {
  name: string;
  initials: string;
  color: string;
  role: string;
  score?: number;
  tags: string[];
  date: string;
  highlight?: boolean;
}

interface PipelineColumn {
  id: string;
  label: string;
  color: string;
  candidates: Candidate[];
}

@Component({
  selector: 'app-pipeline',
  imports: [RouterLink, FormsModule],
  templateUrl: './pipeline.html',
  styleUrl: './pipeline.scss'
})
export class Pipeline {
  selectedJob = 'Senior Angular Developer';
  jobs = ['Senior Angular Developer', 'Product Manager', 'UX Designer', 'DevOps Engineer'];

  columns: PipelineColumn[] = [
    {
      id: 'applied',
      label: 'Applied',
      color: '#0066CC',
      candidates: [
        { name: 'Ali Hassan', initials: 'AH', color: 'teal', role: 'Angular Dev · 5 yrs', tags: ['Angular', 'TypeScript'], date: 'Jul 30', score: undefined },
        { name: 'Sara Khan', initials: 'SK', color: 'purple', role: 'Frontend Dev · 3 yrs', tags: ['React', 'Vue'], date: 'Jul 29', score: undefined },
        { name: 'Bilal Ahmed', initials: 'BA', color: 'blue', role: 'Full Stack · 4 yrs', tags: ['Angular', 'Node'], date: 'Jul 28', score: undefined },
      ]
    },
    {
      id: 'screening',
      label: 'Screening',
      color: '#5B21B6',
      candidates: [
        { name: 'Nadia Baig', initials: 'NB', color: 'teal', role: 'Angular Dev · 6 yrs', tags: ['Angular', 'RxJS', 'SSR'], date: 'Jul 27', score: undefined },
        { name: 'Raza Ali', initials: 'RA', color: 'blue', role: 'Frontend Lead · 7 yrs', tags: ['Angular', 'Architecture'], date: 'Jul 26', score: undefined },
      ]
    },
    {
      id: 'technical',
      label: 'Technical',
      color: '#00A3A3',
      candidates: [
        { name: 'Fatima Malik', initials: 'FM', color: 'blue', role: 'Senior Dev · 5 yrs', tags: ['Angular', 'TypeScript', 'RxJS'], date: 'Jul 25', score: 87, highlight: true },
        { name: 'Omar Sheikh', initials: 'OS', color: 'purple', role: 'Angular Dev · 4 yrs', tags: ['Angular', 'NgRx'], date: 'Jul 24', score: undefined },
      ]
    },
    {
      id: 'hr_interview',
      label: 'HR Interview',
      color: '#D97706',
      candidates: [
        { name: 'Zara Hussain', initials: 'ZH', color: 'blue', role: 'Senior Dev · 6 yrs', tags: ['Angular', 'Leadership'], date: 'Jul 23', score: undefined },
      ]
    },
    {
      id: 'offer',
      label: 'Offer',
      color: '#059669',
      candidates: [
        { name: 'Ahmed Raza', initials: 'AR', color: 'teal', role: 'Angular Lead · 8 yrs', tags: ['Angular', 'Architecture', 'SSR'], date: 'Jul 20', score: 94, highlight: true },
      ]
    },
    {
      id: 'hired',
      label: 'Hired',
      color: '#0F766E',
      candidates: [
        { name: 'Khalid Mahmood', initials: 'KM', color: 'orange', role: 'Senior Dev · 5 yrs', tags: ['Angular', 'TypeScript'], date: 'Jul 15', score: undefined },
      ]
    },
  ];

  selectedCandidate = this.columns[2].candidates[0];
  selectedColumn = this.columns[2];

  toast = '';

  selectCandidate(candidate: Candidate, column: PipelineColumn) {
    this.selectedCandidate = candidate;
    this.selectedColumn = column;
  }

  showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => this.toast = '', 3000);
  }

  scheduleInterview() {
    this.showToast(`✓ Interview scheduled for ${this.selectedCandidate.name}`);
  }

  moveStage() {
    const colIndex = this.columns.findIndex(c => c.id === this.selectedColumn.id);
    if (colIndex < this.columns.length - 1) {
      const nextCol = this.columns[colIndex + 1];
      this.selectedColumn.candidates = this.selectedColumn.candidates.filter(c => c !== this.selectedCandidate);
      nextCol.candidates.unshift(this.selectedCandidate);
      this.selectedColumn = nextCol;
      this.showToast(`✓ ${this.selectedCandidate.name} moved to ${nextCol.label}`);
    } else {
      this.showToast('Candidate is already in the final stage');
    }
  }

  rejectCandidate() {
    this.showToast(`${this.selectedCandidate.name} has been rejected`);
    this.selectedColumn.candidates = this.selectedColumn.candidates.filter(c => c !== this.selectedCandidate);
    if (this.selectedColumn.candidates.length > 0) {
      this.selectedCandidate = this.selectedColumn.candidates[0];
    }
  }

  competencies = [
    { label: 'Technical Skills', score: 90 },
    { label: 'Communication', score: 82 },
    { label: 'Problem Solving', score: 88 },
    { label: 'Team Fit', score: 85 },
    { label: 'Leadership', score: 75 },
  ];
}
