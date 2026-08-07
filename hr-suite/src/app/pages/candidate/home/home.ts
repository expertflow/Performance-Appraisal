import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-candidate-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class CandidateHome implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);

  readonly user = this.auth.currentUser;

  /** Controls the entrance animation — set to true after a short delay */
  visible = signal(false);

  ngOnInit(): void {
    // Trigger CSS entrance animation after one frame
    setTimeout(() => this.visible.set(true), 50);
  }

  get firstName(): string {
    const name = this.user()?.name ?? '';
    return name.split(' ')[0] || 'there';
  }
}
