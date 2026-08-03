import { Component } from '@angular/core';

@Component({
  selector: 'app-notifications',
  imports: [],
  template: `
    <div class="page-header">
      <div>
        <h1>Notifications</h1>
        <p>System alerts and workflow notifications</p>
      </div>
      <button class="btn btn-secondary btn-sm">Mark All Read</button>
    </div>
    <div class="card" style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">🔔</div>
      <h3 style="margin-bottom:8px;">Notification Center</h3>
      <p style="color:var(--color-text-secondary);font-size:13px;">Notification management will be available in a future release.</p>
    </div>
  `
})
export class Notifications {}
